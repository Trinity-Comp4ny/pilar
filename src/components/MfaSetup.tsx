import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, Loader2, Trash2, HelpCircle, Copy, Check, RefreshCw } from "lucide-react";
import { useMfa, type MfaEnrollResult } from "@/hooks/useMfa";
import { translateAuthError } from "@/lib/authErrors";
import { MfaHelpModal } from "@/components/MfaHelpModal";
import { MfaBackupCodes } from "@/components/MfaBackupCodes";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// ─── OTP Input ────────────────────────────────────────────────────────────────

interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const focus = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = digits
      .map((d, idx) => (idx === i ? digit : d))
      .join("")
      .replace(/ /g, "");
    onChange(next);
    if (digit && i < 5) focus(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = digits
          .map((d, idx) => (idx === i ? "" : d))
          .join("")
          .replace(/ /g, "");
        onChange(next.padEnd(i, digits.slice(0, i).join("")));
        const cleared = value.split("");
        cleared[i] = "";
        onChange(cleared.join("").trimEnd());
      } else if (i > 0) {
        focus(i - 1);
        const cleared = value.split("");
        cleared[i - 1] = "";
        onChange(cleared.join("").trimEnd());
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < 5) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted);
    focus(Math.min(pasted.length, 5));
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-11 h-14 text-center text-xl font-semibold border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 transition-colors"
        />
      ))}
    </div>
  );
}

// ─── MFA Enroll Modal ─────────────────────────────────────────────────────────

interface MfaEnrollModalProps {
  open: boolean;
  enrollment: MfaEnrollResult;
  onClose: () => void;
  onVerified: () => void;
}

function MfaEnrollModal({ open, enrollment, onClose, onVerified }: MfaEnrollModalProps) {
  const { verifyTotp } = useMfa();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasSubmitted = useRef(false);

  useEffect(() => {
    if (!open) {
      setCode("");
      hasSubmitted.current = false;
    }
  }, [open]);

  const handleVerify = useCallback(
    async (otp: string) => {
      if (submitting || hasSubmitted.current || otp.length !== 6) return;
      hasSubmitted.current = true;
      setSubmitting(true);
      try {
        await verifyTotp(enrollment.factorId, otp);
        toast.success("MFA ativado");
        onVerified();
      } catch (err) {
        toast.error("Código inválido", { description: translateAuthError(err) });
        setCode("");
        hasSubmitted.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, enrollment.factorId, verifyTotp, onVerified]
  );

  const handleCodeChange = (v: string) => {
    setCode(v);
    if (v.length === 6) handleVerify(v);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar autenticação de dois fatores</DialogTitle>
            <DialogDescription>Escaneie o QR Code com seu aplicativo autenticador.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-col items-center gap-1">
              <div className="p-3 bg-white rounded-xl border shadow-sm">
                <img src={enrollment.qrCode} alt="QR Code MFA" className="w-44 h-44" />
              </div>
              <p className="text-xs text-muted-foreground">Google Authenticator · Authy · 1Password</p>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground text-center">Ou adicione a chave manualmente:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs break-all select-all font-mono">
                  {enrollment.secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={handleCopy}
                  aria-label="Copiar chave"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-center">Digite o código do aplicativo</p>
              <OtpInput value={code} onChange={handleCodeChange} disabled={submitting} />
              {submitting && (
                <div className="flex justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-1">
              <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
                <HelpCircle className="h-4 w-4 mr-1" />
                Ajuda
              </Button>
              <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <MfaHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

// ─── MfaSetup ─────────────────────────────────────────────────────────────────

export function MfaSetup() {
  const { factors, enrollTotp, unenroll, resetAllFactors, unenrollPending, refresh, loading } = useMfa();
  const [enrollment, setEnrollment] = useState<MfaEnrollResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [reenrollConfirm, setReenrollConfirm] = useState(false);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await resetAllFactors();
      const result = await enrollTotp("Authenticator");
      setEnrollment(result);
    } catch (err) {
      toast.error("Falha ao iniciar MFA", { description: translateAuthError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveConfirmed = async () => {
    if (!removeConfirmId) return;
    const factorId = removeConfirmId;
    setRemoveConfirmId(null);
    try {
      await unenroll(factorId);
      toast.success("MFA removido");
    } catch (err) {
      toast.error("Falha ao remover", { description: translateAuthError(err) });
    }
  };

  const handleReenrollConfirmed = async () => {
    setReenrollConfirm(false);
    setSubmitting(true);
    try {
      // Remove apenas fatores pendentes não verificados (preserva o verificado até novo ser confirmado)
      await unenrollPending();
      // Nome único para evitar conflito com fator verificado existente
      const tempName = `Authenticator-${Date.now()}`;
      const result = await enrollTotp(tempName);
      setEnrollment({ ...result, oldFactorId: verifiedFactor?.id });
    } catch (err) {
      toast.error("Falha ao trocar autenticador", { description: translateAuthError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setEnrollment(null);
    refresh();
  };

  const handleVerified = async () => {
    // Se era um reenroll, remove o fator antigo agora que o novo está verificado
    if (enrollment?.oldFactorId) {
      try {
        await unenroll(enrollment.oldFactorId);
      } catch {
        // best-effort: fator antigo pode já ter sido removido
      }
    }
    setEnrollment(null);
    refresh();
  };

  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  return (
    <>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-5 w-5 ${verifiedFactor ? "text-positive" : "text-muted-foreground"}`} />
          <span className="font-medium">{verifiedFactor ? "MFA ativo" : "MFA não configurado"}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {verifiedFactor
            ? "Autenticação de dois fatores está protegendo esta conta."
            : "Adicione autenticação de dois fatores para proteger ações administrativas."}
        </p>
        <div className="flex flex-wrap gap-2">
          {verifiedFactor ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setReenrollConfirm(true)} disabled={submitting}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Trocar autenticador
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRemoveConfirmId(verifiedFactor.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remover MFA
              </Button>
            </>
          ) : (
            <Button onClick={handleStart} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Configurar MFA
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            {verifiedFactor ? "Ajuda" : "Como funciona?"}
          </Button>
        </div>
      </div>

      {/* Códigos de recuperação — indispensáveis se o autenticador for perdido */}
      {verifiedFactor && <MfaBackupCodes />}

      {enrollment && <MfaEnrollModal open enrollment={enrollment} onClose={handleClose} onVerified={handleVerified} />}

      <MfaHelpModal open={helpOpen} onOpenChange={setHelpOpen} />

      <ConfirmDialog
        open={removeConfirmId !== null}
        onOpenChange={(v) => {
          if (!v) setRemoveConfirmId(null);
        }}
        onConfirm={handleRemoveConfirmed}
        title="Remover MFA?"
        description="Admins sem MFA terão acesso limitado. Você pode reconfigurar a qualquer momento."
        confirmText="Remover"
        variant="destructive"
      />

      <ConfirmDialog
        open={reenrollConfirm}
        onOpenChange={setReenrollConfirm}
        onConfirm={handleReenrollConfirmed}
        title="Trocar autenticador?"
        description="Você vai escanear um novo QR Code. O autenticador atual só será removido após confirmar o novo código."
        confirmText="Continuar"
        variant="default"
      />
    </>
  );
}
