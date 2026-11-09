import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PilarPage } from "@/components/PilarPage";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { ListaDecisoes } from "./components/ListaDecisoes";
import { quandoRelativo } from "../lib";
import { rotaDoAgente, type Decisao } from "./lib";
import { MARKETING_APP_URL } from "./marketing";
import { useTimeResumo, type AgenteResumo } from "./useTimeResumo";

function abertura(decisoes: Decisao[]): string {
  const hoje = decisoes.filter((d) => d.prioridade === 1).length;
  if (decisoes.length === 0) return "Nenhuma decisão esperando você.";
  const total = `${decisoes.length} ${decisoes.length === 1 ? "decisão espera" : "decisões esperam"} você`;
  return hoje > 0 ? `${total}, ${hoje} para hoje.` : `${total}.`;
}

/**
 * Central do Time (SPEC 126): a página do chefe de gabinete. Um cartão por agente e a
 * fila única de decisões: ações gravadas pelos agentes ligados e, para os desligados, a
 * regra fixa sobre os números do banco.
 */
export default function Central() {
  usePageTitle("Time");
  const formatMoney = useMoneyMask();
  const { agentes, decisoes, agentesQ, receitaQ, saudeQ } = useTimeResumo();

  const receita = receitaQ.data;
  const saude = saudeQ.data ?? [];
  const emRisco = saude.filter((s) => s.faixa === "risco").length;

  const indicador = (id: string): string | null => {
    if (id === "receita") {
      if (!receita) return null;
      return `MRR ${formatMoney(receita.mrr)} · ${receita.pagantes} ${receita.pagantes === 1 ? "pagante" : "pagantes"}`;
    }
    if (id === "marketing") return "Campanhas, posts e vídeos na plataforma";
    if (id === "clientes") {
      if (!saudeQ.data) return null;
      return `${saude.length} ${saude.length === 1 ? "escritório" : "escritórios"} · ${emRisco} em risco`;
    }
    return null;
  };

  const pedidos = (id: string) => decisoes.filter((d) => d.agente === id).length;
  const chefe = agentes.find((a) => a.agente.id === "chefe");
  const resumoDoDia = chefe?.ultima
    ? `Resumo do dia enviado por e-mail ${quandoRelativo(chefe.ultima.inicio) ?? "agora há pouco"}.`
    : chefe?.agente.ativo
      ? "O resumo do dia chega por e-mail às 7h10."
      : null;

  return (
    <PilarPage
      title="Time"
      actions={
        <Button asChild variant="outline" size="sm">
          <a href={MARKETING_APP_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            Plataforma de marketing
          </a>
        </Button>
      }
    >
      <p className="text-sm text-ink-soft" aria-live="polite">
        {receitaQ.isLoading || saudeQ.isLoading ? "Juntando os números das áreas." : abertura(decisoes)}
        {resumoDoDia && <span className="text-ink-muted"> {resumoDoDia}</span>}
      </p>

      <Card className="border border-black/5">
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Fila de decisões</CardTitle>
        </CardHeader>
        <CardContent>
          {receitaQ.isLoading || saudeQ.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : receitaQ.error || saudeQ.error ? (
            <p className="py-4 text-sm text-danger-strong" role="alert">
              Não deu para carregar os números das áreas. Recarregue a página; se continuar, confira o login com segundo
              fator.
            </p>
          ) : (
            <ListaDecisoes decisoes={decisoes} mostrarAgente />
          )}
        </CardContent>
      </Card>

      <section aria-label="Agentes" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agentesQ.isLoading
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
          : agentes
              .filter((a) => a.agente.id !== "chefe")
              .map((a) => (
                <CartaoAgente
                  key={a.agente.id}
                  resumo={a}
                  indicador={indicador(a.agente.id)}
                  pedidos={pedidos(a.agente.id)}
                />
              ))}
      </section>
    </PilarPage>
  );
}

function CartaoAgente({
  resumo,
  indicador,
  pedidos,
}: {
  resumo: AgenteResumo;
  indicador: string | null;
  pedidos: number;
}) {
  const { agente, status } = resumo;
  return (
    <Link
      to={rotaDoAgente(agente.id)}
      className="group flex flex-col gap-2 rounded-2xl border border-black/5 bg-white p-4 transition-colors hover:border-black/15 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink">{agente.nome}</span>
        <StatusBadge domain="ops_agente" status={status} />
      </div>
      <p className="text-xs text-ink-soft">{agente.missao}</p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <p className="text-sm tabular-nums text-ink">
          {indicador ?? <span className="text-ink-muted">Ver o que vai medir</span>}
        </p>
        {pedidos > 0 ? (
          <span className="shrink-0 rounded-full bg-brand px-2 text-xs font-semibold leading-5 text-ink tabular-nums">
            {pedidos} {pedidos === 1 ? "pedido" : "pedidos"}
          </span>
        ) : (
          <ArrowRight
            size={14}
            className="shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>
    </Link>
  );
}
