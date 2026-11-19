import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useImportarLeads } from "./prospeccaoApi";
import { lerPlanilha, ROTULO_DESCARTE, type PlanilhaLida } from "./prospeccaoImport";
import type { MotivoDescarte } from "./prospeccaoLib";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Importa a planilha de leads (SPEC 172, fase 0). A leitura é no navegador; o arquivo não é enviado. */
export function ImportarLeadsDialog({ open, onOpenChange }: Props) {
  const importar = useImportarLeads();
  const [lida, setLida] = useState<PlanilhaLida | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolher = async (arquivo: File | undefined) => {
    setLida(null);
    setErro(null);
    if (!arquivo) return;
    setLendo(true);
    try {
      setLida(await lerPlanilha(arquivo));
    } catch {
      setErro("Não consegui ler esse arquivo. Use um XLSX ou CSV com a coluna da empresa.");
    } finally {
      setLendo(false);
    }
  };

  const enviar = () => {
    if (!lida || lida.leads.length === 0) return;
    importar.mutate(lida.leads, {
      onSuccess: (r) => {
        toast.success(
          `${r.inseridos} lead(s) importado(s). ${r.jaExistiam} já existiam e ${r.bloqueados} estão bloqueados.`
        );
        setLida(null);
        onOpenChange(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  const descartados = lida
    ? (Object.entries(lida.descartes) as Array<[MotivoDescarte, number]>).filter(([, n]) => n > 0)
    : [];

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Importar leads"
      description="Escolha o XLSX (aba Todos os leads) ou o CSV. O arquivo é lido aqui no navegador; só os leads normalizados são gravados."
      onSubmit={enviar}
      submitLabel="Importar"
      isPending={importar.isPending}
      submitDisabled={!lida || lida.leads.length === 0 || lendo}
    >
      <div className="space-y-1.5">
        <Label htmlFor="prospec-arquivo">Arquivo</Label>
        <Input
          id="prospec-arquivo"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => void escolher(e.target.files?.[0])}
        />
      </div>
      {lendo && <p className="text-sm text-ink-muted">Lendo o arquivo...</p>}
      {erro && <p className="text-sm text-danger-strong">{erro}</p>}
      {lida && (
        <div className="space-y-1 text-sm" aria-live="polite">
          <p>
            <strong>{lida.leads.length}</strong> de {lida.linhas} linhas viram lead.
          </p>
          {descartados.length > 0 && (
            <p className="text-ink-muted">
              Descartadas: {descartados.map(([m, n]) => `${n} ${ROTULO_DESCARTE[m]}`).join(", ")}.
            </p>
          )}
          <p className="text-ink-muted">
            Leads que já existem (mesmo telefone ou e-mail) e números bloqueados são pulados.
          </p>
        </div>
      )}
    </FormDialog>
  );
}
