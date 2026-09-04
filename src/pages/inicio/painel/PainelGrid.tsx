import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Pin, PinOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { LIMITE_FIXOS, LIMITE_WIDGETS, type ItemLayout, type Tamanho } from "@/hooks/usePainelLayout";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import { sobraDaLinha } from "./grade";
import { SeletorWidget } from "./SeletorWidget";
import {
  CATALOGO,
  COLUNAS,
  LARGURA,
  PODE_FIXAR,
  POR_ID,
  ROTULO_TAMANHO,
  SECOES,
  type Secao,
} from "./catalogo";

/**
 * Grade do painel e o modo de personalizar (ADR 0038).
 *
 * Três decisões que vieram de olhar a tela renderizada:
 *
 * 1. **Faixa fixa no topo.** Os widgets de contagem viram uma dock: ficam
 *    grudados abaixo do header e acompanham a rolagem, então o número que
 *    importa não sai da tela quando se desce até o último gráfico.
 * 2. **A grade é agrupada por módulo**, e o título do módulo só aparece se
 *    houver widget dele. Painel sem nada de Obras não mostra "Obras".
 * 3. **O buraco da última linha é preenchido.** Uma linha de 12 colunas com
 *    dois widgets de 4 deixava 4 colunas mortas; agora o cartão "Adicionar
 *    widget" ocupa exatamente o que sobrou, e em leitura o último widget da
 *    linha cresce para fechar a linha.
 */

type Props = {
  data: PainelGestao;
  layout: ItemLayout[];
  editando: boolean;
  salvando: boolean;
  onEditar: (v: boolean) => void;
  onSalvar: (layout: ItemLayout[]) => Promise<unknown>;
  onRestaurar: () => Promise<unknown>;
};

function Card({
  titulo,
  fase2,
  children,
  leitura,
  className,
  cabecalho,
  compacto,
}: {
  titulo: string;
  fase2?: string;
  children: React.ReactNode;
  leitura?: React.ReactNode;
  className?: string;
  cabecalho?: React.ReactNode;
  compacto?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm",
        // Widget sem dado não merece meia tela de altura só para dizer que não
        // tem dado: ele encolhe e para de furar a grade.
        compacto ? "h-auto" : "h-full",
        className
      )}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-medium tracking-tight">{titulo}</h3>
        {fase2 && (
          <span
            title={fase2}
            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            fase 2
          </span>
        )}
        {cabecalho && <div className="ml-auto flex items-center gap-1">{cabecalho}</div>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      {leitura && (
        <p className="mt-auto border-t border-border pt-2.5 text-xs leading-snug text-muted-foreground">{leitura}</p>
      )}
    </article>
  );
}

/** Largura extra para o último widget fechar a linha, em vez de deixar buraco. */
function fecharLinha(itens: ItemLayout[]): (Tamanho | "resto")[] {
  const saida: (Tamanho | "resto")[] = [];
  let naLinha = 0;
  itens.forEach((item, i) => {
    const col = COLUNAS[item.s];
    const proximo = itens[i + 1];
    naLinha += col;
    const ultimoDaLinha = !proximo || naLinha + COLUNAS[proximo.s] > 12;
    if (ultimoDaLinha && naLinha < 12 && naLinha > 0) {
      saida.push("resto");
      naLinha = 0;
    } else {
      saida.push(item.s);
      if (naLinha >= 12) naLinha = 0;
    }
  });
  return saida;
}

const LARGURA_RESTO = "lg:col-span-full";

/**
 * Classe por número de colunas restantes. Mapa estático de propósito: o
 * Tailwind não gera CSS para classe montada em runtime (`col-span-${n}`), então
 * interpolar aqui faria o cartão perder a largura sem erro nenhum.
 */
const LARGURA_SOBRA: Record<number, string> = {
  0: "lg:col-span-4",
  1: "lg:col-span-11",
  2: "lg:col-span-10",
  3: "lg:col-span-9",
  4: "lg:col-span-8",
  5: "lg:col-span-7",
  6: "lg:col-span-6",
  7: "lg:col-span-5",
  8: "lg:col-span-4",
  9: "lg:col-span-3",
  10: "lg:col-span-2",
  11: "lg:col-span-1",
};

/** Colunas ocupadas na última linha da seção, para o cartão de adicionar caber nela. */
export function PainelGrid({ data, layout, editando, salvando, onEditar, onSalvar, onRestaurar }: Props) {
  const { can } = usePermissions();
  const [rascunho, setRascunho] = useState<ItemLayout[]>(layout);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [secaoAlvo, setSecaoAlvo] = useState<Secao | null>(null);

  const atual = editando ? rascunho : layout;

  const permitido = (item: ItemLayout) => {
    const w = POR_ID.get(item.w);
    return Boolean(w && (w.feature === null || can(w.feature)));
  };

  const fixos = atual.filter((i) => i.z === "topo" && permitido(i));
  const naGrade = atual.filter((i) => i.z !== "topo" && permitido(i));

  /** Grade agrupada por módulo. Seção sem widget não entra. */
  const grupos = useMemo(
    () =>
      SECOES.map((secao) => ({
        ...secao,
        itens: naGrade.filter((i) => POR_ID.get(i.w)?.secao === secao.key),
      })).filter((g) => g.itens.length > 0 || (editando && secaoAlvo === g.key)),
    [naGrade, editando, secaoAlvo]
  );

  const indiceReal = (item: ItemLayout) => atual.findIndex((x) => x === item);

  const entrarEdicao = () => {
    setRascunho(layout);
    onEditar(true);
  };
  const cancelar = () => {
    setRascunho(layout);
    setSeletorAberto(false);
    onEditar(false);
  };
  const salvar = async () => {
    await onSalvar(rascunho);
    setSeletorAberto(false);
    onEditar(false);
  };

  const trocar = (item: ItemLayout, mudanca: Partial<ItemLayout>) =>
    setRascunho((prev) => prev.map((x) => (x === item ? { ...x, ...mudanca } : x)));
  const remover = (item: ItemLayout) => setRascunho((prev) => prev.filter((x) => x !== item));

  const adicionar = (id: string) => {
    const w = POR_ID.get(id);
    if (!w || rascunho.length >= LIMITE_WIDGETS) return;
    setRascunho((prev) => [...prev, { w: id, s: w.padrao }]);
  };

  const fixar = (item: ItemLayout) => {
    if (item.z === "topo") {
      trocar(item, { z: undefined });
      return;
    }
    if (fixos.length >= LIMITE_FIXOS) return;
    trocar(item, { z: "topo" });
  };

  /** Arrasto reordena DENTRO da seção: o item não pula de módulo sozinho. */
  const mover = (r: DropResult) => {
    if (!r.destination) return;
    const grupo = grupos.find((g) => g.key === r.source.droppableId);
    if (!grupo) return;
    const itemMovido = grupo.itens[r.source.index];
    const alvo = grupo.itens[r.destination.index];
    if (!itemMovido || !alvo || itemMovido === alvo) return;

    setRascunho((prev) => {
      const proximo = [...prev];
      const de = proximo.indexOf(itemMovido);
      const para = proximo.indexOf(alvo);
      proximo.splice(de, 1);
      proximo.splice(para, 0, itemMovido);
      return proximo;
    });
  };

  const disponiveis = CATALOGO.filter((w) => w.feature === null || can(w.feature));
  const jaUsados = new Set(rascunho.map((i) => i.w));

  const abrirSeletor = (secao: Secao | null) => {
    setSecaoAlvo(secao);
    setSeletorAberto(true);
  };

  const controles = (item: ItemLayout, w: NonNullable<ReturnType<typeof POR_ID.get>>, drag: { dragHandleProps: unknown }) => (
    <>
      {PODE_FIXAR.has(w.id) && (
        <button
          type="button"
          onClick={() => fixar(item)}
          title={item.z === "topo" ? "Soltar da faixa fixa" : "Fixar no topo"}
          aria-label={item.z === "topo" ? `Soltar ${w.titulo} da faixa fixa` : `Fixar ${w.titulo} no topo`}
          className="rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-ink"
        >
          {item.z === "topo" ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      )}
      {item.z !== "topo" && (
        <select
          aria-label={`Tamanho de ${w.titulo}`}
          value={item.s}
          onChange={(e) => trocar(item, { s: e.target.value as Tamanho })}
          className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[11px] text-ink-soft"
        >
          {w.tamanhos.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TAMANHO[t]}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => remover(item)}
        aria-label={`Remover ${w.titulo}`}
        className="rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-danger-mid"
      >
        <Trash2 size={14} />
      </button>
      <span
        {...(drag.dragHandleProps as object)}
        aria-label={`Mover ${w.titulo}`}
        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-ink"
      >
        <GripVertical size={14} />
      </span>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Ações do painel: acima dos KPIs, para não empurrar a leitura ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editando ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onRestaurar().then(() => onEditar(false))}
              disabled={salvando}
            >
              <RotateCcw size={14} /> Restaurar padrão
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelar} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="brand" size="sm" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar painel"}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={entrarEdicao}>
            Personalizar
          </Button>
        )}
      </div>

      {/* ── Faixa de KPIs: primeira coisa da página, e não grudada ────────
       * O sticky saiu: ao rolar, ela flutuava sobre o seletor de widget e
       * cobria a lista, o que era pior que perder os números de vista. */}
      {fixos.length > 0 && (
        <section
          aria-label="Indicadores fixos"
          className={cn(editando && "rounded-2xl border border-dashed border-brand/60 p-2")}
        >
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
            {fixos.map((item) => {
              const w = POR_ID.get(item.w)!;
              return (
                <div key={`fixo-${item.w}`} className={LARGURA[item.s]}>
                  <Card
                    titulo={w.titulo}
                    cabecalho={
                      editando ? (
                        <>
                          <button
                            type="button"
                            onClick={() => fixar(item)}
                            aria-label={`Soltar ${w.titulo} da faixa fixa`}
                            className="rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-ink"
                          >
                            <PinOff size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => remover(item)}
                            aria-label={`Remover ${w.titulo}`}
                            className="rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-danger-mid"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : undefined
                    }
                  >
                    {w.render(data)}
                  </Card>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SeletorWidget
        aberto={editando && seletorAberto}
        onFechar={() => setSeletorAberto(false)}
        secaoInicial={secaoAlvo}
        jaNoPainel={jaUsados}
        podeAdicionar={rascunho.length < LIMITE_WIDGETS}
        can={can}
        onAdicionar={adicionar}
      />

      {/* ── Grade, agrupada por módulo ───────────────────────────────────── */}
      {grupos.length === 0 && fixos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/15 bg-white px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum indicador no painel.{" "}
          {editando ? "Use Adicionar widget." : "Clique em Personalizar para escolher os seus."}
        </p>
      ) : (
        <DragDropContext onDragEnd={mover}>
          <div className="flex flex-col gap-6">
            {grupos.map((grupo) => {
              const larguras = fecharLinha(grupo.itens);
              const sobra = sobraDaLinha(grupo.itens);

              return (
                <section key={grupo.key} aria-label={grupo.label}>
                  <div className="mb-2.5 flex items-baseline gap-2.5">
                    <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                      {grupo.label}
                    </h2>
                    <span className="text-[11.5px] text-ink-disabled">
                      {grupo.itens.length} indicador{grupo.itens.length === 1 ? "" : "es"}
                    </span>
                  </div>

                  <Droppable droppableId={grupo.key} isDropDisabled={!editando} direction="horizontal">
                    {(drop) => (
                      <div
                        ref={drop.innerRef}
                        {...drop.droppableProps}
                        className="grid grid-cols-1 gap-2.5 lg:grid-cols-12"
                      >
                        {grupo.itens.map((item, i) => {
                          const w = POR_ID.get(item.w)!;
                          const largura = larguras[i] === "resto" ? LARGURA_RESTO : LARGURA[largura_de(larguras, i)];
                          return (
                            <Draggable
                              key={`${item.w}-${indiceReal(item)}`}
                              draggableId={`${item.w}-${indiceReal(item)}`}
                              index={i}
                              isDragDisabled={!editando}
                            >
                              {(drag, snapshot) => (
                                <div
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  className={cn(largura, snapshot.isDragging && "opacity-90")}
                                >
                                  <Card
                                    titulo={w.titulo}
                                    fase2={w.fase2}
                                    leitura={editando ? undefined : w.leitura?.(data)}
                                    className={editando ? "ring-1 ring-brand/40" : undefined}
                                    cabecalho={editando ? controles(item, w, drag) : undefined}
                                  >
                                    {w.render(data)}
                                  </Card>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {drop.placeholder}

                        {/* Cartão de adicionar: ocupa o buraco que sobrou na linha. */}
                        {editando && (
                          <div className={LARGURA_SOBRA[sobra] ?? "lg:col-span-4"}>
                            <button
                              type="button"
                              onClick={() => abrirSeletor(grupo.key)}
                              className="flex h-full min-h-[132px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-info-mid/40 bg-info-soft/60 text-sm text-info-strong transition-colors hover:bg-info-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              <Plus size={18} />
                              Adicionar widget
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </section>
              );
            })}

            {/* Seção que ainda não tem widget nenhum: um convite discreto. */}
            {editando && (
              <div className="flex flex-wrap gap-2">
                {SECOES.filter(
                  (s) =>
                    (s.feature === null || can(s.feature)) &&
                    !grupos.some((g) => g.key === s.key) &&
                    disponiveis.some((w) => w.secao === s.key)
                ).map((s) => (
                  <Button key={s.key} variant="outline" size="sm" onClick={() => abrirSeletor(s.key)}>
                    <Plus size={14} /> {s.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

/** Tamanho declarado do item, quando ele não é o que fecha a linha. */
function largura_de(larguras: (Tamanho | "resto")[], i: number): Tamanho {
  const v = larguras[i];
  return v === "resto" ? "meia" : v;
}

export type { Secao };
