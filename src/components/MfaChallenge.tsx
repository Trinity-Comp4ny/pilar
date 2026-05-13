import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, Loader2, HelpCircle, RefreshCw, KeyRound } from "lucide-react";
import { useMfa } from "@/hooks/useMfa";
import { translateAuthError } from "@/lib/authErrors";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MfaHelpModal } from "@/components/MfaHelpModal";
import { callUntypedRpc } from "@/lib/supabaseRpc";

interface MfaChallengeProps {
  onVerified?: () => void;
}

export function MfaChallenge({ onVerified }: MfaChallengeProps) {
  const { factors, verifyTotp, unenrollPending, resetAllFactors, loading } = useMfa();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [backupMode, setBackupMode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [backupSubmitting, setBackupSubmitting] = useState(false);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  const handleVerify = async (finalCode: string) => {
    if (!verifiedFactor) return;
    if (!/^\d{6}$/.test(finalCode)) {
      toast.error("Código deve ter 6 dígitos");
      return;
    }

    setSubmitting(true);
    try {
      await verifyTotp(verifiedFactor.id, finalCode);
      toast.success("MFA verificado");
      onVerified?.();
    } catch (err) {
      toast.error("Código inválido", { description: translateAuthError(err) });
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (value.length === 6) {
      handleVerify(value);
    }
  };

  const handleBackupCode = async () => {
    const normalized = backupCode.trim().toUpperCase().replace(/\s/g, "");
    if (!normalized) {
      toast.error("Informe o código de recuperação");
      return;
    }
    setBackupSubmitting(true);
    try {
      const { data: valid, error } = await callUntypedRpc<boolean>("mfa_consume_backup_code", {
        p_code: normalized,
      });
      if (error) throw error;
      if (!valid) {
        toast.error("Código inválido ou já utilizado");
        return;
      }
      // Desregistra todos os fatores — sessão volta a AAL1/AAL1
      // PrivateRoute redirecionará para /mfa/setup
      await resetAllFactors();
      toast.success("Código de recuperação aceito", {
        description: "Configure um novo autenticador para continuar.",
      });
      navigate("/mfa/setup", { replace: true });
    } catch (err) {
      toast.error("Erro ao validar código", { description: translateAuthError(err) });
    } finally {
      setBackupSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!verifiedFactor) {
    const hasUnverified = factors.some((f) => f.status === "unverified");

    const handleResetAndSetup = async () => {
      setResetting(true);
      try {
        await unenrollPending();
        toast.success("Configuração reiniciada");
        navigate("/mfa/setup", { replace: true });
      } catch (err) {
        toast.error("Erro ao reiniciar", { description: translateAuthError(err) });
        setResetting(false);
      }
    };

    if (hasUnverified) {
      return (
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
              <ShieldCheck className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-ink">Configuração incompleta</h2>
            <p className="text-sm text-ink-soft leading-relaxed">
              O QR Code foi escaneado mas o código nunca foi confirmado.
              <br />
              Isso acontece quando o QR Code é lido pela câmera padrão em vez do app autenticador.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-amber-800">Como resolver:</p>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>
                Instale o <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>1Password</strong>
              </li>
              <li>Clique em "Reiniciar configuração" abaixo</li>
              <li>Use o app autenticador para escanear o novo QR Code</li>
            </ol>
          </div>
          <Button
            onClick={handleResetAndSetup}
            disabled={resetting}
            className="w-full h-11 bg-brand hover:bg-brand/90 text-ink font-medium"
          >
            {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Reiniciar configuração do MFA
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-center">
        <ShieldCheck className="h-12 w-12 mx-auto text-brand" />
        <h2 className="text-xl font-semibold text-ink">MFA não configurado</h2>
        <p className="text-sm text-ink-soft">
          Esta conta exige autenticação de dois fatores. Configure em Perfil &gt; Segurança.
        </p>
      </div>
    );
  }

  if (backupMode) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-amber-100 border border-amber-200">
              <KeyRound className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Código de recuperação</h2>
          <p className="text-sm text-ink-soft leading-relaxed">
            Digite um dos códigos de recuperação gerados durante o setup do MFA.
            <br />
            <span className="text-ink/40 text-xs">O código será invalidado após o uso.</span>
          </p>
        </div>

        <div className="space-y-4">
          <Input
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value)}
            placeholder="XXXX-XXXX"
            className="text-center font-mono text-lg tracking-widest h-12"
            disabled={backupSubmitting}
            onKeyDown={(e) => e.key === "Enter" && handleBackupCode()}
            autoFocus
          />

          <Button
            onClick={handleBackupCode}
            className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-medium"
            disabled={backupSubmitting || !backupCode.trim()}
          >
            {backupSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Usar código de recuperação
          </Button>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => { setBackupMode(false); setBackupCode(""); }}
              className="text-xs text-ink-soft hover:text-ink transition-colors underline"
            >
              Voltar para autenticador
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <MfaHelpModal open={helpOpen} onOpenChange={setHelpOpen} />

      <div className="space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-brand/10 border border-brand/20">
              <ShieldCheck className="h-8 w-8 text-brand" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Verificação de dois fatores</h2>
          <p className="text-sm text-ink-soft leading-relaxed">
            Abra seu app autenticador e digite o código de 6 dígitos
            <br />
            <span className="text-ink/40 text-xs">(Google Authenticator, Authy, 1Password)</span>
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={handleCodeChange} autoFocus disabled={submitting}>
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="!h-14 !w-11 !text-xl !font-semibold !rounded-xl !border !border-paper-border bg-paper-alt text-ink transition-all"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            onClick={() => handleVerify(code)}
            className="w-full h-11 bg-brand hover:bg-brand/90 text-ink font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98] text-sm"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verificar
          </Button>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:text-ink/70 transition-colors border border-paper-border hover:border-ink/30 bg-paper-alt hover:bg-paper-border px-3 py-1.5 rounded-full"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Como usar o app autenticador?
            </button>
            <button
              type="button"
              onClick={() => setBackupMode(true)}
              className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors"
            >
              <KeyRound className="h-3 w-3" />
              Não tenho acesso ao autenticador
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
