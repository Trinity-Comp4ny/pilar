import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Feature } from "@/lib/permissions";
import { CATALOGO, SECOES, type Widget } from "./catalogo";
import { DADOS_EXEMPLO } from "./exemplo";

/**
 * Seletor de widget, em duas etapas (SPEC 092).
 *
 * Etapa 1 lista o catálogo por módulo; etapa 2 mostra o indicador montado, do
 * jeito que ele vai aparecer no painel, e só então oferece adicionar.
 *
 * O preview usa dados de exemplo, não os da empresa, e o dialog diz isso. Com
 * dado real, um indicador que a empresa ainda não alimenta (obra sem RDO,
 * projeto sem orçamento) apareceria vazio justamente na hora de escolher, e o
 * usuário não veria o que está escolhendo.
 *
 * Montado sobre o `Dialog` cru em vez do `FormDialog`, que é o caso previsto no
 * design system: preview e wizard não são formulário. Largura `lg` (max-w-3xl),
 * o teto da escala.
 */

type Props = {
  aberto: boolean;
  onFechar: () => void;
  /** Módulo pré-selecionado, quando o usuário clicou no cartão de uma seção. */
  secaoInicial?: string | null;
  jaNoPainel: Set<string>;
  podeAdicionar: boolean;
  can: (f: Feature) => boolean;
  onAdicionar: (id: string) => void;
};

export function SeletorWidget({
  aberto,
  onFechar,
  secaoInicial,
  jaNoPainel,
  podeAdicionar,
  can,
  onAdicionar,
}: Props) {
  const [preview, setPreview] = useState<Widget | null>(null);

  const disponiveis = useMemo(() => CATALOGO.filter((w) => w.feature === null || can(w.feature)), [can]);

  const grupos = useMemo(() => {
    const ordenadas = secaoInicial
      ? [...SECOES].sort((a, b) => (a.key === secaoInicial ? -1 : b.key === secaoInicial ? 1 : 0))
      : SECOES;
    return ordenadas
      .map((secao) => ({ ...secao, itens: disponiveis.filter((w) => w.secao === secao.key) }))
      .filter((g) => g.itens.length > 0);
  }, [disponiveis, secaoInicial]);

  const fechar = () => {
    setPreview(null);
    onFechar();
  };

  const adicionar = (w: Widget) => {
    onAdicionar(w.id);
    setPreview(null);
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? undefined : fechar())}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        {preview ? (
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="border-b border-border px-5 py-4 text-left">
              <DialogTitle className="text-base">{preview.titulo}</DialogTitle>
              <DialogDescription className="text-[12.5px]">{preview.descricao}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto bg-black/[0.02] p-5">
              <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-medium tracking-tight">{preview.titulo}</h3>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    exemplo
                  </span>
                </div>
                <div className="flex flex-col gap-3">{preview.render(DADOS_EXEMPLO)}</div>
                {preview.leitura?.(DADOS_EXEMPLO) && (
                  <p className="mt-3 border-t border-border pt-2.5 text-xs leading-snug text-muted-foreground">
                    {preview.leitura(DADOS_EXEMPLO)}
                  </p>
                )}
              </div>
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Números de exemplo, para você ver o formato. No painel, o indicador usa os dados da sua
                empresa.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setPreview(null)}>
                <ArrowLeft size={14} /> Voltar
              </Button>
              <Button
                variant="brand"
                size="sm"
                disabled={jaNoPainel.has(preview.id) || !podeAdicionar}
                onClick={() => adicionar(preview)}
              >
                <Plus size={14} />
                {jaNoPainel.has(preview.id) ? "Já está no painel" : "Adicionar ao painel"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="border-b border-border px-5 py-4 text-left">
              <DialogTitle className="text-base">Adicionar widget</DialogTitle>
              <DialogDescription className="text-[12.5px]">
                Escolha um indicador para ver o formato antes de colocar no painel.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-5">
                {grupos.map((grupo) => (
                  <div key={grupo.key}>
                    <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                      {grupo.label}
                    </h4>
                    <div className="flex flex-col divide-y divide-border rounded-xl border border-black/10">
                      {grupo.itens.map((w) => {
                        const usado = jaNoPainel.has(w.id);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setPreview(w)}
                            className={cn(
                              "flex items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
                              usado && "opacity-60"
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                                {w.titulo}
                                {usado && (
                                  <span className="text-[10px] font-normal text-muted-foreground">no painel</span>
                                )}
                              </span>
                              <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                                {w.descricao}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-info-mid">
                              Ver preview
                              <ChevronRight size={14} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
