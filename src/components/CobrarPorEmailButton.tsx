import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CobrarPorEmailButtonProps {
  receitaId: string;
  onSuccess?: () => void;
}

export function CobrarPorEmailButton({ receitaId, onSuccess }: CobrarPorEmailButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-reminder", {
        body: { receita_id: receitaId },
      });

      if (error) {
        const body = error.context ? await error.context.json?.().catch(() => null) : null;
        throw new Error(body?.error || error.message || "Erro desconhecido");
      }
      if (data?.error) throw new Error(data.error);

      const result = data as { email?: string; vencida?: boolean };
      toast.success(result?.vencida ? "Aviso de atraso enviado" : "Lembrete enviado", {
        description: result?.email ? `Email enviado para ${result.email}` : undefined,
      });
      onSuccess?.();
    } catch (err: unknown) {
      toast.error("Erro ao enviar cobrança", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 text-xs h-8 border-success-mid-border text-success-strong hover:bg-success-soft"
      onClick={handleSend}
      disabled={isSending}
    >
      {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
      Cobrar por email
    </Button>
  );
}
