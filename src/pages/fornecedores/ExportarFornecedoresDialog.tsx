import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { exportarFornecedores, type LinhaFornecedor } from "./exportarFornecedores";

export function ExportarFornecedoresDialog({
  fornecedores,
  categorias,
  fechar,
  desabilitado,
}: {
  fornecedores: LinhaFornecedor[];
  categorias: string[];
  fechar: () => void;
  desabilitado: boolean;
}) {
  const [exportando, setExportando] = useState(false);
  const [incluirCnpj, setIncluirCnpj] = useState(false);

  async function baixarPdf() {
    if (!fornecedores.length || desabilitado) return;
    setExportando(true);
    try {
      await exportarFornecedores(fornecedores, categorias, incluirCnpj);
      fechar();
    } catch {
      toast.error("Não foi possível exportar a lista.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && fechar()}
      title="Exportar fornecedores"
      description={`O PDF inclui ${fornecedores.length} fornecedor(es) do resultado atual.`}
      size="sm"
      onSubmit={baixarPdf}
      submitLabel="Baixar PDF"
      isPending={exportando}
      submitDisabled={!fornecedores.length || desabilitado}
    >
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={incluirCnpj} onChange={(e) => setIncluirCnpj(e.target.checked)} /> Incluir CNPJ
      </label>
    </FormDialog>
  );
}
