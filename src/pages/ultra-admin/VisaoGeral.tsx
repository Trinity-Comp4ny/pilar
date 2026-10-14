import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  MessageSquare,
  Siren,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useFeedbackNovosCount } from "@/hooks/useFeedbackNovosCount";
import { formatNumberCompact } from "@/lib/format";
import { statusLabel } from "@/lib/status";
import { useAtividade, useEmpresas, useIncidentes } from "./hooks";
import { useCustosIa, useFormatCusto } from "./custos";
import {
  SITUACOES,
  nomeDoAtor,
  prazoTeste,
  quandoRelativo,
  situacaoEmpresa,
  testeVenceEmBreve,
  type Situacao,
} from "./lib";
import { EmptyState } from "@/components/EmptyState";

const DIA = 24 * 60 * 60 * 1000;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function resumoEmpresas(porSituacao: Map<Situacao, number>): string {
  const n = (s: Situacao) => porSituacao.get(s) ?? 0;
  return [
    plural(n("pagante"), "pagante", "pagantes"),
    `${n("em_teste")} em teste`,
    plural(n("convidada"), "convidada", "convidadas"),
  ].join(" · ");
}

type ItemAtencao = { id: string; icon: LucideIcon; texto: string; detalhe?: string; to: string };

export default function VisaoGeral() {
  usePageTitle("Ultra admin");
  const navigate = useNavigate();
  const formatCusto = useFormatCusto();
  const empresasQ = useEmpresas();
  const custosQ = useCustosIa();
  const incidentesQ = useIncidentes();
  const atividadeQ = useAtividade(null, 8);
  const { data: feedbackNovos = 0 } = useFeedbackNovosCount(true);

  const empresas = useMemo(() => empresasQ.data ?? [], [empresasQ.data]);
  const comSituacao = useMemo(
    () => empresas.map((e) => ({ ...e, situacao: situacaoEmpresa(e.status, e.cobranca) })),
    [empresas]
  );

  const porSituacao = useMemo(() => {
    const m = new Map<Situacao, number>();
    for (const e of comSituacao) m.set(e.situacao, (m.get(e.situacao) ?? 0) + 1);
    return m;
  }, [comSituacao]);

  const ativas = comSituacao.filter((e) => e.situacao !== "arquivada");
  const usuarios = ativas.reduce((s, e) => s + e.usersCount, 0);
  const agora = Date.now();
  const cadastros30d = ativas.filter((e) => e.createdAt && agora - new Date(e.createdAt).getTime() <= 30 * DIA);
  const cadastros7d = cadastros30d.filter((e) => agora - new Date(e.createdAt as string).getTime() <= 7 * DIA);
  const custos = custosQ.data?.totais;

  const atencao = useMemo<ItemAtencao[]>(() => {
    const itens: ItemAtencao[] = [];
    for (const e of comSituacao) {
      if (e.situacao === "em_teste" && testeVenceEmBreve(e.cobranca.trialEndsAt)) {
        itens.push({
          id: `teste-${e.id}`,
          icon: Clock,
          texto: `${e.nome}: teste ${prazoTeste(e.cobranca.trialEndsAt)}`,
          detalhe: "Bom momento pra falar com o dono antes de virar só leitura.",
          to: `/ultra-admin/empresas/${e.id}`,
        });
      }
      if (e.situacao === "em_atraso") {
        itens.push({
          id: `atraso-${e.id}`,
          icon: CreditCard,
          texto: `${e.nome}: pagamento em atraso`,
          to: `/ultra-admin/empresas/${e.id}`,
        });
      }
    }
    const vencidas = porSituacao.get("teste_vencido") ?? 0;
    if (vencidas > 0) {
      itens.push({
        id: "vencidas",
        icon: Clock,
        texto: `${vencidas} ${vencidas === 1 ? "empresa só leitura" : "empresas só leitura"} depois do teste`,
        detalhe: "São excluídas 90 dias depois do vencimento.",
        to: "/ultra-admin/testes",
      });
    }
    for (const e of custosQ.data?.porEmpresa ?? []) {
      if (!e.anomaliaGasto) continue;
      itens.push({
        id: `ia-${e.empresaId}`,
        icon: AlertTriangle,
        texto: `${e.empresaNome}: gasto de IA fora do normal hoje`,
        detalhe: `${formatNumberCompact(e.tokensHoje)} tokens hoje, média de ${formatNumberCompact(e.mediaAnteriorGasto)} por dia.`,
        to: "/ultra-admin/custos-ia",
      });
    }
    if (feedbackNovos > 0) {
      itens.push({
        id: "feedback",
        icon: MessageSquare,
        texto: `${feedbackNovos} ${feedbackNovos === 1 ? "feedback sem triagem" : "feedbacks sem triagem"}`,
        to: "/ultra-admin/feedback",
      });
    }
    const abertos = (incidentesQ.data ?? []).filter((i) => i.status !== "resolvido").length;
    if (abertos > 0) {
      itens.push({
        id: "incidentes",
        icon: Siren,
        texto: `${abertos} ${abertos === 1 ? "incidente aberto" : "incidentes abertos"} na status page`,
        to: "/ultra-admin/incidentes",
      });
    }
    return itens;
  }, [comSituacao, porSituacao, custosQ.data, feedbackNovos, incidentesQ.data]);

  const recentes = useMemo(
    () =>
      [...ativas]
        .filter((e) => e.createdAt)
        .sort((a, b) => ((a.createdAt as string) < (b.createdAt as string) ? 1 : -1))
        .slice(0, 5),
    [ativas]
  );

  const maiorContagem = Math.max(1, ...Array.from(porSituacao.values()));
  const carregando = empresasQ.isLoading;

  return (
    <PilarPage title="Visão geral">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          icon={Building2}
          label="Empresas"
          value={`${ativas.length}`}
          subtitle={resumoEmpresas(porSituacao)}
          loading={carregando}
          onClick={() => navigate("/ultra-admin/empresas")}
        />
        <KPICard
          icon={Users}
          label="Usuários"
          value={`${usuarios}`}
          subtitle={`em ${ativas.length} ${ativas.length === 1 ? "empresa" : "empresas"}`}
          loading={carregando}
          onClick={() => navigate("/ultra-admin/usuarios")}
        />
        <KPICard
          icon={UserPlus}
          label="Cadastros em 30 dias"
          value={`${cadastros30d.length}`}
          subtitle={`${cadastros7d.length} nos últimos 7 dias`}
          loading={carregando}
          onClick={() => navigate("/ultra-admin/empresas")}
        />
        <KPICard
          icon={Coins}
          label="Custo de IA no mês"
          value={custos?.custo ?? 0}
          subtitle={
            custos && custos.chamadas > 0
              ? `${formatNumberCompact(custos.chamadas)} chamadas · ${formatCusto(custos.custo / custos.chamadas)} cada`
              : "Nenhuma chamada no mês"
          }
          loading={custosQ.isLoading}
          onClick={() => navigate("/ultra-admin/custos-ia")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-black/5 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Precisa de atenção</CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : atencao.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-soft">
                <CheckCircle2 size={16} className="text-positive-strong" />
                Nada pedindo atenção agora.
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {atencao.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60"
                      >
                        <Icon size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-soft" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink">{item.texto}</p>
                          {item.detalhe && <p className="text-xs text-ink-muted">{item.detalhe}</p>}
                        </div>
                        <ArrowRight
                          size={14}
                          className="mt-1 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border border-black/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Situação das empresas</CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ul className="space-y-1">
                {SITUACOES.filter((s) => (porSituacao.get(s) ?? 0) > 0).map((s) => {
                  const n = porSituacao.get(s) ?? 0;
                  return (
                    <li key={s}>
                      <Link
                        to={`/ultra-admin/empresas?situacao=${s}`}
                        className="-mx-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 hover:bg-muted/60"
                        aria-label={`${statusLabel("empresa_situacao", s)}: ${n}`}
                      >
                        <StatusBadge domain="empresa_situacao" status={s} className="w-fit" />
                        <span className="text-sm font-medium tabular-nums text-ink">{n}</span>
                        <span className="col-span-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <span
                            className="block h-full rounded-full bg-ink/60"
                            style={{ width: `${(n / maiorContagem) * 100}%` }}
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-black/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Cadastros recentes</CardTitle>
            <Link to="/ultra-admin/empresas" className="text-xs font-medium text-ink-soft hover:text-ink">
              Ver empresas
            </Link>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <Skeleton className="h-40 w-full" />
            ) : recentes.length === 0 ? (
              <EmptyState compact title="Nenhuma empresa cadastrada ainda." />
            ) : (
              <ul className="divide-y divide-black/5">
                {recentes.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/ultra-admin/empresas/${e.id}`}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{e.nome}</p>
                        <p className="text-xs text-ink-muted">
                          {quandoRelativo(e.createdAt)} · {e.usersCount} {e.usersCount === 1 ? "usuário" : "usuários"}
                        </p>
                      </div>
                      <StatusBadge domain="empresa_situacao" status={e.situacao} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border border-black/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Atividade recente</CardTitle>
            <Link to="/ultra-admin/atividade" className="text-xs font-medium text-ink-soft hover:text-ink">
              Ver tudo
            </Link>
          </CardHeader>
          <CardContent>
            {atividadeQ.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (atividadeQ.data ?? []).length === 0 ? (
              <EmptyState compact title="Nenhuma atividade registrada ainda." />
            ) : (
              <ul className="divide-y divide-black/5">
                {(atividadeQ.data ?? []).map((ev) => (
                  <li key={ev.id} className="flex items-baseline gap-3 py-2.5 text-sm">
                    <p className="min-w-0 flex-1 text-ink-soft">
                      {ev.ator ? <span className="font-medium text-ink">{nomeDoAtor(ev.ator)} </span> : null}
                      {ev.frase}
                    </p>
                    <time className="shrink-0 text-xs text-ink-muted" dateTime={ev.quando}>
                      {quandoRelativo(ev.quando)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PilarPage>
  );
}
