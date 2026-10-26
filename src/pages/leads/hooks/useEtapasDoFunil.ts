// Ações de gerenciar as colunas do funil de leads (SPEC 120): criar, editar,
// reordenar e excluir, com o estado dos dois diálogos (editar e confirmar exclusão).
import { useState } from "react";
import { toast } from "sonner";
import type { ColunaEditavel } from "@/components/kanban/EditColumnDialog";
import { mensagemDoBancoEtapa, motivoNaoExcluir, proximaOrdem, trocarOrdem } from "@/pages/leads/lib/etapas";
import { useLeadEtapaMutations, type LeadBucket, type LeadEtapa } from "./useLeadEtapas";

export function useEtapasDoFunil(etapas: LeadEtapa[], totalLeadsNaEtapa: (etapaId: string) => number) {
  const etapaMut = useLeadEtapaMutations();
  const [editandoEtapa, setEditandoEtapa] = useState<ColunaEditavel | null>(null);
  const [aEtapaExcluir, setAEtapaExcluir] = useState<LeadEtapa | null>(null);

  const criarEtapa = async (nome: string, cor: string, bucket: LeadBucket): Promise<boolean> => {
    const limpo = nome.trim();
    if (!limpo) return false;
    try {
      await etapaMut.criar.mutateAsync({ nome: limpo, ordem: proximaOrdem(etapas), cor, bucket });
      return true;
    } catch (err) {
      toast.error("Não deu para criar a coluna", { description: mensagemDoBancoEtapa(err, "Tente de novo.") });
      return false;
    }
  };

  const salvarEtapa = async ({ id, nome, cor }: ColunaEditavel): Promise<boolean> => {
    try {
      await etapaMut.editar.mutateAsync({ id, nome, cor });
      return true;
    } catch (err) {
      toast.error("Não deu para salvar a coluna", { description: mensagemDoBancoEtapa(err, "Tente de novo.") });
      return false;
    }
  };

  const reordenarEtapa = async (id: string, dir: -1 | 1) => {
    const pares = trocarOrdem(etapas, id, dir);
    if (!pares) return;
    try {
      await etapaMut.reordenar.mutateAsync(pares);
    } catch {
      toast.error("Não deu para reordenar as colunas", { description: "Tente de novo." });
    }
  };

  const pedirExcluirEtapa = (etapa: LeadEtapa) => {
    const motivo = motivoNaoExcluir(etapa, etapas, totalLeadsNaEtapa(etapa.id));
    if (motivo) {
      toast.error("Não dá para excluir esta coluna", { description: motivo });
      return;
    }
    setAEtapaExcluir(etapa);
  };

  const confirmarExcluirEtapa = async () => {
    if (!aEtapaExcluir) return;
    try {
      await etapaMut.excluir.mutateAsync(aEtapaExcluir.id);
      toast.success("Coluna excluída");
    } catch (err) {
      toast.error("Não deu para excluir a coluna", { description: mensagemDoBancoEtapa(err, "Tente de novo.") });
    } finally {
      setAEtapaExcluir(null);
    }
  };

  return {
    criando: etapaMut.criar.isPending,
    salvando: etapaMut.editar.isPending,
    excluindo: etapaMut.excluir.isPending,
    editandoEtapa,
    setEditandoEtapa,
    aEtapaExcluir,
    setAEtapaExcluir,
    criarEtapa,
    salvarEtapa,
    reordenarEtapa,
    pedirExcluirEtapa,
    confirmarExcluirEtapa,
  };
}
