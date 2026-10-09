import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, RefreshCw, ShieldCheck } from "lucide-react";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { monitoring } from "@/lib/monitoring";
import { ConfirmDialog } from "@/components/ConfirmDialog";

import { BusyMark } from "@/components/motion/BusyMark";

// gen:types não inclui estas RPCs ainda
async function fetchRemainingCount(): Promise<number | null> {
  const { data, error } = await callUntypedRpc<number>("mfa_backup_codes_remaining");
  return error ? null : (data ?? 0);
}

async function generateCodes(): Promise<string[]> {
  const { data, error } = await callUntypedRpc<string[]>("mfa_generate_backup_codes");
  if (error) throw error;
  return data ?? [];
}

function reportGenerateError(err: unknown) {
  monitoring.captureException(err, { context: "generateBackupCodes" });
  toast.error("Erro ao gerar", {
    description: err instanceof Error ? err.message : "Confirme o código do app autenticador e tente de novo.",
  });
}

// autoGenerate: logo depois de ativar o 2FA, gera e mostra os códigos sem
// esperar clique. Sem isso ninguém gerava (produção tinha zero), e quem perdia o
// celular ficava sem saída.
export function MfaBackupCodes({ autoGenerate = false }: { autoGenerate?: boolean }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const count = await fetchRemainingCount();
      if (!active) return;
      if (count !== null) setRemaining(count);
      setLoading(false);
      if (!autoGenerate || count !== 0) return;
      setGenerating(true);
      try {
        const codes = await generateCodes();
        if (!active) return;
        setGeneratedCodes(codes);
        setRemaining(codes.length);
      } catch (err) {
        reportGenerateError(err);
      } finally {
        if (active) setGenerating(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [autoGenerate]);

  const handleGenerate = async () => {
    setConfirmOpen(false);
    setGenerating(true);
    try {
      const codes = await generateCodes();
      setGeneratedCodes(codes);
      setRemaining(codes.length);
      toast.success("Códigos gerados");
    } catch (err) {
      reportGenerateError(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCodes) return;
    try {
      await navigator.clipboard.writeText(generatedCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  if (loading) {
    return <BusyMark className="h-4 w-4 text-muted-foreground" />;
  }

  if (generatedCodes) {
    return (
      <div className="rounded-lg border border-warning-mid-border bg-warning-soft p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-warning-mid" />
          <span className="font-medium text-warning-strong">Salve estes códigos agora</span>
        </div>
        <p className="text-xs text-warning-strong">
          Se perder o celular, um destes códigos é a única forma de entrar. Cada um vale uma vez e eles não aparecem de
          novo.
        </p>
        <div className="grid grid-cols-2 gap-1.5 p-3 bg-white rounded border font-mono text-sm">
          {generatedCodes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Copiado" : "Copiar todos"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setGeneratedCodes(null)}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">Códigos de recuperação</div>
            <div className="text-xs text-muted-foreground">
              {remaining === 0
                ? "Nenhum disponível"
                : `${remaining ?? 0} código${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => (remaining ? setConfirmOpen(true) : handleGenerate())}
          disabled={generating}
        >
          {generating ? <BusyMark className="h-4 w-4 mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {remaining ? "Gerar novos" : "Gerar códigos"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleGenerate}
        title="Gerar novos códigos?"
        description="Os códigos anteriores não usados serão invalidados. Esta ação não pode ser desfeita."
        confirmText="Gerar novos"
        variant="destructive"
      />
    </div>
  );
}
