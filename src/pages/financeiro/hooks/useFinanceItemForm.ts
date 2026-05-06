import { useEffect, useState } from "react";
import { type FieldValues, type UseFormReturn, type Path } from "react-hook-form";
import { checkDuplicates, type DuplicateMatch } from "@/lib/duplicateCheck";
import { parseCurrencyString, formatCurrencyInput } from "@/lib/currencyUtils";
import { toast } from "sonner";

interface BaseFinanceFormData extends FieldValues {
  descricao: string;
  valorTotal: string;
  parcelas: string;
  dataVencimento: Date;
}

interface UseFinanceItemFormArgs<T extends BaseFinanceFormData> {
  form: UseFormReturn<T>;
  table: "despesas" | "receitas";
  isDialogOpen: boolean;
  hasSelected: boolean;
  onSave: (formData: T) => Promise<void> | void;
}

export function useFinanceItemForm<T extends BaseFinanceFormData>({
  form,
  table,
  isDialogOpen,
  hasSelected,
  onSave,
}: UseFinanceItemFormArgs<T>) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<T | null>(null);

  useEffect(() => {
    if (isDialogOpen) setStep(1);
  }, [isDialogOpen]);

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    form.setValue("valorTotal" as Path<T>, formatted as never);
  };

  const goNext = async () => {
    const valid = await form.trigger(["descricao" as Path<T>, "valorTotal" as Path<T>, "dataVencimento" as Path<T>]);
    if (!valid) return;
    setStep(2);
  };

  const goBack = () => setStep(1);

  const goToStep = async (target: 1 | 2) => {
    if (hasSelected || target <= step) {
      setStep(target);
      return;
    }
    if (target === 2) {
      const valid = await form.trigger(["descricao" as Path<T>, "valorTotal" as Path<T>, "dataVencimento" as Path<T>]);
      if (!valid) return;
    }
    setStep(target);
  };

  const submit = form.handleSubmit(async (formData) => {
    if (hasSelected) {
      setIsSaving(true);
      try {
        await onSave(formData);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    try {
      const valorNumerico = parseCurrencyString(formData.valorTotal);
      const numParcelas = parseInt(formData.parcelas) || 1;
      const valorParcela = valorNumerico / numParcelas;

      const found = await checkDuplicates({
        table,
        descricao: formData.descricao,
        valor: valorParcela,
        dataVencimento: formData.dataVencimento,
      });

      if (found.length > 0) {
        setDuplicates(found);
        setPendingFormData(formData);
        setShowDuplicateWarning(true);
        setIsSaving(false);
        return;
      }
    } catch {
      toast.error("Erro ao verificar duplicatas");
    }

    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  });

  const confirmDuplicate = async () => {
    setShowDuplicateWarning(false);
    if (!pendingFormData) return;
    const data = pendingFormData;
    setPendingFormData(null);
    setIsSaving(true);
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    step,
    setStep,
    isSaving,
    duplicates,
    showDuplicateWarning,
    setShowDuplicateWarning,
    pendingFormData,
    setPendingFormData,
    handleValorChange,
    goNext,
    goBack,
    goToStep,
    submit,
    confirmDuplicate,
  };
}
