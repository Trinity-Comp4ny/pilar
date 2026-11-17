import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import {
  lerPercentual,
  percentualDe,
  valorDaColuna,
  type ColunaGrade,
  type FisicoFinanceiro,
  type LinhaFF,
  type MesChave,
} from "@/pages/obras/lib/fisicoFinanceiro";
import { NIVEL_COR, NIVEL_NOME } from "./cronograma/estado";

interface Props {
  ff: FisicoFinanceiro;
  colunas: ColunaGrade[];
  recolhidos: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** Edição de célula ligada (pessoa pode editar e a escala é mensal). */
  editavel?: boolean;
  /** Grava o percentual de um mês de um nó; a tela decide como (hook, erro, aviso). */
  onSalvarCelula?: (linha: LinhaFF, mes: MesChave, percentual: number) => void;
  /** Apaga o ajuste manual do nó: a linha volta a seguir o cronograma. */
  onVoltarAutomatico?: (linha: LinhaFF) => void;
  /** Há uma gravação em andamento. */
  ocupado?: boolean;
}

/** 51.6 → "51,6%" */
const pct = (v: number): string => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const COL_NOME = "min-w-[220px] max-w-[320px]";
const COL_VALOR = "min-w-[104px]";

/** Linhas visíveis em ordem de leitura: some tudo que está sob um nó recolhido. */
function linhasVisiveis(linhas: ReadonlyArray<LinhaFF>, recolhidos: ReadonlySet<string>): LinhaFF[] {
  const escondidos = new Set<string>();
  const saida: LinhaFF[] = [];
  for (const l of linhas) {
    if (l.parentId && (recolhidos.has(l.parentId) || escondidos.has(l.parentId))) {
      escondidos.add(l.id);
      continue;
    }
    saida.push(l);
  }
  return saida;
}

function Celula({ valor, previsto }: { valor: number; previsto: number }) {
  const formatCurrency = useMoneyMask();
  if (valor <= 0) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className="block leading-tight">
      <span className="block text-xs font-semibold tabular-nums text-ink">{pct(percentualDe(valor, previsto))}</span>
      <span className="block text-[11px] tabular-nums text-muted-foreground">{formatCurrency(valor)}</span>
    </span>
  );
}

/** Célula de um mês editável: mostra % e R$; clicar abre o campo de percentual (Enter grava, Esc cancela). */
function CelulaEditavel({
  linha,
  mes,
  rotulo,
  onSalvar,
}: {
  linha: LinhaFF;
  mes: MesChave;
  rotulo: string;
  onSalvar: (linha: LinhaFF, mes: MesChave, percentual: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [invalido, setInvalido] = useState(false);
  const valor = linha.porMes[mes] ?? 0;
  const exato = linha.previsto > 0 ? (valor / linha.previsto) * 100 : 0;

  const abrir = () => {
    setRascunho(String(percentualDe(valor, linha.previsto)).replace(".", ","));
    setInvalido(false);
    setEditando(true);
  };

  const confirmar = (aoSair: boolean) => {
    const n = lerPercentual(rascunho);
    if (n == null) {
      // Valor inválido: no Enter fica aberto avisando; ao sair do campo, descarta.
      if (aoSair) setEditando(false);
      else setInvalido(true);
      return;
    }
    setEditando(false);
    // O que está na tela tem uma casa; só grava se mudou de verdade (mexer sem mudar não deixa o nó manual).
    if (Math.abs(n - exato) >= 0.05) onSalvar(linha, mes, n);
  };

  if (editando) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        value={rascunho}
        onChange={(e) => {
          setRascunho(e.target.value);
          setInvalido(false);
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => confirmar(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar(false);
          if (e.key === "Escape") setEditando(false);
        }}
        aria-label={`Percentual de ${linha.nome} em ${rotulo}`}
        aria-invalid={invalido}
        className={cn(
          "h-8 w-16 rounded-md border bg-white px-2 text-right text-xs tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          invalido ? "border-negative" : "border-input"
        )}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label={`Editar percentual de ${linha.nome} em ${rotulo}`}
      className="-my-1 ml-auto block min-w-[64px] rounded-md px-1.5 py-1 text-right hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Celula valor={valor} previsto={linha.previsto} />
    </button>
  );
}

/**
 * Grade do físico-financeiro (spec 165): a árvore do orçado nas linhas, os meses (ou trimestres) nas colunas e, em
 * cada célula, o percentual do previsto do item e o valor em R$. Com `editavel`, o percentual de cada mês de um
 * item com valor próprio se ajusta à mão.
 */
export function FisicoFinanceiroGrade({
  ff,
  colunas,
  recolhidos,
  onToggle,
  editavel = false,
  onSalvarCelula,
  onVoltarAutomatico,
  ocupado = false,
}: Props) {
  const formatCurrency = useMoneyMask();
  const visiveis = useMemo(() => linhasVisiveis(ff.linhas, recolhidos), [ff.linhas, recolhidos]);
  const temFilhos = useMemo(
    () => new Set(ff.linhas.map((l) => l.parentId).filter((p): p is string => !!p)),
    [ff.linhas]
  );
  const temSemData = ff.semData.valor > 0;

  const noMes = colunas.map((c) => valorDaColuna(ff.totalPorMes, c));
  const acumuladoPorColuna: number[] = [];
  noMes.reduce((soma, v) => {
    const novo = Math.round((soma + v) * 100) / 100;
    acumuladoPorColuna.push(novo);
    return novo;
  }, 0);

  return (
    <div
      className={cn("overflow-x-auto rounded-2xl border border-black/5 bg-white", ocupado && "opacity-60")}
      aria-busy={ocupado}
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Desembolso previsto por período, por fase, etapa e serviço</caption>
        <thead>
          <tr className="border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th scope="col" className={cn("sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left", COL_NOME)}>
              Fase / etapa / serviço
            </th>
            <th scope="col" className={cn("px-3 py-2 text-right", COL_VALOR)}>
              Previsto
            </th>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className={cn("px-3 py-2 text-right", COL_VALOR)}>
                {c.rotulo}
              </th>
            ))}
            {temSemData && (
              <th scope="col" className={cn("px-3 py-2 text-right", COL_VALOR)}>
                Sem data
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {visiveis.map((l) => {
            const aberto = !recolhidos.has(l.id);
            const filhos = temFilhos.has(l.id);
            const detalhe = !l.contaNoTotal;
            return (
              <tr
                key={l.id}
                data-testid={`ff-${l.id}`}
                className={cn(
                  "border-b align-middle",
                  l.nivel === "fase" && "bg-muted/40",
                  detalhe && "text-muted-foreground"
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 border-l-4 px-3 py-1.5 text-left font-normal",
                    l.nivel === "fase" ? "bg-muted" : "bg-white",
                    COL_NOME
                  )}
                  style={{ borderLeftColor: NIVEL_COR[l.nivel] }}
                >
                  <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: l.profundidade * 14 }}>
                    <button
                      type="button"
                      onClick={() => onToggle(l.id)}
                      disabled={!filhos}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-25"
                      aria-label={aberto ? `Recolher ${l.nome}` : `Expandir ${l.nome}`}
                    >
                      {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-sm",
                          l.nivel === "fase" ? "font-semibold" : "font-medium",
                          !detalhe && "text-ink"
                        )}
                        title={`${NIVEL_NOME[l.nivel]}: ${l.caminho}`}
                      >
                        {l.nome}
                      </p>
                      {detalhe && <p className="text-[10px]">detalhe, não soma de novo</p>}
                      {l.manual && (
                        <p className="text-[10px] font-medium text-info-mid">
                          Manual
                          {l.faltaPct != null && Math.abs(l.faltaPct) > 0.05 && (
                            <span className="text-danger-strong">
                              {l.faltaPct > 0
                                ? ` · faltam ${l.faltaPct.toLocaleString("pt-BR")}%`
                                : ` · passou ${Math.abs(l.faltaPct).toLocaleString("pt-BR")}%`}
                            </span>
                          )}
                        </p>
                      )}
                      {l.manual && editavel && onVoltarAutomatico && (
                        <p className="text-[10px]">
                          {l.datasMudaram && (
                            <span className="text-danger-strong">
                              O planejamento é manual e não acompanha as datas.{" "}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onVoltarAutomatico(l)}
                            className="underline hover:text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {l.datasMudaram ? "Redistribuir" : "Voltar ao automático"}
                          </button>
                        </p>
                      )}
                    </div>
                  </div>
                </th>
                <td className={cn("px-3 py-1.5 text-right text-xs tabular-nums", detalhe ? "" : "text-ink")}>
                  {l.previsto > 0 ? formatCurrency(l.previsto) : "—"}
                </td>
                {colunas.map((c) => (
                  <td key={c.chave} className="px-3 py-1.5 text-right">
                    {editavel && onSalvarCelula && l.distribuivel ? (
                      <CelulaEditavel linha={l} mes={c.meses[0]} rotulo={c.rotulo} onSalvar={onSalvarCelula} />
                    ) : (
                      <Celula valor={valorDaColuna(l.porMes, c)} previsto={l.previsto} />
                    )}
                  </td>
                ))}
                {temSemData && (
                  <td className="px-3 py-1.5 text-right text-xs tabular-nums">
                    {l.semData > 0 ? formatCurrency(l.semData) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/20 text-xs font-semibold">
            <th scope="row" className={cn("sticky left-0 z-10 bg-muted px-3 py-2 text-left", COL_NOME)}>
              No período
            </th>
            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(ff.totalPrevisto)}</td>
            {colunas.map((c, i) => (
              <td key={c.chave} className="px-3 py-2 text-right tabular-nums">
                {formatCurrency(noMes[i])}
              </td>
            ))}
            {temSemData && <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(ff.semData.valor)}</td>}
          </tr>
          <tr className="border-t bg-muted/20 text-xs font-semibold">
            <th scope="row" className={cn("sticky left-0 z-10 bg-muted px-3 py-2 text-left", COL_NOME)}>
              Acumulado
            </th>
            <td />
            {colunas.map((c, i) => (
              <td key={c.chave} className="px-3 py-2 text-right">
                <span className="block tabular-nums">{pct(percentualDe(acumuladoPorColuna[i], ff.totalPrevisto))}</span>
                <span className="block text-[11px] font-normal tabular-nums text-muted-foreground">
                  {formatCurrency(acumuladoPorColuna[i])}
                </span>
              </td>
            ))}
            {temSemData && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
