import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Key } from "lucide-react";
import { useMfa } from "@/hooks/useMfa";
import { translateAuthError } from "@/lib/authErrors";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";

interface MfaChallengeProps {
  onVerified?: () => void;
}

export function MfaChallenge({ onVerified }: MfaChallengeProps) {
  const { factors, verifyTotp, loading } = useMfa();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
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

  const handleBackupVerify = async () => {
    const normalized = backupCode.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
      toast.error("Formato inválido", { description: "O código deve ter o formato XXXX-XXXX." });
      return;
    }
    setBackupSubmitting(true);
    try {
      // mfa_consume_backup_code não está nos tipos gerados ainda
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: valid, error } = await (supabase.rpc as any)("mfa_consume_backup_code", { p_code: normalized });
      if (error || !valid) {
        toast.error("Código inválido ou já utilizado");
        return;
      }
      toast.success("Código de backup aceito");
      onVerified?.();
    } catch {
      toast.error("Erro ao verificar código");
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
    return (
      <div className="space-y-4 text-center">
        <ShieldCheck className="h-12 w-12 mx-auto text-accent-orange" />
        <h2 className="text-xl font-semibold text-ink">MFA não configurado</h2>
        <p className="text-sm text-ink-soft">
          Esta conta exige autenticação de dois fatores. Configure em Perfil &gt; Segurança.
        </p>
      </div>
    );
  }

  if (useBackup) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
              <Key className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Código de backup</h2>
          <p className="text-sm text-ink-soft leading-relaxed">
            Digite um dos seus códigos de backup no formato <span className="font-mono">XXXX-XXXX</span>
          </p>
        </div>

        <div className="space-y-4">
          <Input
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            className="text-center font-mono text-lg h-12 tracking-widest"
            maxLength={9}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleBackupVerify()}
          />
          <Button
            onClick={handleBackupVerify}
            className="w-full h-11 bg-accent-orange hover:bg-accent-orange/90 text-ink font-medium"
            disabled={backupSubmitting || backupCode.length < 9}
          >
            {backupSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verificar código
          </Button>
          <Button variant="ghost" className="w-full text-ink-soft text-sm" onClick={() => setUseBackup(false)}>
            Voltar para o app autenticador
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-2xl bg-accent-orange/10 border border-accent-orange/20">
            <ShieldCheck className="h-8 w-8 text-accent-orange" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Verificação de dois fatores</h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          Digite o código do seu app autenticador
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
          className="w-full h-11 bg-accent-orange hover:bg-accent-orange/90 text-ink font-medium shadow-lg shadow-accent-orange/20 hover:shadow-accent-orange/30 transition-all active:scale-[0.98] text-sm"
          disabled={submitting || code.length !== 6}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Verificar
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setUseBackup(true)}
            className="text-xs text-ink-soft hover:text-accent-orange transition-colors underline-offset-2 hover:underline"
          >
            Sem acesso ao app? Usar código de backup
          </button>
        </div>
      </div>
    </div>
  );
}
