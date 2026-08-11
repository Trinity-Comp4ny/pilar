import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronDown, ChevronRight, ExternalLink, Loader2, Pencil, Plus, Sparkles, Trash2, Trophy, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { menorValorProposta, nomeFornecedorProposta } from "@/lib/obras";
import {
  useSaveProposta,
  useDeleteProposta,
  useDecidirCotacao,
  useReabrirCotacao,
  useImportarOrcamento,
  useSalvarPropostasEmLote,
  type CotacaoComPropostas,
  type PropostaComFornecedor,
  type PropostaItemInput,
  type PropostaComparativa,
} from "@/hooks/useObraCotacoes";

const OUTRO = "__outro__";
const hoje = () => new Date().toISOString().slice(0, 10);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  cotacao: CotacaoComPropostas;
  canEdit: boolean;
}

/** Detalhe da cotação: compara propostas lado a lado, adiciona novas e decide a vencedora. */
export function CotacaoDetailDialog({ open, onOpenChange, obraId, cotacao, canEdit }: Props) {
  const [propostaForm, setPropostaForm] = useState<{ proposta?: PropostaComFornecedor | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<PropostaComFornecedor | null>(null);
  const [decisao, setDecisao] = useState<PropostaComFornecedor | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  const del = useDeleteProposta(obraId);
  const reabrir = useReabrirCotacao(obraId);

  const propostas = cotacao.propostas;
  const menor = useMemo(() => menorValorProposta(propostas), [propostas]);
  const decidida = cotacao.status === "decidida";
  const editavel = canEdit && cotacao.status === "aberta";

  const subtitulo = [
    cotacao.quantidade != null && `${cotacao.quantidade}${cotacao.unidade ? ` ${cotacao.unidade}` : ""}`,
    cotacao.prazo_necessidade && `precisa até ${formatDate(cotacao.prazo_necessidade)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{cotacao.descricao}</span>
            <StatusBadge domain="cotacao" status={cotacao.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {(subtitulo || cotacao.observacoes) && (
            <div className="text-sm text-muted-foreground">
              {subtitulo && <p>{subtitulo}</p>}
              {cotacao.observacoes && <p className="mt-0.5">{cotacao.observacoes}</p>}
            </div>
          )}

          {editavel && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setPropostaForm({})}>
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar proposta
              </Button>
              <AnalisarOrcamentoButton obraId={obraId} cotacaoId={cotacao.id} contexto={cotacao.descricao} />
            </div>
          )}

          {propostas.length === 0 ? (
            <EmptyState
              title="Nenhuma proposta ainda"
              description="Adicione o preço de cada fornecedor para comparar e escolher."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-normal">Fornecedor</th>
                    <th className="pb-2 text-right font-normal">Valor</th>
                    <th className="pb-2 text-right font-normal">Prazo</th>
                    <th className="pb-2 font-normal">Pagamento</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {propostas.map((p) => {
                    const valor = Number(p.valor);
                    const isMenor = menor != null && valor === menor;
                    const isVencedora = cotacao.proposta_vencedora_id === p.id;
                    const temItens = p.itens.length > 0;
                    const aberta = expandida === p.id;
                    return (
                    <Fragment key={p.id}>
                      <tr className={isVencedora ? "bg-positive/5" : undefined}>
                        <td className="py-2 pr-2">
                          <span className="inline-flex items-center gap-1.5 text-ink">
                            {isVencedora && <Trophy className="h-3.5 w-3.5 text-positive-strong" />}
                            {temItens && (
                              <button
                                type="button"
                                className="inline-flex text-muted-foreground hover:text-ink"
                                onClick={() => setExpandida(aberta ? null : p.id)}
                                title={aberta ? "Ocultar itens" : `Ver ${p.itens.length} itens`}
                              >
                                {aberta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {nomeFornecedorProposta(p)}
                          </span>
                          {temItens && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {p.itens.length} {p.itens.length === 1 ? "item" : "itens"}
                            </span>
                          )}
                          {!temItens && (p.quantidade != null || p.unidade) && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {[p.quantidade, p.unidade].filter((x) => x != null && x !== "").join(" ")}
                            </span>
                          )}
                          {p.link_orcamento && (
                            <a
                              href={p.link_orcamento}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1.5 inline-flex text-muted-foreground hover:text-ink"
                              title="Abrir orçamento"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <span className={isMenor ? "font-semibold text-positive-strong" : "text-ink"}>
                            {formatCurrency(valor)}
                          </span>
                          {isMenor && propostas.length > 1 && (
                            <Badge variant="outline" className="ml-1.5 border-transparent bg-positive/10 text-positive-strong">
                              menor
                            </Badge>
                          )}
                          {p.quantidade != null && Number(p.quantidade) > 0 && (
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {formatCurrency(valor / Number(p.quantidade))}/{p.unidade || "un"}
                            </div>
                          )}
                          {p.valor_parcelado != null && Number(p.valor_parcelado) !== valor && (
                            <div className="text-xs text-muted-foreground tabular-nums">
                              parc. {formatCurrency(Number(p.valor_parcelado))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {p.prazo_entrega_dias != null ? `${p.prazo_entrega_dias} d` : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">{p.condicao_pagamento || "—"}</td>
                        <td className="py-2">
                          <div className="flex justify-end gap-0.5">
                            {editavel && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7"
                                onClick={() => setDecisao(p)}
                              >
                                Escolher
                              </Button>
                            )}
                            {canEdit && !decidida && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setPropostaForm({ proposta: p })}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setConfirmDel(p)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {aberta && (
                        <tr>
                          <td colSpan={5} className="pb-3">
                            <div className="overflow-x-auto rounded-md bg-muted/40 p-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-muted-foreground">
                                    <th className="pb-1 font-normal">Item</th>
                                    <th className="pb-1 text-right font-normal">Qtd</th>
                                    <th className="pb-1 text-right font-normal">Unit.</th>
                                    <th className="pb-1 text-right font-normal">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.itens.map((it) => (
                                    <tr key={it.id}>
                                      <td className="py-0.5 pr-2 text-ink">{it.descricao}</td>
                                      <td className="py-0.5 text-right text-muted-foreground">
                                        {it.quantidade != null ? `${it.quantidade}${it.unidade ? ` ${it.unidade}` : ""}` : "—"}
                                      </td>
                                      <td className="py-0.5 text-right text-muted-foreground">
                                        {it.preco_unitario != null ? formatCurrency(Number(it.preco_unitario)) : "—"}
                                      </td>
                                      <td className="py-0.5 text-right text-ink">{formatCurrency(Number(it.valor_total))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {decidida && canEdit && (
            <p className="text-xs text-muted-foreground">
              Cotação decidida.{" "}
              <button className="underline" onClick={() => reabrir.mutate(cotacao.id)}>
                Reabrir para comparar de novo
              </button>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      {propostaForm && (
        <PropostaFormDialog
          open
          onOpenChange={(v) => !v && setPropostaForm(null)}
          obraId={obraId}
          cotacaoId={cotacao.id}
          proposta={propostaForm.proposta}
          modo="cesta"
        />
      )}

      {decisao && (
        <DecisaoDialog
          open
          onOpenChange={(v) => !v && setDecisao(null)}
          obraId={obraId}
          cotacao={cotacao}
          proposta={decisao}
          onDone={() => {
            setDecisao(null);
            onOpenChange(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        onConfirm={async () => {
          if (!confirmDel) return;
          await del.mutateAsync(confirmDel.id);
          setConfirmDel(null);
        }}
        title="Remover proposta?"
        itemName={confirmDel ? nomeFornecedorProposta(confirmDel) : undefined}
        description="A proposta sai da comparação."
        variant="destructive"
        confirmText="Remover"
        loading={del.isPending}
      />
    </Dialog>
  );
}

type PropostaDraft = {
  fornecedor_nome: string;
  quantidade: string;
  unidade: string;
  valor_a_vista: string;
  valor_parcelado: string;
  condicao: string;
  confianca: number;
};

type ItemDraft = {
  descricao: string;
  quantidade: string;
  unidade: string;
  preco_unitario: string;
  valor_total: string;
};

type ItemLike = {
  descricao: string;
  quantidade?: number | null;
  unidade?: string | null;
  preco_unitario?: number | null;
  valor_total?: number | null;
};

const toItemDraft = (it: ItemLike): ItemDraft => ({
  descricao: it.descricao,
  quantidade: it.quantidade != null ? String(it.quantidade) : "",
  unidade: it.unidade ?? "",
  preco_unitario: it.preco_unitario != null ? String(it.preco_unitario) : "",
  valor_total: it.valor_total != null ? String(it.valor_total) : "",
});

const linhaVazia = (): ItemDraft => ({ descricao: "", quantidade: "", unidade: "", preco_unitario: "", valor_total: "" });

const ACCEPT_ORCAMENTO = "application/pdf,image/png,image/jpeg,image/webp";

// Etapas reais do import (enviar → ler → estruturar). O Gemini structured output
// não emite progresso token a token, então avançamos por tempo: dá feedback
// honesto de atividade sem prometer streaming que a API não entrega.
const ETAPAS_IMPORT = ["Enviando o arquivo", "Lendo o orçamento com a IA", "Organizando os itens"];

/** Avança as etapas do import por tempo enquanto `pending` (setState só a partir de timers). */
function useImportSteps(pending: boolean): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const t0 = setTimeout(() => setStep(0), 0);
    const t1 = setTimeout(() => setStep(1), 500);
    const t2 = setTimeout(() => setStep(2), 4000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pending]);
  return step;
}

/** Lista de etapas do import com check/spinner (feedback de progresso da IA). */
function ImportStepper({ step }: { step: number }) {
  return (
    <ol className="space-y-1.5 rounded-md bg-muted/40 p-3 text-sm">
      {ETAPAS_IMPORT.map((label, i) => {
        const feito = i < step;
        const atual = i === step;
        return (
          <li key={label} className={`flex items-center gap-2 ${feito || atual ? "text-ink" : "text-muted-foreground/50"}`}>
            {feito ? (
              <Check className="h-4 w-4 text-positive-strong" />
            ) : atual ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-current/30" />
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

/** Tabela editável de itens de uma cesta (descrição, qtd, unidade, preço unit., total). */
function ItensEditor({ itens, setItens }: { itens: ItemDraft[]; setItens: React.Dispatch<React.SetStateAction<ItemDraft[]>> }) {
  const total = itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
  const setItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItens((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        // Recalcula o total da linha quando quantidade e preço unitário estão presentes.
        if (("quantidade" in patch || "preco_unitario" in patch) && next.quantidade !== "" && next.preco_unitario !== "") {
          const t = (Number(next.quantidade) || 0) * (Number(next.preco_unitario) || 0);
          next.valor_total = t ? String(Number(t.toFixed(2))) : next.valor_total;
        }
        return next;
      })
    );
  };
  return (
    <>
      {itens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="pb-1 font-normal">Descrição</th>
                <th className="pb-1 text-right font-normal">Qtd</th>
                <th className="pb-1 font-normal">Un</th>
                <th className="pb-1 text-right font-normal">Unit.</th>
                <th className="pb-1 text-right font-normal">Total</th>
                <th className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx}>
                  <td className="py-0.5 pr-1">
                    <Input value={it.descricao} onChange={(e) => setItem(idx, { descricao: e.target.value })} className="h-8" placeholder="Material" />
                  </td>
                  <td className="py-0.5 pr-1">
                    <Input type="number" min="0" step="0.001" value={it.quantidade} onChange={(e) => setItem(idx, { quantidade: e.target.value })} className="h-8 w-16 text-right" />
                  </td>
                  <td className="py-0.5 pr-1">
                    <Input value={it.unidade} onChange={(e) => setItem(idx, { unidade: e.target.value })} className="h-8 w-14" placeholder="un" />
                  </td>
                  <td className="py-0.5 pr-1">
                    <Input type="number" min="0" step="0.01" value={it.preco_unitario} onChange={(e) => setItem(idx, { preco_unitario: e.target.value })} className="h-8 w-24 text-right" />
                  </td>
                  <td className="py-0.5 pr-1">
                    <Input type="number" min="0" step="0.01" value={it.valor_total} onChange={(e) => setItem(idx, { valor_total: e.target.value })} className="h-8 w-28 text-right" />
                  </td>
                  <td className="py-0.5">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setItens((prev) => [...prev, linhaVazia()])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar item
        </Button>
        {itens.length > 0 && (
          <span className="text-sm">
            Total: <span className="font-semibold text-ink">{formatCurrency(total)}</span>
          </span>
        )}
      </div>
    </>
  );
}

/**
 * Sobe um orçamento (PDF/imagem); a IA CLASSIFICA sozinha (comparativo entre lojas
 * ou cesta de um fornecedor) e mostra o preview certo. Um botão só, sem o usuário
 * escolher o tipo.
 */
function AnalisarOrcamentoButton({ obraId, cotacaoId, contexto }: { obraId: string; cotacaoId: string; contexto: string }) {
  const importar = useImportarOrcamento();
  const salvarLote = useSalvarPropostasEmLote(obraId, cotacaoId);
  const save = useSaveProposta(obraId, cotacaoId);
  const fileRef = useRef<HTMLInputElement>(null);
  const step = useImportSteps(importar.isPending);

  const [open, setOpen] = useState(false);
  const [tipoPreview, setTipoPreview] = useState<"comparativo" | "cesta" | null>(null);
  const [classificacao, setClassificacao] = useState<{ tipo: string; motivo: string | null } | null>(null);
  // comparativo
  const [propostas, setPropostas] = useState<PropostaDraft[]>([]);
  // cesta
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [itens, setItens] = useState<ItemDraft[]>([]);

  const salvando = salvarLote.isPending || save.isPending;
  const setLinha = (idx: number, patch: Partial<PropostaDraft>) =>
    setPropostas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));

  const onArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setTipoPreview(null);
    setClassificacao(null);
    setPropostas([]);
    setItens([]);
    setFornecedorNome("");
    setOpen(true);
    try {
      const res = await importar.mutateAsync({ file, modo: "auto", contexto });
      setClassificacao(res.classificacao);
      if (res.modo === "cesta") {
        if (res.itens.length === 0) {
          toast.warning("Nenhum item reconhecido no orçamento", { description: "Adicione os itens à mão." });
          setOpen(false);
          return;
        }
        setFornecedorNome(res.fornecedor_nome ?? "");
        setItens(res.itens.map(toItemDraft));
        setTipoPreview("cesta");
      } else if (res.modo === "comparativo") {
        if (res.propostas.length === 0) {
          toast.warning("Nenhuma loja reconhecida no comparativo", { description: "Adicione as propostas à mão." });
          setOpen(false);
          return;
        }
        setPropostas(
          res.propostas.map((p) => ({
            fornecedor_nome: p.fornecedor_nome,
            quantidade: p.quantidade != null ? String(p.quantidade) : "",
            unidade: p.unidade ?? "",
            valor_a_vista: String(p.valor_a_vista),
            valor_parcelado: p.valor_parcelado != null ? String(p.valor_parcelado) : "",
            condicao: p.condicao_pagamento ?? "",
            confianca: p.confianca,
          }))
        );
        setTipoPreview("comparativo");
      } else {
        // item (raro no auto): trata como uma proposta simples de comparativo.
        setPropostas([
          {
            fornecedor_nome: res.fornecedor_nome ?? "",
            quantidade: "",
            unidade: "",
            valor_a_vista: String(res.valor_total),
            valor_parcelado: "",
            condicao: res.condicao_pagamento ?? "",
            confianca: 1,
          },
        ]);
        setTipoPreview("comparativo");
      }
    } catch (err) {
      toast.error("Não foi possível ler o orçamento", {
        description: err instanceof Error ? err.message : "Tente outro arquivo.",
      });
      setOpen(false);
    }
  };

  const confirmar = async () => {
    try {
      if (tipoPreview === "comparativo") {
        const validas = propostas.filter((p) => p.fornecedor_nome.trim());
        if (validas.length === 0) {
          toast.error("Informe ao menos um fornecedor");
          return;
        }
        const lote: PropostaComparativa[] = validas.map((p) => ({
          fornecedor_nome: p.fornecedor_nome.trim(),
          quantidade: p.quantidade ? Number(p.quantidade) : null,
          unidade: p.unidade.trim() || null,
          valor_a_vista: Number(p.valor_a_vista) || 0,
          valor_parcelado: p.valor_parcelado ? Number(p.valor_parcelado) : null,
          condicao_pagamento: p.condicao.trim() || null,
          confianca: p.confianca,
        }));
        await salvarLote.mutateAsync(lote);
        toast.success(`${lote.length} ${lote.length === 1 ? "proposta adicionada" : "propostas adicionadas"}`);
      } else {
        if (!fornecedorNome.trim()) {
          toast.error("Informe o nome do fornecedor");
          return;
        }
        const validos = itens.filter((it) => it.descricao.trim());
        if (validos.length === 0) {
          toast.error("A cesta precisa de ao menos um item");
          return;
        }
        const itensInput: PropostaItemInput[] = validos.map((it) => ({
          descricao: it.descricao.trim(),
          quantidade: it.quantidade ? Number(it.quantidade) : null,
          unidade: it.unidade.trim() || null,
          preco_unitario: it.preco_unitario ? Number(it.preco_unitario) : null,
          valor_total: Number(it.valor_total) || 0,
        }));
        const total = validos.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);
        await save.mutateAsync({ fornecedor_nome: fornecedorNome.trim(), fornecedor_id: null, valor: total, itens: itensInput });
        toast.success("Proposta adicionada");
      }
      setOpen(false);
      setTipoPreview(null);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  };

  const fecha = () => {
    setOpen(false);
    setTipoPreview(null);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept={ACCEPT_ORCAMENTO} className="hidden" onChange={onArquivo} />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importar.isPending}>
        {importar.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
        Analisar orçamento (PDF)
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && fecha()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Analisar orçamento com IA</DialogTitle>
          </DialogHeader>

          {importar.isPending ? (
            <ImportStepper step={step} />
          ) : tipoPreview ? (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              {classificacao && (
                <p className="rounded-md bg-brand/5 px-3 py-2 text-xs text-muted-foreground">
                  Detectei: <span className="font-medium text-ink">{tipoPreview === "comparativo" ? "comparação entre lojas" : "orçamento de um fornecedor"}</span>
                  {classificacao.motivo ? ` — ${classificacao.motivo}` : ""}
                </p>
              )}

              {tipoPreview === "comparativo" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Uma proposta por loja, o preço à vista compara entre elas. A IA já revisou; linhas em amarelo são as
                    que ela ficou em dúvida, confira antes de confirmar.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="pb-1 font-normal">Fornecedor</th>
                          <th className="pb-1 text-right font-normal">Qtd</th>
                          <th className="pb-1 font-normal">Un</th>
                          <th className="pb-1 text-right font-normal">À vista</th>
                          <th className="pb-1 text-right font-normal">Parcelado</th>
                          <th className="pb-1 font-normal">Condição</th>
                          <th className="pb-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {propostas.map((p, idx) => {
                          const duvidoso = p.confianca < 0.6;
                          return (
                            <tr key={idx} className={duvidoso ? "bg-warning/5" : undefined}>
                              <td className="py-0.5 pr-1">
                                <div className="flex items-center gap-1">
                                  {duvidoso && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-strong" />}
                                  <Input value={p.fornecedor_nome} onChange={(e) => setLinha(idx, { fornecedor_nome: e.target.value })} className="h-8" />
                                </div>
                              </td>
                              <td className="py-0.5 pr-1">
                                <Input type="number" min="0" step="0.001" value={p.quantidade} onChange={(e) => setLinha(idx, { quantidade: e.target.value })} className="h-8 w-14 text-right" />
                              </td>
                              <td className="py-0.5 pr-1">
                                <Input value={p.unidade} onChange={(e) => setLinha(idx, { unidade: e.target.value })} className="h-8 w-14" placeholder="un" />
                              </td>
                              <td className="py-0.5 pr-1">
                                <Input type="number" min="0" step="0.01" value={p.valor_a_vista} onChange={(e) => setLinha(idx, { valor_a_vista: e.target.value })} className="h-8 w-24 text-right" />
                              </td>
                              <td className="py-0.5 pr-1">
                                <Input type="number" min="0" step="0.01" value={p.valor_parcelado} onChange={(e) => setLinha(idx, { valor_parcelado: e.target.value })} className="h-8 w-24 text-right" placeholder="—" />
                              </td>
                              <td className="py-0.5 pr-1">
                                <Input value={p.condicao} onChange={(e) => setLinha(idx, { condicao: e.target.value })} className="h-8 w-28" placeholder="—" />
                              </td>
                              <td className="py-0.5">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPropostas((prev) => prev.filter((_, i) => i !== idx))}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="cesta-forn">Fornecedor</Label>
                    <Input id="cesta-forn" value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} placeholder="Nome do fornecedor" />
                  </div>
                  <ItensEditor itens={itens} setItens={setItens} />
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Lendo o arquivo…</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={fecha}>
              Cancelar
            </Button>
            <Button type="button" variant="brand" onClick={confirmar} disabled={!tipoPreview || salvando}>
              {salvando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {tipoPreview === "cesta" ? "Adicionar proposta" : "Adicionar propostas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Adiciona/edita a proposta de um fornecedor: fornecedor do cadastro ou nome livre, com cesta de itens. */
function PropostaFormDialog({
  open,
  onOpenChange,
  obraId,
  cotacaoId,
  proposta,
  modo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  cotacaoId: string;
  proposta?: PropostaComFornecedor | null;
  modo: "item" | "cesta";
}) {
  const isEdit = !!proposta;
  const permiteCesta = modo === "cesta";
  const tinhaItens = (proposta?.itens?.length ?? 0) > 0;
  const { data: fornecedores = [] } = useFornecedoresLite();
  const save = useSaveProposta(obraId, cotacaoId);

  const [fornecedorId, setFornecedorId] = useState(proposta?.fornecedor_id ?? OUTRO);
  const [fornecedorNome, setFornecedorNome] = useState(proposta?.fornecedor_nome ?? "");
  const [valor, setValor] = useState(proposta && !tinhaItens ? String(proposta.valor) : "");
  const [prazo, setPrazo] = useState(proposta?.prazo_entrega_dias != null ? String(proposta.prazo_entrega_dias) : "");
  const [condicao, setCondicao] = useState(proposta?.condicao_pagamento ?? "");
  const [link, setLink] = useState(proposta?.link_orcamento ?? "");
  const [itens, setItens] = useState<ItemDraft[]>(() => (proposta?.itens ?? []).map(toItemDraft));

  const usaNomeLivre = fornecedorId === OUTRO;
  const temItens = itens.length > 0;
  const totalItens = useMemo(() => itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0), [itens]);

  const submit = async () => {
    if (usaNomeLivre && !fornecedorNome.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }

    let itensInput: PropostaItemInput[] | undefined;
    let valorFinal: number;

    if (temItens) {
      if (itens.some((it) => !it.descricao.trim())) {
        toast.error("Todo item precisa de descrição");
        return;
      }
      itensInput = itens.map((it) => ({
        descricao: it.descricao.trim(),
        quantidade: it.quantidade ? Number(it.quantidade) : null,
        unidade: it.unidade.trim() || null,
        preco_unitario: it.preco_unitario ? Number(it.preco_unitario) : null,
        valor_total: Number(it.valor_total) || 0,
      }));
      valorFinal = totalItens;
    } else {
      valorFinal = Number(valor);
      if (!Number.isFinite(valorFinal) || valorFinal < 0) {
        toast.error("Informe um valor válido");
        return;
      }
      // Edição que esvaziou a cesta: sincroniza para apagar os itens antigos.
      itensInput = isEdit && tinhaItens ? [] : undefined;
    }

    try {
      await save.mutateAsync({
        id: proposta?.id,
        fornecedor_id: usaNomeLivre ? null : fornecedorId,
        fornecedor_nome: usaNomeLivre ? fornecedorNome.trim() : null,
        valor: valorFinal,
        prazo_entrega_dias: prazo ? Number(prazo) : null,
        condicao_pagamento: condicao.trim() || null,
        link_orcamento: link.trim() || null,
        itens: itensInput,
      });
      toast.success(isEdit ? "Proposta atualizada" : "Proposta adicionada");
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar proposta" : "Nova proposta"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
                <SelectItem value={OUTRO}>Outro (digitar nome)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {usaNomeLivre && (
            <div className="space-y-1.5">
              <Label htmlFor="prop-nome">Nome do fornecedor</Label>
              <Input
                id="prop-nome"
                value={fornecedorNome}
                onChange={(e) => setFornecedorNome(e.target.value)}
                placeholder="Ex.: Depósito São João"
              />
            </div>
          )}

          {permiteCesta && (
            <div className="space-y-2 rounded-lg border border-black/5 bg-muted/30 p-3">
              <div>
                <Label className="text-sm">Itens da cesta</Label>
                <p className="text-xs text-muted-foreground">Materiais deste fornecedor. Adicione ou ajuste à mão.</p>
              </div>
              <ItensEditor itens={itens} setItens={setItens} />
            </div>
          )}

          {/* Valor manual: sempre no modo item; no modo cesta, só quando ainda não há itens */}
          {(!permiteCesta || !temItens) && (
            <div className="space-y-1.5">
              <Label htmlFor="prop-valor">Valor total (R$)</Label>
              <Input
                id="prop-valor"
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prop-prazo">Prazo de entrega (dias)</Label>
              <Input
                id="prop-prazo"
                type="number"
                min="0"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prop-cond">Condição de pagamento</Label>
              <Input
                id="prop-cond"
                value={condicao}
                onChange={(e) => setCondicao(e.target.value)}
                placeholder="Ex.: à vista, 30/60 dias"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prop-link">Link do orçamento</Label>
            <Input
              id="prop-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Cole o link do PDF/arquivo (Drive, e-mail)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirma a escolha da vencedora e oferece lançar direto como despesa na conta da obra. */
function DecisaoDialog({
  open,
  onOpenChange,
  obraId,
  cotacao,
  proposta,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
  cotacao: CotacaoComPropostas;
  proposta: PropostaComFornecedor;
  onDone: () => void;
}) {
  const decidir = useDecidirCotacao(obraId);

  const decidirCom = async (lancarDespesa: boolean) => {
    try {
      await decidir.mutateAsync({
        cotacaoId: cotacao.id,
        proposta,
        cotacaoDescricao: cotacao.descricao,
        obraFrenteId: cotacao.obra_frente_id,
        lancarDespesa,
        data: hoje(),
      });
      toast.success(lancarDespesa ? "Vencedora escolhida e despesa lançada" : "Vencedora escolhida");
      onDone();
    } catch (e) {
      toast.error("Não foi possível decidir", { description: e instanceof Error ? e.message : "Tente novamente" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escolher vencedora</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {nomeFornecedorProposta(proposta)} por{" "}
          <span className="font-semibold text-ink">{formatCurrency(Number(proposta.valor))}</span> vence a cotação de{" "}
          {cotacao.descricao}.
        </p>
        <p className="text-sm text-muted-foreground">
          Você pode só marcar a vencedora, ou já lançar o valor como despesa na conta da obra.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => decidirCom(false)} disabled={decidir.isPending}>
            {decidir.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Só marcar vencedora
          </Button>
          <Button type="button" variant="brand" onClick={() => decidirCom(true)} disabled={decidir.isPending}>
            {decidir.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Marcar e lançar despesa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useFornecedoresLite() {
  return useQuery({
    queryKey: ["fornecedores-lite"],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}
