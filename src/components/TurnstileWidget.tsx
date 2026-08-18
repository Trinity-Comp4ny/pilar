import { useEffect, useRef } from "react";
import { env } from "@/lib/env";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "invisible";
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

const SCRIPT_ID = "cf-turnstile-script";
const SITE_KEY = env.VITE_TURNSTILE_SITE_KEY;

export function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Callbacks passadas por referência pra dentro do useEffect que monta o widget uma
  // única vez: se onToken/onError forem inline no consumidor (referência nova a cada
  // render, ex. `onError={() => ...}`), guardar como dependência do efeito fazia o
  // Turnstile ser destruído e recriado a cada tecla digitada no form, reiniciando o
  // desafio pra sempre e travando em "Verifying...".
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!SITE_KEY) return;

    const loadScript = () =>
      new Promise<void>((resolve) => {
        if (document.getElementById(SCRIPT_ID)) {
          const check = () => (window.turnstile ? resolve() : setTimeout(check, 50));
          check();
          return;
        }
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });

    let cancelled = false;

    loadScript().then(() => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (token) => onTokenRef.current(token),
        "error-callback": () => onErrorRef.current?.(),
        theme: "light",
        size: "normal",
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  if (!SITE_KEY) {
    return null;
  }

  return <div ref={ref} />;
}
