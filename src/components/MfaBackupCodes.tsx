import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, RefreshCw, ShieldCheck, Loader2 } from "lucide-react";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function MfaBackupCodes() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchRemaining = async () => {
    // gen:types não inclui esta RPC ainda
    const { data, error } = await callUntypedRpc<number>("mfa_backup_codes_remaining");
    if (!error) setRemaining(data ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchRemaining();
  }, []);

  const handleGenerate = async () => {
    setConfirmOpen(false);
    setGenerating(true);
    try {
      // gen:types não inclui esta RPC ainda
      const { data, error } = await callUntypedRpc<string[]>("mfa_generate_backup_codes");
      if (error) throw error;
      setGeneratedCodes(data ?? []);
      await fetchRemaining();
      toast.success("Códigos gerados");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar", {
        description: err instanceof Error ? err.message : "Verifique se MFA está ativo",
      });
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
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (generatedCodes) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-amber-700" />
          <span className="font-medium text-amber-900">Salve estes códigos agora</span>
        </div>
        <p className="text-xs text-amber-800">
          Cada código vale uma vez. Use apenas se perder acesso ao autenticador. Não serão exibidos de novo.
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
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
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
