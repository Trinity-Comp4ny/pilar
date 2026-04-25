import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useMfa } from "@/hooks/useMfa";
import { translateAuthError } from "@/lib/authErrors";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface MfaChallengeProps {
  onVerified?: () => void;
}

export function MfaChallenge({ onVerified }: MfaChallengeProps) {
  const { factors, verifyTotp, loading } = useMfa();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      </div>
    </div>
  );
}
