import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreditCard, ChevronRight, Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatValorToInput, formatCurrency } from "@/lib/currencyUtils";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FinanceErrorState } from "../components/FinanceErrorState";
import { ContasSidebar } from "../components/ContasSidebar";
import { ContaFormDialog } from "../components/ContaFormDialog";
import { CartaoFormDialog } from "../components/CartaoFormDialog";
import { ContaDetailPanel } from "../components/ContaDetailPanel";
import { CartaoDetailPanel } from "../components/CartaoDetailPanel";
import { CarteiraOverview } from "../components/CarteiraOverview";
import { FaturasCartaoTable } from "../components/FaturasCartaoTable";
import { FaturaDetailDialog } from "../components/FaturaDetailDialog";
import { FaturaPagamentoDialog } from "../components/FaturaPagamentoDialog";
import { vencimentoRelativo } from "../components/faturaHelpers";
import {
  useContasResumo,
  useCartoesResumoDetalhado,
  useContasCartoesMutations,
  type ContaItem,
  type CartaoItem,
} from "../hooks/useContasCartoes";
import { useContas, useFaturasPendentes, type Fatura } from "../hooks/useFaturas";

export default function Carteira() {
  const contasQuery = useContasResumo();
  const cartoesQuery = useCartoesResumoDetalhado();
  const faturasPendentesQuery = useFaturasPendentes();
  const { data: contasSimples = [] } = useContas();
  const { saveConta, saveCartao, deleteConta, deleteCartao } = useContasCartoesMutations();

  const contas = contasQuery.data ?? [];
  const cartoes = cartoesQuery.data ?? [];
  const faturasPendentes = faturasPendentesQuery.data ?? [];
  const loading = contasQuery.isLoading || cartoesQuery.isLoading;
  const loadError = contasQuery.isError || cartoesQuery.isError;
  const reload = () => {
    void contasQuery.refetch();
    void cartoesQuery.refetch();
    void faturasPendentesQuery.refetch();
  };

  const [isNewCartaoOpen, setIsNewCartaoOpen] = useState(false);
  const [isNewContaOpen, setIsNewContaOpen] = useState(false);

  const [selectedCartao, setSelectedCartao] = useState<CartaoItem | null>(null);
  const [selectedConta, setSelectedConta] = useState<ContaItem | null>(null);

  const [panelConta, setPanelConta] = useState<ContaItem | null>(null);
  const [panelCartao, setPanelCartao] = useState<CartaoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "conta" | "cartao"; id: string; nome: string } | null>(null);
  const { canEdit } = useFeatureAccess("financeiro");

  // Fatura: detalhe + pagamento (disparados pelo overview e pelo painel do cartão)
  const [faturaDetalhe, setFaturaDetalhe] = useState<Fatura | null>(null);
  const [isFaturaDetalheOpen, setIsFaturaDetalheOpen] = useState(false);
  const [faturaPagamento, setFaturaPagamento] = useState<Fatura | null>(null);
  const [isFaturaPagamentoOpen, setIsFaturaPagamentoOpen] = useState(false);

  const openFaturaDetalhe = (fatura: Fatura) => {
    setFaturaDetalhe(fatura);
    setIsFaturaDetalheOpen(true);
  };
  const openFaturaPagamento = (fatura: Fatura) => {
    setFaturaPagamento(fatura);
    setIsFaturaPagamentoOpen(true);
  };

  // Form States
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [contaErrors, setContaErrors] = useState<Record<string, boolean>>({});
  const [diaFechamento, setDiaFechamento] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [limite, setLimite] = useState("");
  const [contaPagamentoId, setContaPagamentoId] = useState("");
  const [tipoCartao, setTipoCartao] = useState<"credito" | "debito">("credito");

  const resetForm = () => {
    setNome("");
    setBanco("");
    setSaldoInicial("");
    setChavePix("");
    setContaErrors({});
    setDiaFechamento("");
    setDiaVencimento("");
    setLimite("");
    setContaPagamentoId("");
    setTipoCartao("credito");
    setSelectedConta(null);
    setSelectedCartao(null);
  };

  const handleSaveConta = () => {
    const errors = { nome: !nome, banco: !banco, saldoInicial: false };
    setContaErrors(errors);
    if (errors.nome || errors.banco) {
      toast.error("Campos obrigatórios", { description: "Preencha todos os campos marcados com *" });
      return;
    }

    saveConta.mutate(
      { selected: selectedConta, nome, banco, saldoInicial, chavePix },
      {
        onSuccess: () => {
          setIsNewContaOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleSaveCartao = () => {
    if (!nome || !diaFechamento || !diaVencimento) {
      toast.error("Campos obrigatórios", { description: "Preencha nome, fechamento e vencimento" });
      return;
    }

    saveCartao.mutate(
      { selected: selectedCartao, nome, tipoCartao, diaFechamento, diaVencimento, limite, contaPagamentoId },
      {
        onSuccess: () => {
          setIsNewCartaoOpen(false);
          resetForm();
        },
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    setDeleteTarget(null);

    if (type === "conta") {
      deleteConta.mutate(id, { onSuccess: () => setPanelConta(null) });
    } else {
      deleteCartao.mutate(id, { onSuccess: () => setPanelCartao(null) });
    }
  };

  const openEditConta = (conta: ContaItem) => {
    setSelectedConta(conta);
    setNome(conta.nome);
    setBanco(conta.banco);
    setChavePix(conta.chave_pix ?? "");
    setSaldoInicial(formatValorToInput(conta.saldo_inicial ?? 0));
    setIsNewContaOpen(true);
  };

  // Criar cartão a partir de uma conta: já vincula a conta de pagamento.
  const openNewCartaoParaConta = (conta: ContaItem) => {
    resetForm();
    setContaPagamentoId(conta.id);
    setIsNewCartaoOpen(true);
  };

  const openEditCartao = (cartao: CartaoItem) => {
    setSelectedCartao(cartao);
    setNome(cartao.nome);
    setDiaFechamento(cartao.dia_fechamento.toString());
    setDiaVencimento(cartao.dia_vencimento.toString());
    setLimite(formatValorToInput(cartao.limite ?? 0));
    setContaPagamentoId(cartao.conta_pagamento_id || "__none__");
    setTipoCartao((cartao.tipo as "credito" | "debito") ?? "credito");
    setIsNewCartaoOpen(true);
  };

  const selectCartao = (cartao: CartaoItem) => {
    setPanelCartao(cartao);
    setPanelConta(null);
  };

  // Cartões pagos pela conta selecionada (mini-lista no painel da conta)
  const cartoesDaConta = panelConta ? cartoes.filter((c) => c.conta_pagamento_id === panelConta.id) : [];

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[480px]">
              <div className="w-72 shrink-0 border-r p-4 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-4 w-20 mt-4" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex-1 p-6 space-y-4">
                <Skeleton className="h-12 w-48" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : loadError ? (
            <div className="min-h-[480px] flex items-center justify-center">
              <FinanceErrorState onRetry={reload} />
            </div>
          ) : (
            <div className="flex min-h-[480px]">
              <ContasSidebar
                contas={contas}
                cartoes={cartoes}
                faturasPendentes={faturasPendentes}
                panelConta={panelConta}
                panelCartao={panelCartao}
                onSelectConta={(conta) => {
                  setPanelConta(conta);
                  setPanelCartao(null);
                }}
                onSelectCartao={selectCartao}
                contaDialog={
                  canEdit ? (
                    <ContaFormDialog
                      open={isNewContaOpen}
                      onOpenChange={(open) => {
                        setIsNewContaOpen(open);
                        if (!open) resetForm();
                      }}
                      onAddClick={() => {
                        resetForm();
                        setIsNewContaOpen(true);
                      }}
                      selectedConta={selectedConta}
                      nome={nome}
                      setNome={setNome}
                      banco={banco}
                      setBanco={setBanco}
                      saldoInicial={saldoInicial}
                      setSaldoInicial={setSaldoInicial}
                      chavePix={chavePix}
                      setChavePix={setChavePix}
                      contaErrors={contaErrors}
                      setContaErrors={setContaErrors}
                      onSave={handleSaveConta}
                    />
                  ) : null
                }
              />

              {/* Painel de detalhes */}
              <div className="flex-1 p-6">
                {panelConta && !panelCartao ? (
                  <div className="space-y-6">
                    <ContaDetailPanel
                      conta={panelConta}
                      canEdit={canEdit}
                      onEdit={() => openEditConta(panelConta)}
                      onDelete={() => setDeleteTarget({ type: "conta", id: panelConta.id, nome: panelConta.nome })}
                    />
                    <div className="border-t pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4" /> Cartões pagos por esta conta
                        </h3>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full text-sm"
                            onClick={() => openNewCartaoParaConta(panelConta)}
                          >
                            <Plus className="h-4 w-4 mr-1" /> Adicionar cartão
                          </Button>
                        )}
                      </div>
                      {cartoesDaConta.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum cartão vinculado. Adicione o primeiro para acompanhar as faturas dele.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {cartoesDaConta.map((cartao) => {
                            const fatura = faturasPendentes.find((f) => f.cartao_id === cartao.id);
                            const venc = fatura ? vencimentoRelativo(fatura.status, fatura.data_vencimento) : null;
                            return (
                              <button
                                key={cartao.id}
                                onClick={() => selectCartao(cartao)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors hover:bg-muted/50"
                              >
                                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium flex-1 truncate">{cartao.nome}</span>
                                {venc && (
                                  <span
                                    className={cn(
                                      "text-xs shrink-0",
                                      venc.vencida ? "text-red-600 font-medium" : "text-muted-foreground"
                                    )}
                                  >
                                    {venc.label}
                                  </span>
                                )}
                                <span className="text-sm text-muted-foreground shrink-0 tabular-nums">
                                  {formatCurrency(cartao.usado)} / {formatCurrency(cartao.limite)}
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : panelCartao && !panelConta ? (
                  <div className="space-y-6">
                    <CartaoDetailPanel
                      cartao={panelCartao}
                      contas={contas}
                      canEdit={canEdit}
                      onEdit={() => openEditCartao(panelCartao)}
                      onDelete={() => setDeleteTarget({ type: "cartao", id: panelCartao.id, nome: panelCartao.nome })}
                    />
                    <div className="border-t pt-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                        <Receipt className="h-4 w-4" /> Faturas
                      </h3>
                      <FaturasCartaoTable
                        cartaoId={panelCartao.id}
                        onDetalhe={openFaturaDetalhe}
                        onPagar={openFaturaPagamento}
                      />
                    </div>
                  </div>
                ) : (
                  <CarteiraOverview
                    contas={contas}
                    faturas={faturasPendentes}
                    onDetalhe={openFaturaDetalhe}
                    onPagar={openFaturaPagamento}
                  />
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <CartaoFormDialog
          open={isNewCartaoOpen}
          onOpenChange={(open) => {
            setIsNewCartaoOpen(open);
            if (!open) resetForm();
          }}
          onAddClick={() => {}}
          showTrigger={false}
          selectedCartao={selectedCartao}
          contas={contas}
          nome={nome}
          setNome={setNome}
          tipoCartao={tipoCartao}
          setTipoCartao={setTipoCartao}
          diaFechamento={diaFechamento}
          setDiaFechamento={setDiaFechamento}
          diaVencimento={diaVencimento}
          setDiaVencimento={setDiaVencimento}
          limite={limite}
          setLimite={setLimite}
          contaPagamentoId={contaPagamentoId}
          setContaPagamentoId={setContaPagamentoId}
          onSave={handleSaveCartao}
        />
      )}

      <FaturaDetailDialog
        fatura={faturaDetalhe}
        open={isFaturaDetalheOpen}
        onOpenChange={setIsFaturaDetalheOpen}
        onPagar={(f) => {
          setIsFaturaDetalheOpen(false);
          openFaturaPagamento(f);
        }}
      />

      <FaturaPagamentoDialog
        fatura={faturaPagamento}
        contas={contasSimples}
        open={isFaturaPagamentoOpen}
        onOpenChange={setIsFaturaPagamentoOpen}
        onPaid={() => setIsFaturaDetalheOpen(false)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.type === "conta" ? "conta" : "cartão"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir <strong>{deleteTarget?.nome}</strong>? A conta será desativada e não aparecerá mais nos
              lançamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
