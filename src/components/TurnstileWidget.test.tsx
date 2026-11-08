import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const h = vi.hoisted(() => ({ siteKey: "site-key-teste" as string | undefined }));

vi.mock("@/lib/env", () => ({
  env: {
    get VITE_TURNSTILE_SITE_KEY() {
      return h.siteKey;
    },
  },
}));

type Opts = { sitekey: string; callback: (t: string) => void; "error-callback"?: () => void };

function fakeTurnstile() {
  const opts: Opts[] = [];
  const api = {
    render: vi.fn((_el: HTMLElement, o: Opts) => {
      opts.push(o);
      return "widget-1";
    }),
    remove: vi.fn(),
    reset: vi.fn(),
  };
  return { api, opts };
}

async function carregar() {
  vi.resetModules();
  return (await import("./TurnstileWidget")).TurnstileWidget;
}

beforeEach(() => {
  h.siteKey = "site-key-teste";
  document.head.innerHTML = "";
  delete window.turnstile;
});

afterEach(() => {
  vi.useRealTimers();
  delete window.turnstile;
});

describe("TurnstileWidget", () => {
  it("sem site key não renderiza nem carrega script", async () => {
    h.siteKey = undefined;
    const TurnstileWidget = await carregar();
    const { container } = render(<TurnstileWidget onToken={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.getElementById("cf-turnstile-script")).toBeNull();
  });

  it("injeta o script, renderiza o widget e repassa token e erro", async () => {
    const TurnstileWidget = await carregar();
    const onToken = vi.fn();
    const onError = vi.fn();
    const { api, opts } = fakeTurnstile();
    const { rerender, unmount } = render(<TurnstileWidget onToken={onToken} onError={onError} />);

    const script = document.getElementById("cf-turnstile-script") as HTMLScriptElement;
    expect(script.src).toContain("challenges.cloudflare.com/turnstile");
    window.turnstile = api;
    await act(async () => script.onload?.(new Event("load")));

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(opts[0].sitekey).toBe("site-key-teste");

    // Callback nova do consumidor não recria o widget, mas é a usada.
    const onToken2 = vi.fn();
    rerender(<TurnstileWidget onToken={onToken2} onError={onError} />);
    expect(api.render).toHaveBeenCalledTimes(1);
    opts[0].callback("tok");
    expect(onToken2).toHaveBeenCalledWith("tok");
    expect(onToken).not.toHaveBeenCalled();
    opts[0]["error-callback"]?.();
    expect(onError).toHaveBeenCalled();

    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });

  it("script já presente: espera o turnstile aparecer", async () => {
    vi.useFakeTimers();
    const TurnstileWidget = await carregar();
    const s = document.createElement("script");
    s.id = "cf-turnstile-script";
    document.head.appendChild(s);
    const { api } = fakeTurnstile();
    render(<TurnstileWidget onToken={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(api.render).not.toHaveBeenCalled();
    window.turnstile = api;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(api.render).toHaveBeenCalled();
  });

  it("desmontar antes do script carregar não renderiza; erro no remove é ignorado", async () => {
    const TurnstileWidget = await carregar();
    const { api } = fakeTurnstile();
    const { unmount } = render(<TurnstileWidget onToken={vi.fn()} />);
    unmount();
    window.turnstile = api;
    const script = document.getElementById("cf-turnstile-script") as HTMLScriptElement;
    await act(async () => script.onload?.(new Event("load")));
    expect(api.render).not.toHaveBeenCalled();

    // segundo widget: remove lança e o unmount não quebra
    api.remove.mockImplementation(() => {
      throw new Error("já removido");
    });
    const r2 = render(<TurnstileWidget onToken={vi.fn()} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(api.render).toHaveBeenCalled();
    expect(() => r2.unmount()).not.toThrow();
  });
});
