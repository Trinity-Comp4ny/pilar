import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, ExternalLink, Wrench, X } from "lucide-react";
import { AVISOS_PLATAFORMA_KEY, useAvisosPlataforma } from "@/hooks/useAvisosPlataforma";
import type { Aviso } from "@/lib/avisosPlataforma";
import { TONE_BADGE } from "@/lib/status";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

const CHAVE_STORAGE = "pilar:avisos-dispensados";

// Dispensa vale para a aba (sessionStorage): incidente aberto é coisa que se quer ver de novo.
function lerDispensados(): string[] {
  try {
    const bruto = sessionStorage.getItem(CHAVE_STORAGE);
    const lido: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lido) ? lido.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function gravarDispensados(chaves: string[]) {
  try {
    sessionStorage.setItem(CHAVE_STORAGE, JSON.stringify(chaves.slice(-50)));
  } catch {
    // Sem storage (aba privada, bloqueio): a dispensa vale só até recarregar.
  }
}

function Icone({ aviso }: { aviso: Aviso }) {
  const props = { size: 16, className: "mt-0.5 shrink-0", "aria-hidden": true } as const;
  if (aviso.tom === "positive") return <CheckCircle2 {...props} />;
  if (aviso.chave.startsWith("manutencao:")) return <Wrench {...props} />;
  return <AlertTriangle {...props} />;
}

/**
 * Faixa de avisos da plataforma (SPEC 153): incidente declarado e manutenção programada, no topo
 * do conteúdo de toda página logada. Some sozinha quando o incidente é resolvido.
 */
export function FaixaAvisos() {
  const avisos = useAvisosPlataforma();
  const queryClient = useQueryClient();
  const [dispensados, setDispensados] = useState<string[]>(lerDispensados);

  const visiveis = avisos.filter((a) => !dispensados.includes(a.chave));
  if (visiveis.length === 0) return null;

  const statusUrl = env.VITE_STATUS_URL ?? "/status";
  const externo = statusUrl.startsWith("http");

  const dispensar = (aviso: Aviso) => {
    const proximos = [...dispensados, aviso.chave];
    setDispensados(proximos);
    gravarDispensados(proximos);
    // Comunicado dispensado não volta em nenhum dispositivo (SPEC 157).
    if (aviso.comunicadoId) {
      void supabase
        .rpc("dispensar_comunicado", { p_comunicado_id: aviso.comunicadoId })
        .then(() => queryClient.invalidateQueries({ queryKey: AVISOS_PLATAFORMA_KEY }));
    }
  };

  return (
    // Mora no bloco fixo do topo do Layout (FaixasDoTopo), com fundo próprio e o mesmo recuo
    // lateral do cabeçalho das páginas.
    <div className="space-y-2 bg-background px-4 py-2 md:px-6">
      {visiveis.map((a) => (
        <div
          key={a.chave}
          role={a.tom === "danger" ? "alert" : "status"}
          className={cn("flex items-start gap-3 rounded-lg px-4 py-3 text-sm", TONE_BADGE[a.tom])}
        >
          <Icone aviso={a} />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium">{a.titulo}</p>
            <p>{a.texto}</p>
            {a.detalhe && <p className="text-xs opacity-80">{a.detalhe}</p>}
          </div>
          {a.link &&
            (a.link.url.startsWith("/") ? (
              <Link
                to={a.link.url}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
              >
                {a.link.rotulo}
              </Link>
            ) : (
              <a
                href={a.link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
              >
                {a.link.rotulo}
                <ExternalLink size={12} aria-hidden />
              </a>
            ))}
          {a.tom !== "positive" && !a.comunicadoId && (
            <a
              href={statusUrl}
              target={externo ? "_blank" : undefined}
              rel={externo ? "noreferrer" : undefined}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
            >
              Acompanhar
              <ExternalLink size={12} aria-hidden />
            </a>
          )}
          <button
            type="button"
            aria-label="Dispensar aviso"
            onClick={() => dispensar(a)}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/20"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
