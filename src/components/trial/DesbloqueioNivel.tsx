import { useRef, useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDocument, onlyDigits, validateCNPJ, validateCPF } from "@/lib/maskUtils";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { analytics } from "@/lib/analytics";
import type { RecursoCapacidade } from "@/lib/capacidade";

const NOME_RECURSO: Record<RecursoCapacidade, string> = {
  projetos: "projetos",
  obras: "obras",
};

interface DesbloqueioNivelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurso: RecursoCapacidade;
  limite: number | null;
  isAdmin: boolean;
}

/**
 * SPEC 098, requisitos 10 e 19: aberto quando o trigger de capacidade recusa
 * criar projeto/obra. Admin informa CNPJ ou CPF pra subir a empresa a Prata
 * (mais capacidade); quem não é admin só avisa quem pode fazer isso.
 */
export function DesbloqueioNivel({ open, onOpenChange, recurso, limite, isAdmin }: DesbloqueioNivelProps) {
  if (isAdmin) {
    return <DesbloqueioDocumento open={open} onOpenChange={onOpenChange} recurso={recurso} limite={limite} />;
  }
  return <AvisarAdministrador open={open} onOpenChange={onOpenChange} recurso={recurso} limite={limite} />;
}

function limiteFrase(recurso: RecursoCapacidade, limite: number | null): string {
  const nome = NOME_RECURSO[recurso];
  if (limite == null) return `o limite de ${nome} do período de teste`;
  return `o limite de ${limite} ${nome} do período de teste`;
}

function DesbloqueioDocumento({ open, onOpenChange, recurso, limite }: Omit<DesbloqueioNivelProps, "isAdmin">) {
  const [documento, setDocumento] = useState("");
  const [isPending, setIsPending] = useState(false);
  const sucedeu = useRef(false);
  const digits = onlyDigits(documento);
  const valido = digits.length === 14 ? validateCNPJ(digits) : digits.length === 11 ? validateCPF(digits) : false;

  const handleOpenChange = (v: boolean) => {
    if (!v && !sucedeu.current) {
      analytics.track("trial_desbloqueio_abandonado", { recurso, via: "documento" });
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!valido) return;
    setIsPending(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ error?: string; status?: string }>(
        "verificar-documento",
        { body: { documento: digits } }
      );
      if (error) {
        throw new Error(await edgeFunctionErrorMessage(error, "Falha ao verificar o documento"));
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      sucedeu.current = true;
      analytics.track("trial_nivel_subiu", { recurso, status: data?.status ?? "verificado" });
      toast.success("Documento confirmado", {
        description:
          data?.status === "pendente"
            ? "Vamos reconfirmar em breve; sua capacidade já subiu enquanto isso."
            : "Sua empresa já tem mais capacidade. Tente criar de novo.",
      });
      setDocumento("");
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível confirmar o documento", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Você atingiu um limite do período de teste"
      description={`Sua empresa bateu ${limiteFrase(recurso, limite)}. Informe o CNPJ ou CPF da empresa para liberar mais capacidade.`}
      size="sm"
      onSubmit={handleSubmit}
      submitLabel="Confirmar documento"
      isPending={isPending}
      submitDisabled={!valido}
    >
      <div className="space-y-2">
        <Label htmlFor="desbloqueio-documento">CNPJ ou CPF</Label>
        <Input
          id="desbloqueio-documento"
          value={formatDocument(documento)}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="00.000.000/0000-00"
          autoFocus
        />
        {documento && !valido && <p className="text-sm text-destructive">Documento inválido.</p>}
      </div>
    </FormDialog>
  );
}

function AvisarAdministrador({ open, onOpenChange, recurso, limite }: Omit<DesbloqueioNivelProps, "isAdmin">) {
  const [isPending, setIsPending] = useState(false);
  const sucedeu = useRef(false);

  const handleOpenChange = (v: boolean) => {
    if (!v && !sucedeu.current) {
      analytics.track("trial_desbloqueio_abandonado", { recurso, via: "avisar_admin" });
    }
    onOpenChange(v);
  };

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      const { error } = await supabase.rpc("avisar_admin_capacidade", { p_recurso: recurso });
      if (error) throw error;
      sucedeu.current = true;
      analytics.track("trial_admin_avisado", { recurso });
      toast.success("Administrador avisado", {
        description: "Quem administra sua empresa foi notificado para liberar mais capacidade.",
      });
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível avisar o administrador", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      title="Você atingiu um limite do período de teste"
      description={`Sua empresa bateu ${limiteFrase(recurso, limite)}. Só um administrador pode liberar mais capacidade; avise agora e continue depois.`}
      variant="default"
      confirmText="Avisar administrador"
      cancelText="Fechar"
      loading={isPending}
    />
  );
}
