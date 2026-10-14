import { useRef, useState } from "react";
import { Bug, ImagePlus, Lightbulb, MonitorUp } from "lucide-react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { PrintAnnotator, type PrintAnnotatorHandle } from "@/components/feedback/PrintAnnotator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { monitoring } from "@/lib/monitoring";
import { getSafeErrorMessage } from "@/lib/safeError";
import { capturarTela, carregarImagem, montarContexto, podeCapturarTela } from "@/lib/feedbackPrint";

type FeedbackTipo = "bug" | "sugestao";

export type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Espera o modal sumir antes de capturar, senão ele aparece no próprio print. */
const ESPERA_FECHAR_MODAL_MS = 250;

/**
 * Modal único de feedback (SPEC 056, evoluído na SPEC 112): bug e sugestão
 * gravam em feature_suggestions, com print anotado opcional no bucket privado
 * feedback-prints, e avisam o ultra admin no sino. Bug também vai pro Sentry
 * (best-effort) pra ligar ao replay. Sem histórico pro usuário: envia e confirma.
 */
export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user, profile } = useAuth();
  const [tipo, setTipo] = useState<FeedbackTipo>("bug");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [capturando, setCapturando] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const annotatorRef = useRef<PrintAnnotatorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTipo("bug");
    setTitulo("");
    setMensagem("");
    setImagem(null);
  };

  const canSubmit = !isSubmitting && mensagem.trim().length > 0 && (tipo === "bug" || titulo.trim().length > 0);

  const anexar = async (blob: Blob) => {
    try {
      setImagem(await carregarImagem(blob));
    } catch (err) {
      toast.error("Não deu pra anexar o print", { description: getSafeErrorMessage(err) });
    }
  };

  const handleCapturar = async () => {
    setCapturando(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, ESPERA_FECHAR_MODAL_MS));
      await anexar(await capturarTela());
    } catch (err) {
      // Cancelar o seletor do navegador não é erro pro usuário.
      if (err instanceof DOMException && err.name === "NotAllowedError") return;
      toast.error("Não deu pra capturar a tela", {
        description: "Tire um print pelo sistema e use Enviar imagem.",
      });
    } finally {
      setCapturando(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const arquivo = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (!arquivo) return;
    e.preventDefault();
    void anexar(arquivo);
  };

  const enviarPrint = async (userId: string): Promise<string | null> => {
    if (!imagem || !annotatorRef.current) return null;
    const { blob, extensao } = await annotatorRef.current.exportar();
    const path = `${userId}/${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage
      .from("feedback-prints")
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Sua sessão expirou", { description: "Entre de novo e reenvie o feedback." });
      return;
    }
    setIsSubmitting(true);
    try {
      const printPath = await enviarPrint(user.id);
      const sentryEventId =
        tipo === "bug"
          ? await monitoring.submitBugFeedback(mensagem.trim(), {
              email: user.email ?? undefined,
              name: profile?.nome ?? undefined,
            })
          : undefined;
      const { error } = await supabase.from("feature_suggestions").insert({
        tipo,
        titulo: tipo === "sugestao" ? titulo.trim() : null,
        descricao: mensagem.trim(),
        created_by: user.id,
        print_path: printPath,
        contexto: montarContexto(window.location, window, navigator.userAgent, __SENTRY_RELEASE__),
        sentry_event_id: sentryEventId ?? null,
      });
      if (error) throw error;
      toast.success(tipo === "bug" ? "Relato enviado. Obrigado!" : "Sugestão enviada. Obrigado!");
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error("Não deu pra enviar o feedback", {
        description: `${getSafeErrorMessage(err)} Seu texto continua aqui, tente de novo.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormDialog
      // Some durante a captura pra não sair no print; o estado fica aqui, não no modal.
      open={open && !capturando}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Feedback"
      description="Relate um problema ou sugira uma melhoria pro Pilar."
      size={imagem ? "lg" : "md"}
      isPending={isSubmitting}
      submitDisabled={!canSubmit}
      submitLabel="Enviar"
      onSubmit={handleSubmit}
    >
      <div className="space-y-4" onPaste={handlePaste}>
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
              maxLength={200}
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
            maxLength={5000}
          />
        </div>

        <div className="space-y-2">
          <Label>Print (opcional)</Label>
          {imagem ? (
            <PrintAnnotator ref={annotatorRef} imagem={imagem} onRemover={() => setImagem(null)} />
          ) : (
            <div className="space-y-2 rounded-lg border border-dashed border-black/15 p-3">
              <div className="flex flex-wrap gap-2">
                {podeCapturarTela() && (
                  <Button type="button" variant="outline" size="sm" onClick={handleCapturar}>
                    <MonitorUp size={14} strokeWidth={1.5} />
                    Capturar tela
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={14} strokeWidth={1.5} />
                  Enviar imagem
                </Button>
              </div>
              <p className="text-xs text-black/50">
                Ou cole um print (Ctrl+V ou ⌘V). Depois dá pra marcar o ponto exato.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = "";
                  if (arquivo) void anexar(arquivo);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
