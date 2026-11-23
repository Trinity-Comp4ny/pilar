import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import {
  exportarFornecedores,
  exportarFornecedoresPlanilha,
  type FormatoExportacaoFornecedores,
  type LinhaFornecedor,
} from "./exportarFornecedores";

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
  const [formato, setFormato] = useState<FormatoExportacaoFornecedores>("pdf");

  async function baixarArquivo() {
    if (!fornecedores.length || desabilitado) return;
    setExportando(true);
    try {
      if (formato === "pdf") {
        await exportarFornecedores(fornecedores, categorias, incluirCnpj);
      } else {
        await exportarFornecedoresPlanilha(fornecedores, incluirCnpj, formato);
      }
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
      description={`O arquivo inclui ${fornecedores.length} fornecedor(es) do resultado atual.`}
      size="sm"
      onSubmit={baixarArquivo}
      submitLabel={`Baixar ${formato.toUpperCase()}`}
      isPending={exportando}
      submitDisabled={!fornecedores.length || desabilitado}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        Formato
        <select
          className="h-10 rounded-md border border-input bg-background px-3"
          value={formato}
          onChange={(e) => setFormato(e.target.value as FormatoExportacaoFornecedores)}
        >
          <option value="pdf">PDF</option>
          <option value="csv">CSV (Excel)</option>
          <option value="xlsx">Excel (.xlsx)</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={incluirCnpj} onChange={(e) => setIncluirCnpj(e.target.checked)} /> Incluir CNPJ
      </label>
    </FormDialog>
  );
}
