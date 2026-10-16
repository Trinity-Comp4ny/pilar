import { useCallback } from "react";
import { Navigate, useParams } from "react-router-dom";
import { PilarPage } from "@/components/PilarPage";
import { usePageTitle } from "@/hooks/usePageTitle";
import { emBrl, useFormatCusto } from "../custos";
import { AgenteCabecalho } from "./components/AgenteCabecalho";
import { AgentePlanejado } from "./components/AgentePlanejado";
import { BriefingAgente } from "./components/BriefingAgente";
import { ClientesPainel } from "./components/ClientesPainel";
import { ExecucoesAgente } from "./components/ExecucoesAgente";
import { MarketingExterno } from "./components/MarketingExterno";
import { ReceitaPainel } from "./components/ReceitaPainel";
import { useEfeitosDoAgente, useExecucoesDoAgente } from "./hooks";
import { ehExecutavel, PLANO_DOS_AGENTES, textoEfeito, type AgenteId } from "./lib";
import { useTimeResumo } from "./useTimeResumo";

/** Ficha do agente em /ultra-admin/time/:agente, no mesmo layout para todos (SPEC 126, req. 3). */
export default function AgenteFicha() {
  const { agente: id = "" } = useParams();
  const { agentes, agentesQ, decisoes } = useTimeResumo();
  const execucoesQ = useExecucoesDoAgente(id);
  const efeitosQ = useEfeitosDoAgente(id);
  const formatCusto = useFormatCusto();
  const formatarUsd = useCallback((usd: number) => formatCusto(emBrl(usd)), [formatCusto]);
  const resumo = agentes.find((a) => a.agente.id === id);
  usePageTitle(resumo?.agente.nome ?? "Time");

  if (!(id in PLANO_DOS_AGENTES) || id === "chefe") return <Navigate to="/ultra-admin/time" replace />;
  const agenteId = id as AgenteId;
  const execucoes = execucoesQ.data ?? [];
  const custoUsd = execucoes.reduce((s, e) => s + (Number(e.custo_usd) || 0), 0);
  const daArea = decisoes.filter((d) => d.agente === agenteId);

  return (
    <PilarPage title={resumo?.agente.nome ?? "Agente"} breadcrumbs={[{ label: "Time", to: "/ultra-admin/time" }]}>
      <AgenteCabecalho
        agente={resumo?.agente}
        status={resumo?.status ?? "planejado"}
        ultima={resumo?.ultima ?? null}
        custo30d={custoUsd > 0 ? formatarUsd(custoUsd) : null}
        efeito={textoEfeito(efeitosQ.data ?? [])}
        carregando={agentesQ.isLoading}
      />
      {ehExecutavel(agenteId) && <BriefingAgente execucao={resumo?.ultima ?? null} />}
      {agenteId === "receita" ? (
        <ReceitaPainel decisoes={daArea} />
      ) : agenteId === "clientes" ? (
        <ClientesPainel decisoes={daArea} />
      ) : agenteId === "marketing" ? (
        <MarketingExterno />
      ) : (
        <AgentePlanejado id={agenteId} />
      )}
      {ehExecutavel(agenteId) && <ExecucoesAgente execucoes={execucoes} formatarCusto={formatarUsd} />}
    </PilarPage>
  );
}
