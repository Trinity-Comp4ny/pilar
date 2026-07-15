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
import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { toast } from "sonner";
import { formatValorToInput } from "@/lib/currencyUtils";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { FinanceErrorState } from "../components/FinanceErrorState";
import { ContasSidebar } from "../components/ContasSidebar";
import { ContaFormDialog } from "../components/ContaFormDialog";
import { CartaoFormDialog } from "../components/CartaoFormDialog";
import { ContaDetailPanel } from "../components/ContaDetailPanel";
import { CartaoDetailPanel } from "../components/CartaoDetailPanel";
import {
  useContasResumo,
  useCartoesResumoDetalhado,
  useContasCartoesMutations,
  type ContaItem,
  type CartaoItem,
} from "../hooks/useContasCartoes";

export default function Contas() {
  const contasQuery = useContasResumo();
  const cartoesQuery = useCartoesResumoDetalhado();
  const { saveConta, saveCartao, deleteConta, deleteCartao } = useContasCartoesMutations();

  const contas = contasQuery.data ?? [];
  const cartoes = cartoesQuery.data ?? [];
  const loading = contasQuery.isLoading || cartoesQuery.isLoading;
  const loadError = contasQuery.isError || cartoesQuery.isError;
  const reload = () => {
    void contasQuery.refetch();
    void cartoesQuery.refetch();
  };

  const [isNewCartaoOpen, setIsNewCartaoOpen] = useState(false);
  const [isNewContaOpen, setIsNewContaOpen] = useState(false);

  const [selectedCartao, setSelectedCartao] = useState<CartaoItem | null>(null);
  const [selectedConta, setSelectedConta] = useState<ContaItem | null>(null);

  const [panelConta, setPanelConta] = useState<ContaItem | null>(null);
  const [panelCartao, setPanelCartao] = useState<CartaoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "conta" | "cartao"; id: string; nome: string } | null>(null);
  const { canEdit } = useFeatureAccess("financeiro");

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
    const errors = { nome: !nome, banco: !banco, saldoInicial: !saldoInicial };
    setContaErrors(errors);
    if (errors.nome || errors.banco || errors.saldoInicial) {
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
    if (!nome || !diaFechamento || !diaVencimento || !limite) {
      toast.error("Campos obrigatórios", { description: "Preencha todos os campos do cartão" });
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

  return (
    <>
      <Card className="vrz-card w-full">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[480px]">
              <div className="w-64 shrink-0 border-r p-4 space-y-2">
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
                panelConta={panelConta}
                panelCartao={panelCartao}
                onSelectConta={(conta) => {
                  setPanelConta(conta);
                  setPanelCartao(null);
                }}
                onSelectCartao={(cartao) => {
                  setPanelCartao(cartao);
                  setPanelConta(null);
                }}
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
                cartaoDialog={
                  canEdit ? (
                    <CartaoFormDialog
                      open={isNewCartaoOpen}
                      onOpenChange={(open) => {
                        setIsNewCartaoOpen(open);
                        if (!open) resetForm();
                      }}
                      onAddClick={() => {
                        resetForm();
                        setIsNewCartaoOpen(true);
                      }}
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
                  ) : null
                }
              />

              {/* Painel de detalhes */}
              <div className="flex-1 p-6">
                {panelConta && !panelCartao ? (
                  <ContaDetailPanel
                    conta={panelConta}
                    canEdit={canEdit}
                    onEdit={() => openEditConta(panelConta)}
                    onDelete={() => setDeleteTarget({ type: "conta", id: panelConta.id, nome: panelConta.nome })}
                  />
                ) : panelCartao && !panelConta ? (
                  <CartaoDetailPanel
                    cartao={panelCartao}
                    contas={contas}
                    canEdit={canEdit}
                    onEdit={() => openEditCartao(panelCartao)}
                    onDelete={() => setDeleteTarget({ type: "cartao", id: panelCartao.id, nome: panelCartao.nome })}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Wallet className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Selecione uma conta ou cartão</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
