import { useState } from "react";
import { DuplicateWarningDialog } from "@/components/DuplicateWarningDialog";
import { checkDuplicates, type DuplicateMatch } from "@/lib/duplicateCheck";
import { parseCurrencyString } from "@/lib/currencyUtils";
import type { FormData } from "../lib/lancamentoFormSchema";

interface Opcoes {
  isReceita: boolean;
  /** Para mostrar o nome da contraparte no "Você está lançando". */
  contrapartes: { id: string; nome: string }[];
  /** Grava de fato (chamado direto quando não há duplicata, ou após "Salvar mesmo assim"). */
  salvar: (data: FormData) => Promise<void> | void;
}

/**
 * Checagem de duplicata antes de criar um lançamento (SPEC 149, fase 2). Consulta o
 * motor no servidor com valor da parcela, vencimento, descrição, contraparte e nota
 * fiscal; se houver parecido, segura o salvamento e abre o diálogo de comparação.
 */
export function useChecagemDuplicata({ isReceita, contrapartes, salvar }: Opcoes) {
  const [duplicatas, setDuplicatas] = useState<DuplicateMatch[]>([]);
  const [pendente, setPendente] = useState<FormData | null>(null);

  const contraparteDe = (d: FormData) => (isReceita ? d.clienteId : d.fornecedorId);
  const valorParcela = (d: FormData) => parseCurrencyString(d.valorTotal) / (parseInt(d.parcelas || "1") || 1);

  const verificarESalvar = async (data: FormData) => {
    const found = await checkDuplicates({
      table: isReceita ? "receitas" : "despesas",
      descricao: data.descricao,
      valor: valorParcela(data),
      dataVencimento: data.dataVencimento,
      contraparteId: contraparteDe(data),
      notaFiscal: data.notaFiscal,
    });
    if (found.length === 0) {
      await salvar(data);
      return;
    }
    setDuplicatas(found);
    setPendente(data);
  };

  const dialog = (
    <DuplicateWarningDialog
      open={pendente !== null}
      onOpenChange={(v) => !v && setPendente(null)}
      duplicates={duplicatas}
      novo={
        pendente && {
          descricao: pendente.descricao,
          valor: valorParcela(pendente),
          data: pendente.dataVencimento,
          contraparte: contrapartes.find((c) => c.id === contraparteDe(pendente))?.nome,
          notaFiscal: pendente.notaFiscal,
        }
      }
      onConfirm={() => {
        const d = pendente;
        setPendente(null);
        if (d) void salvar(d);
      }}
    />
  );

  return { verificarESalvar, dialog };
}
