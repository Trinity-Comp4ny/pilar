import { Navigate, useParams } from "react-router-dom";
import { PilarPage } from "@/components/PilarPage";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AgenteCabecalho } from "./components/AgenteCabecalho";
import { AgentePlanejado } from "./components/AgentePlanejado";
import { ClientesPainel } from "./components/ClientesPainel";
import { ReceitaPainel } from "./components/ReceitaPainel";
import { PLANO_DOS_AGENTES, type AgenteId } from "./lib";
import { useTimeResumo } from "./useTimeResumo";

/** Ficha do agente em /ultra-admin/time/:agente, no mesmo layout para todos (SPEC 126, req. 3). */
export default function AgenteFicha() {
  const { agente: id = "" } = useParams();
  const { agentes, agentesQ, remetente } = useTimeResumo();
  const resumo = agentes.find((a) => a.agente.id === id);
  usePageTitle(resumo?.agente.nome ?? "Time");

  if (!(id in PLANO_DOS_AGENTES) || id === "chefe") return <Navigate to="/ultra-admin/time" replace />;
  const agenteId = id as AgenteId;

  return (
    <PilarPage title={resumo?.agente.nome ?? "Agente"} breadcrumbs={[{ label: "Time", to: "/ultra-admin/time" }]}>
      <AgenteCabecalho
        agente={resumo?.agente}
        status={resumo?.status ?? "planejado"}
        ultima={resumo?.ultima ?? null}
        carregando={agentesQ.isLoading}
      />
      {agenteId === "receita" ? (
        <ReceitaPainel remetente={remetente} />
      ) : agenteId === "clientes" ? (
        <ClientesPainel remetente={remetente} />
      ) : (
        <AgentePlanejado id={agenteId} />
      )}
    </PilarPage>
  );
}
