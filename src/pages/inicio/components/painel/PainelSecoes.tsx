import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { statusBadgeClasses, statusLabel } from "@/lib/status";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import {
  BarrasDivergentes,
  BarrasHorizontais,
  CargaPorPessoa,
  LegendaPainel,
  SemaforoPrazo,
  type BarraItem,
} from "./PainelPrimitivas";
import { ConversaoMensalChart, PontualidadeChart, ThroughputChart } from "./PainelCharts";

/**
 * As três seções do painel de gestão (SPEC 092): comercial, entrega e
 * produtividade. Nenhuma exibe dinheiro, então nenhuma depende de acesso
 * financeiro e todas aparecem igual para qualquer papel (ADR 0037).
 */

export type Cena = "comercial" | "projetos" | "produtividade" | "tudo";

const ROTULO_FUNIL: Record<string, string> = {
  rascunho: "Rascunho, nunca enviada",
  enviada: "Enviada, sem decisão",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

const TONE_FUNIL: Record<string, BarraItem["tone"]> = {
  rascunho: "neutral",
  enviada: "main",
  aceita: "good",
  recusada: "bad",
  expirada: "warn",
};

function Card({
  className,
  titulo,
  sub,
  fase2,
  resumo,
  children,
  leitura,
}: {
  className?: string;
  titulo: string;
  sub?: string;
  fase2?: string;
  resumo?: React.ReactNode;
  children: React.ReactNode;
  leitura?: React.ReactNode;
}) {
  return (
    <article
      className={cn("flex min-w-0 flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm", className)}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-medium tracking-tight">{titulo}</h3>
        {sub && <span className="text-[11.5px] text-muted-foreground">{sub}</span>}
        {fase2 && (
          <span
            title={fase2}
            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            fase 2
          </span>
        )}
      </div>
      {resumo && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border pb-2.5 text-xs text-muted-foreground">
          {resumo}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      {leitura && <p className="mt-auto border-t border-border pt-2.5 text-xs leading-snug text-muted-foreground">{leitura}</p>}
    </article>
  );
}

function TituloSecao({ titulo, pergunta }: { titulo: string; pergunta: string }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">{titulo}</h2>
      <span className="text-[12.5px] text-ink-disabled">{pergunta}</span>
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-1 items-center rounded-xl bg-black/[0.02] px-3 py-6 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export function SecaoComercial({ data }: { data: PainelGestao }) {
  const c = data.comercial;
  const totalPerdas = c.motivosPerda.reduce((s, m) => s + m.n, 0);
  const emAberto = c.funil.filter((f) => f.etapa === "rascunho" || f.etapa === "enviada").reduce((s, f) => s + f.n, 0);
  const decididas = data.ancoras.conversao.decididas;
  const rascunho = c.funil.find((f) => f.etapa === "rascunho")?.n ?? 0;
  const doisMaiores = c.motivosPerda.slice(0, 2);
  const pctDoisMaiores =
    totalPerdas > 0 ? Math.round((doisMaiores.reduce((s, m) => s + m.n, 0) / totalPerdas) * 100) : 0;
  const esperandoMuito = c.esperaProposta
    .filter((e) => e.faixa === "16 a 30 dias" || e.faixa === "Mais de 30 dias")
    .reduce((s, e) => s + e.n, 0);

  return (
    <section aria-label="Comercial">
      <TituloSecao titulo="Comercial" pergunta="estamos vendendo, e o que está nos custando venda?" />
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Card
          className="lg:col-span-5"
          titulo="Funil de propostas"
          sub="últimos 90 dias"
          resumo={
            <>
              <span>
                Em aberto <b className="font-semibold tabular-nums text-ink">{emAberto}</b>
              </span>
              <span>
                Decididas <b className="font-semibold tabular-nums text-ink">{decididas}</b>
              </span>
              <span>
                Conversão{" "}
                <b className="font-semibold tabular-nums text-ink">
                  {data.ancoras.conversao.valor === null ? "sem decisão" : `${data.ancoras.conversao.valor}%`}
                </b>
              </span>
            </>
          }
          leitura={
            rascunho > 0 ? (
              <>
                <b className="font-semibold text-ink">
                  {rascunho} proposta{rascunho === 1 ? "" : "s"} em rascunho
                </b>{" "}
                consumiu hora de orçamento e nunca chegou ao cliente.
              </>
            ) : (
              "Nenhuma proposta parada em rascunho."
            )
          }
        >
          {c.funil.every((f) => f.n === 0) ? (
            <Vazio>Nenhuma proposta criada nos últimos 90 dias.</Vazio>
          ) : (
            <BarrasHorizontais
              itens={c.funil.map((f) => ({
                id: f.etapa,
                nome: ROTULO_FUNIL[f.etapa] ?? f.etapa,
                valor: f.n,
                tone: TONE_FUNIL[f.etapa],
              }))}
            />
          )}
        </Card>

        <Card
          className="lg:col-span-7"
          titulo="Conversão por mês de entrada"
          sub="propostas criadas no mês, por desfecho"
          fase2="Com propostas.decidida_em isto passa a ser a linha do tempo das decisões, e não a coorte de entrada"
          leitura={
            <>
              Cada coluna é a <b className="font-semibold text-ink">coorte do mês</b>: das propostas que entraram
              naquele mês, quantas fecharam. Não é o mês da decisão, porque o schema ainda não registra quando a
              proposta foi decidida.
            </>
          }
        >
          {c.conversaoMensal.every((m) => m.ganhas + m.perdidas === 0) ? (
            <Vazio>Sem proposta decidida nos últimos 12 meses.</Vazio>
          ) : (
            <>
              <ConversaoMensalChart dados={c.conversaoMensal} />
              <LegendaPainel
                itens={[
                  { label: "Ganhas", cls: "bg-chart-success" },
                  { label: "Perdidas", cls: "bg-chart-danger" },
                  { label: "Taxa de conversão", cls: "bg-chart-info", linha: true },
                ]}
              />
            </>
          )}
        </Card>

        <Card
          className="lg:col-span-5"
          titulo="Por que perdemos"
          sub={totalPerdas > 0 ? `${totalPerdas} perdas em 12 meses` : undefined}
          fase2="leads.motivo_perda é texto livre: o painel normaliza o que dá e joga o resto em Outro"
          leitura={
            doisMaiores.length === 2 ? (
              <>
                <b className="font-semibold text-ink">
                  {doisMaiores[0].motivo} e {doisMaiores[1].motivo.toLowerCase()} respondem por {pctDoisMaiores}%
                </b>{" "}
                das perdas.
              </>
            ) : (
              "Exige vocabulário fechado em leads.motivo_perda para o Pareto ficar limpo."
            )
          }
        >
          {c.motivosPerda.length === 0 ? (
            <Vazio>Nenhum lead marcado como perdido nos últimos 12 meses.</Vazio>
          ) : (
            <BarrasHorizontais
              tone="bad"
              itens={c.motivosPerda.map((m) => ({
                id: m.motivo,
                nome: m.motivo,
                valor: m.n,
                detalhe: totalPerdas > 0 ? `${Math.round((m.n / totalPerdas) * 100)}%` : undefined,
              }))}
            />
          )}
        </Card>

        <Card
          className="lg:col-span-3"
          titulo="Quanto tempo na mão do cliente"
          sub={`${data.ancoras.aguardandoCliente.valor} sem decisão`}
          leitura={
            esperandoMuito > 0 ? (
              <>
                <b className="font-semibold text-ink">{esperandoMuito} abertas há mais de 15 dias.</b> É a fila de
                follow-up de hoje. Conta a idade da proposta, não o tempo desde o envio.
              </>
            ) : (
              "Nenhuma proposta esfriando."
            )
          }
        >
          {data.ancoras.aguardandoCliente.valor === 0 ? (
            <Vazio>Nenhuma proposta na mão do cliente agora.</Vazio>
          ) : (
            <BarrasHorizontais
              itens={c.esperaProposta.map((e) => ({
                id: e.faixa,
                nome: e.faixa,
                valor: e.n,
                tone: e.faixa === "Mais de 30 dias" ? "bad" : e.faixa === "16 a 30 dias" ? "warn" : "main",
              }))}
            />
          )}
        </Card>

        <Card
          className="lg:col-span-4"
          titulo="Origem do lead e taxa de ganho"
          sub="volume não é qualidade"
          leitura="Origem com muito volume e pouco ganho é esforço comercial mal alocado."
        >
          {c.origemGanho.length === 0 ? (
            <Vazio>Precisa de pelo menos 2 leads por origem para comparar.</Vazio>
          ) : (
            <BarrasHorizontais
              itens={c.origemGanho.map((o) => ({
                id: o.origem,
                nome: o.origem,
                valor: o.leads,
                detalhe: o.ganhoPct === null ? undefined : `${o.ganhoPct}% ganho`,
              }))}
            />
          )}
        </Card>
      </div>
    </section>
  );
}

export function SecaoProjetos({ data, ocultarNomes }: { data: PainelGestao; ocultarNomes: boolean }) {
  const navigate = useNavigate();
  const e = data.entrega;
  const ativos = e.semaforo.noPrazo + e.semaforo.risco + e.semaforo.estourado + e.semaforo.semPrazo;
  const comHistorico = e.pontualidadeMensal.filter((m) => m.total > 0).length;
  const pior = e.atrasoPorDisciplina[0];

  return (
    <section aria-label="Projetos">
      <TituloSecao titulo="Projetos" pergunta="estamos entregando no prazo, e onde ele quebra?" />
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Card
          className="lg:col-span-4"
          titulo="Prazo dos projetos ativos"
          sub={`${ativos} projeto${ativos === 1 ? "" : "s"}`}
          leitura={
            e.semaforo.semPrazo > 0 ? (
              <>
                <b className="font-semibold text-ink">
                  {e.semaforo.semPrazo} sem data de previsão
                </b>{" "}
                ficam fora de todo cálculo de prazo.
              </>
            ) : (
              "Todo projeto ativo tem data de previsão."
            )
          }
        >
          <SemaforoPrazo
            noPrazo={e.semaforo.noPrazo}
            risco={e.semaforo.risco}
            estourado={e.semaforo.estourado}
            onSelect={() => navigate("/projetos")}
          />
          <div className="flex flex-col">
            {e.statusAtivos.map((s) => (
              <div key={s.status} className="flex items-center gap-2.5 border-b border-border py-1.5 last:border-b-0">
                <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", statusBadgeClasses("projeto", s.status))}>
                  {statusLabel("projeto", s.status)}
                </span>
                <span className="ml-auto text-sm font-semibold tabular-nums">{s.n}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          className="lg:col-span-8"
          titulo="Entregamos no prazo?"
          sub="% dos concluídos, 12 meses"
          fase2="Só é honesto com projetos.data_previsao_original congelada: medido contra o prazo já empurrado, todo atraso desaparece"
          leitura={
            <>
              Medido contra <b className="font-semibold text-ink">data_previsao</b>, que é editável. Enquanto não
              houver baseline congelada, projeto com prazo empurrado conta como entregue no prazo.
            </>
          }
        >
          {comHistorico === 0 ? (
            <Vazio>Nenhum projeto concluído com data de previsão nos últimos 12 meses.</Vazio>
          ) : comHistorico < 3 ? (
            <Vazio>
              Só {comHistorico} mês com projeto concluído. A série fica confiável a partir de 3 meses de
              histórico.
            </Vazio>
          ) : (
            <PontualidadeChart dados={e.pontualidadeMensal} />
          )}
        </Card>

        <Card
          className="lg:col-span-5"
          titulo="Onde o atraso acontece"
          sub="atraso médio por disciplina"
          leitura={
            pior ? (
              <>
                <b className="font-semibold text-ink">
                  {pior.disciplina} atrasa {pior.diasMedio} dia{pior.diasMedio === 1 ? "" : "s"} em média
                </b>{" "}
                em {pior.entregas} entrega{pior.entregas === 1 ? "" : "s"}. Pausa documentada sai da conta.
              </>
            ) : (
              "Pausa documentada sai da conta: parada por pendência do cliente não é atraso da equipe."
            )
          }
        >
          {e.atrasoPorDisciplina.length === 0 ? (
            <Vazio>Nenhuma disciplina concluída com atraso nos últimos 12 meses.</Vazio>
          ) : (
            <BarrasHorizontais
              tone="warn"
              itens={e.atrasoPorDisciplina.map((d) => ({
                id: d.disciplina,
                nome: d.disciplina,
                valor: d.diasMedio,
                detalhe: "dias",
                titulo: `${d.entregas} entrega${d.entregas === 1 ? "" : "s"} com atraso`,
              }))}
            />
          )}
        </Card>

        <Card
          className="lg:col-span-7"
          titulo="Vence nos próximos 15 dias"
          sub="disciplina por disciplina"
          leitura="Disciplina vencida ou vencendo é onde redistribuir trabalho vale mais que cobrar prazo."
        >
          {e.prazos15Dias.length === 0 ? (
            <Vazio>Nenhuma disciplina em aberto vence nos próximos 15 dias.</Vazio>
          ) : (
            <div className="flex flex-col">
              {e.prazos15Dias.map((p) => {
                const texto =
                  p.dias < 0
                    ? `venceu há ${Math.abs(p.dias)} d`
                    : p.dias === 0
                      ? "vence hoje"
                      : `em ${p.dias} d`;
                const nome = ocultarNomes ? p.iniciais : p.responsavel;
                return (
                  <button
                    key={p.disciplinaId}
                    type="button"
                    onClick={() => navigate(`/projetos/${p.projetoId}`)}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-b border-border py-2 text-left last:border-b-0 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                  >
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium",
                        p.dias < 0 ? "bg-danger-soft text-danger-strong" : "bg-info-soft text-info-strong"
                      )}
                    >
                      {p.disciplina}
                    </span>
                    <span className="min-w-0 text-[12.5px] text-ink-soft">
                      <span className="block truncate">{p.projeto}</span>
                      {nome && <small className="block text-[11px] text-muted-foreground">{nome}</small>}
                    </span>
                    <span
                      className={cn(
                        "whitespace-nowrap text-[12.5px] font-semibold tabular-nums",
                        p.dias < 0 ? "text-danger-mid" : p.dias <= 4 ? "text-warning-strong" : ""
                      )}
                    >
                      {texto}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

export function SecaoProdutividade({ data, ocultarNomes }: { data: PainelGestao; ocultarNomes: boolean }) {
  const navigate = useNavigate();
  const p = data.produtividade;
  const media = data.ancoras.concluidasSemana.media;
  const totalAtrasadas = p.cargaEquipe.reduce((s, x) => s + x.atrasada, 0);
  const maisCarregado = [...p.cargaEquipe].sort((a, b) => b.atrasada - a.atrasada)[0];
  const maisAntiga = p.filaAprovacao[0];
  const piorHoras = p.horasPorProjeto.find((h) => (h.desvioPct ?? 0) > 0);

  return (
    <section aria-label="Produtividade">
      <TituloSecao titulo="Produtividade" pergunta="o escritório está rendendo, e quem está sobrecarregado?" />
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <Card
          className="lg:col-span-7"
          titulo="Ritmo de entrega"
          sub="tarefas concluídas por semana, 12 semanas"
          leitura="Barra em âmbar é semana abaixo da média do período."
        >
          {p.throughputSemanal.every((s) => s.n === 0) ? (
            <Vazio>Nenhuma tarefa concluída nas últimas 12 semanas.</Vazio>
          ) : (
            <ThroughputChart dados={p.throughputSemanal} media={media} />
          )}
        </Card>

        <Card
          className="lg:col-span-5"
          titulo="Horas: estimado contra real"
          sub="projetos mais distantes do orçado"
          leitura={
            piorHoras ? (
              <>
                <b className="font-semibold text-ink">
                  {piorHoras.projeto} consumiu {Math.round(piorHoras.realizadas - piorHoras.estimadas)} h além do
                  estimado.
                </b>{" "}
                Quem está à direita já gastou a folga antes de entregar.
              </>
            ) : (
              "Nenhum projeto ativo passou das horas estimadas."
            )
          }
        >
          {p.horasPorProjeto.length === 0 ? (
            <Vazio>Nenhum projeto ativo tem horas estimadas nas disciplinas.</Vazio>
          ) : (
            <BarrasDivergentes
              itens={p.horasPorProjeto.map((h) => ({
                id: h.projetoId,
                nome: h.projeto,
                pct: h.desvioPct ?? 0,
                titulo: `${h.estimadas} h estimadas, ${h.realizadas} h lançadas`,
              }))}
            />
          )}
        </Card>

        <Card
          className="lg:col-span-5"
          titulo="Carga da equipe"
          sub="disciplinas abertas por pessoa"
          leitura={
            maisCarregado && maisCarregado.atrasada > 0 ? (
              <>
                <b className="font-semibold text-ink">
                  {ocultarNomes ? maisCarregado.iniciais : maisCarregado.nome} acumula {maisCarregado.atrasada} das{" "}
                  {totalAtrasadas} disciplinas atrasadas.
                </b>{" "}
                Em modo TV o painel troca nome por iniciais.
              </>
            ) : (
              "Em modo TV o painel troca nome por iniciais."
            )
          }
        >
          {p.cargaEquipe.length === 0 ? (
            <Vazio>Nenhuma disciplina aberta com responsável definido.</Vazio>
          ) : (
            <>
              <CargaPorPessoa itens={p.cargaEquipe} ocultarNomes={ocultarNomes} />
              <LegendaPainel
                itens={[
                  { label: "Em dia", cls: "bg-chart-info" },
                  { label: "Atrasada", cls: "bg-negative" },
                ]}
              />
            </>
          )}
        </Card>

        <Card
          className="lg:col-span-7"
          titulo="Esperando aprovação"
          sub={p.filaAprovacao.length > 0 ? `${p.filaAprovacao.length} escopo${p.filaAprovacao.length === 1 ? "" : "s"} e aditivo${p.filaAprovacao.length === 1 ? "" : "s"}` : undefined}
          leitura={
            maisAntiga ? (
              <>
                <b className="font-semibold text-ink">
                  A mais antiga espera há {maisAntiga.dias} dia{maisAntiga.dias === 1 ? "" : "s"}.
                </b>{" "}
                Escopo sem aprovação é trabalho andando sem cobertura.
              </>
            ) : (
              "Escopo sem aprovação é trabalho andando sem cobertura."
            )
          }
        >
          {p.filaAprovacao.length === 0 ? (
            <Vazio>Nada esperando aprovação.</Vazio>
          ) : (
            <div className="flex flex-col">
              {p.filaAprovacao.map((a) => (
                <button
                  key={a.escopoId}
                  type="button"
                  onClick={() => navigate(`/projetos/${a.projetoId}`)}
                  className="grid grid-cols-[auto_1fr] items-center gap-2.5 border-b border-border py-2 text-left last:border-b-0 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                >
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      a.dias > 15 ? "bg-danger-soft text-danger-strong" : a.dias > 7 ? "bg-warning-soft text-warning-strong" : "bg-info-soft text-info-strong"
                    )}
                  >
                    {a.dias} d
                  </span>
                  <span className="min-w-0 truncate text-[12.5px] text-ink-soft">
                    {a.tipo === "aditivo" ? "Aditivo" : "Escopo original"}, {a.projeto}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
