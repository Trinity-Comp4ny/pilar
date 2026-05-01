import { useState } from "react";
import { Copy, Check, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BoletoPaymentProps {
  bankSlipUrl: string | null;
  identificationField: string | null;
  value: number;
  isPolling: boolean;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BoletoPayment({ bankSlipUrl, identificationField, value, isPolling }: BoletoPaymentProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!identificationField) return;
    try {
      await navigator.clipboard.writeText(identificationField.replace(/\s/g, ""));
      setCopied(true);
      toast.success("Linha digitável copiada");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-6">
      <header className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand/10 text-brand mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-medium text-slate-900">Boleto gerado</h2>
        <p className="text-sm text-slate-500 mt-1">Valor: {formatBRL(value)}</p>
      </header>

      {identificationField && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Linha digitável:</p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 break-all">
              {identificationField}
            </div>
            <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {bankSlipUrl && (
        <a
          href={bankSlipUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 rounded-lg bg-ink-soft text-white flex items-center justify-center gap-2 text-sm font-medium hover:bg-black transition-colors"
        >
          <Download className="w-4 h-4" /> Baixar PDF do boleto
        </a>
      )}

      <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
        Após o pagamento, o banco leva de 1 a 3 dias úteis pra processar. Assim que cair, enviamos email com o link de
        acesso ao Pilar.
      </p>

      <div className="flex items-center justify-center gap-2 text-sm text-slate-500 pt-2">
        {isPolling && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Aguardando pagamento...
          </>
        )}
      </div>
    </div>
  );
}
