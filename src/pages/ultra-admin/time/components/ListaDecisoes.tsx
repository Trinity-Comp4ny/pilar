import { Link } from "react-router-dom";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Decisao } from "../lib";

const AGENTE_LABEL: Record<Decisao["agente"], string> = {
  chefe: "Chefe",
  receita: "Receita",
  clientes: "Clientes",
  marketing: "Marketing",
  produto: "Produto",
  qualidade: "Qualidade",
  financas: "Finanças",
};

/**
 * Fila de decisões: cada linha diz o que houve, a evidência e a próxima ação. O
 * WhatsApp abre com o texto pronto; quem envia é você (nível N1, ADR 0060).
 */
export function ListaDecisoes({
  decisoes,
  mostrarAgente = false,
  vazio = "Nada esperando você agora.",
}: {
  decisoes: Decisao[];
  mostrarAgente?: boolean;
  vazio?: string;
}) {
  if (decisoes.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-soft" role="status">
        <CheckCircle2 size={16} className="text-positive-strong" />
        {vazio}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-black/5">
      {decisoes.map((d) => (
        <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              {mostrarAgente && (
                <span className="mr-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {AGENTE_LABEL[d.agente]}
                </span>
              )}
              {d.titulo}
            </p>
            <p className="text-xs text-ink-muted">{d.detalhe}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {d.whatsapp && (
              <Button asChild size="sm" variant="brand">
                <a href={d.whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle size={14} />
                  Abrir no WhatsApp
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link to={d.link}>{d.link === "/ultra-admin/feedback" ? "Ver feedback" : "Ver empresa"}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
