import { useState, useEffect } from "react";
import { Copy, Check, QrCode, Loader2, AlertTriangle } from "lucide-react";
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

function useCountdown(expirationDate: string) {
  const getSecondsLeft = () => Math.max(0, Math.floor((new Date(expirationDate).getTime() - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      const s = getSecondsLeft();
      setSecondsLeft(s);
      if (s <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expirationDate]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return { secondsLeft, display: `${mm}:${ss}` };
}

export function PixPayment({ encodedImage, payload, expirationDate, value, isPolling }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const { secondsLeft, display } = useCountdown(expirationDate);
  const expired = secondsLeft <= 0;

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

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100">
          <AlertTriangle className="w-7 h-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-medium text-slate-900">PIX expirado</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          O QR Code expirou após 30 minutos. Volte à página inicial e gere um novo pagamento.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand/10 text-brand mb-3">
          <QrCode className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-medium text-slate-900">Pague com PIX</h2>
        <p className="text-sm text-slate-500 mt-1">Valor: {formatBRL(value)}</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center">
        <img
          src={`data:image/png;base64,${encodedImage}`}
          alt="QR Code PIX"
          className="w-56 h-56 rounded-lg"
          style={{ opacity: secondsLeft < 120 ? 0.6 : 1 }}
        />
        <div
          className={`mt-4 flex items-center gap-1.5 text-sm font-mono font-semibold ${secondsLeft < 120 ? "text-red-500" : "text-slate-500"}`}
        >
          {secondsLeft < 120 && <AlertTriangle className="w-4 h-4" />}
          {display}
        </div>
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
