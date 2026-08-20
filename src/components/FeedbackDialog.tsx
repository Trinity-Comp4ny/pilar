import { useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { monitoring } from "@/lib/monitoring";
import { getSafeErrorMessage } from "@/lib/safeError";

type FeedbackTipo = "bug" | "sugestao";

export type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Modal único de feedback: bug vira User Feedback no Sentry (sendFeedback,
 * sem UI própria do SDK); sugestão vira linha em feature_suggestions, visível
 * só pro ultra admin em /ultra-admin. Sem histórico nem lista pro usuário:
 * envia e confirma.
 */
export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user, profile } = useAuth();
  const [tipo, setTipo] = useState<FeedbackTipo>("bug");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setTipo("bug");
    setTitulo("");
    setMensagem("");
  };

  const canSubmit = !isSubmitting && mensagem.trim().length > 0 && (tipo === "bug" || titulo.trim().length > 0);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (tipo === "bug") {
        await monitoring.submitBugFeedback(mensagem.trim(), {
          email: user?.email ?? undefined,
          name: profile?.nome ?? undefined,
        });
        toast.success("Relato enviado, obrigado!");
      } else {
        if (!user) throw new Error("Sessão expirada");
        const { error } = await supabase
          .from("feature_suggestions")
          .insert({ titulo: titulo.trim(), descricao: mensagem.trim(), created_by: user.id });
        if (error) throw error;
        toast.success("Sugestão enviada, obrigado!");
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error("Erro ao enviar", { description: getSafeErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Feedback"
      description="Relate um problema ou sugira uma melhoria pro Pilar."
      size="md"
      isPending={isSubmitting}
      submitDisabled={!canSubmit}
      submitLabel="Enviar"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de feedback">
        <button
          type="button"
          role="radio"
          aria-checked={tipo === "bug"}
          onClick={() => setTipo("bug")}
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
            tipo === "bug" ? "border-brand/40 bg-brand/5" : "border-black/10 hover:border-black/20"
          )}
        >
          <Bug size={16} strokeWidth={1.5} />
          Reportar problema
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={tipo === "sugestao"}
          onClick={() => setTipo("sugestao")}
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
            tipo === "sugestao" ? "border-brand/40 bg-brand/5" : "border-black/10 hover:border-black/20"
          )}
        >
          <Lightbulb size={16} strokeWidth={1.5} />
          Sugerir melhoria
        </button>
      </div>

      {tipo === "sugestao" && (
        <div className="space-y-2">
          <Label htmlFor="feedback-titulo">Título</Label>
          <Input
            id="feedback-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Exportar relatório em PDF"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="feedback-mensagem">{tipo === "bug" ? "O que aconteceu?" : "Descrição"}</Label>
        <Textarea
          id="feedback-mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder={
            tipo === "bug" ? "Descreva o problema que você encontrou" : "O que você gostaria que o Pilar fizesse?"
          }
          rows={4}
        />
      </div>
    </FormDialog>
  );
}
