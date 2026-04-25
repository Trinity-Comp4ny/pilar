import { useState } from "react";
import { Copy, Check, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PixPaymentProps {
  encodedImage: string;
  payload: string;
  expirationDate: string;
  value: number;
  isPolling: boolean;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PixPayment({ encodedImage, payload, expirationDate, value, isPolling }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Código PIX copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-6">
      <header className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-orange/10 text-accent-orange mb-3">
          <QrCode className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-medium text-slate-900">Pague com PIX</h2>
        <p className="text-sm text-slate-500 mt-1">Valor: {formatBRL(value)}</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center">
        <img src={`data:image/png;base64,${encodedImage}`} alt="QR Code PIX" className="w-56 h-56 rounded-lg" />
        <p className="text-xs text-slate-400 mt-4">Vence em {new Date(expirationDate).toLocaleString("pt-BR")}</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-2">Ou copie o código:</p>
        <div className="flex gap-2">
          <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 truncate">
            {payload}
          </div>
          <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 pt-2">
        {isPolling ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Aguardando pagamento...
          </>
        ) : (
          <span>Verificando pagamento...</span>
        )}
      </div>
    </div>
  );
}
