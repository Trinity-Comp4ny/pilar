import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  LogOut,
  Copy,
  Check,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { useMfa, type MfaEnrollResult } from "@/hooks/useMfa";
import { useAuth } from "@/contexts/AuthContext";
import { translateAuthError } from "@/lib/authErrors";
import { MfaHelpModal } from "@/components/MfaHelpModal";
import { MfaBackupCodes } from "@/components/MfaBackupCodes";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";

// ─── OTP Input ────────────────────────────────────────────────────────────────

function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
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
        const cleared = value.split("");
        cleared[i] = "";
        onChange(cleared.join("").trimEnd());
      } else if (i > 0) {
        focus(i - 1);
        const cleared = value.split("");
        cleared[i - 1] = "";
        onChange(cleared.join("").trimEnd());
      }
    } else if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
    else if (e.key === "ArrowRight" && i < 5) focus(i + 1);
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
          className="w-11 h-14 text-center text-xl font-semibold border border-paper-border rounded-lg bg-paper-alt focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand disabled:opacity-50 transition-colors text-ink"
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Page ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = "mfa_setup_enrollment";

function saveEnrollment(data: MfaEnrollResult) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadEnrollment(): MfaEnrollResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MfaEnrollResult) : null;
  } catch {
    return null;
  }
}

function clearEnrollment() {
  sessionStorage.removeItem(SESSION_KEY);
}

export default function MfaSetupPage() {
  usePageTitle("Configurar autenticação de dois fatores");

  const navigate = useNavigate();
  const { signOut, refreshMfaLevel } = useAuth();
  const { enrollTotp, resetAllFactors, verifyTotp } = useMfa();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [enrollment, setEnrollment] = useState<MfaEnrollResult | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasSubmitted = useRef(false);

  const startEnrollment = useCallback(
    async (force = false) => {
      setStarting(true);
      setStartError(null);

      if (!force) {
        const saved = loadEnrollment();
        if (saved) {
          setEnrollment(saved);
          setStarting(false);
          return;
        }
      }

      setEnrollment(null);
      try {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const alreadyVerified = factorsData?.totp?.some((f) => f.status === "verified");
        if (alreadyVerified && !force) {
          navigate("/inicio", { replace: true });
          return;
        }
        await resetAllFactors();
        const result = await enrollTotp("Authenticator");
        saveEnrollment(result);
        setEnrollment(result);
      } catch (err) {
        setStartError(translateAuthError(err));
      } finally {
        setStarting(false);
      }
    },
    [resetAllFactors, enrollTotp, navigate]
  );

  useEffect(() => {
    startEnrollment();
  }, []);

  const handleVerify = useCallback(
    async (otp: string) => {
      if (!enrollment || submitting || hasSubmitted.current || otp.length !== 6) return;
      hasSubmitted.current = true;
      setSubmitting(true);
      try {
        await verifyTotp(enrollment.factorId, otp);
        clearEnrollment();
        await refreshMfaLevel();
        toast.success("MFA configurado com sucesso");
        // Passo 5: exibir códigos de recuperação ANTES de liberar o app.
        // Sem isto, quem perde o autenticador fica trancado para sempre.
        setStep(5);
      } catch (err) {
        toast.error("Código inválido", { description: translateAuthError(err) });
        setCode("");
        hasSubmitted.current = false;
      } finally {
        setSubmitting(false);
      }
    },
    [enrollment, submitting, verifyTotp, refreshMfaLevel, navigate]
  );

  const handleCodeChange = (v: string) => {
    setCode(v);
    if (v.length === 6) handleVerify(v);
  };

  const handleCopy = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="landing-grain min-h-screen w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-[100px] animate-aurora" />
        </div>

        <button
          onClick={handleLogout}
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>

        <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-left-8 duration-700">
          {/* Header fixo */}
          <div className="space-y-4 mb-8">
            <div className="flex justify-center items-center gap-2">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-10 w-auto hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-2xl font-medium tracking-tight text-ink">
                Pilar<sup className="text-[10px] font-normal text-ink-disabled ml-0.5 relative -top-2.5">®</sup>
              </span>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2">
              {([1, 2, 3, 4, 5] as const).map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step ? "w-6 bg-brand" : s < step ? "w-4 bg-brand/40" : "w-4 bg-paper-border"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* ── Etapa 1: Instalar app ────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-3">
                  <div className="p-3 rounded-full bg-brand/10">
                    <ShieldCheck className="h-7 w-7 text-ink" />
                  </div>
                </div>
                <h1 className="text-xl font-semibold text-ink">Passo 1 de 5 — Instalar o app</h1>
                <p className="text-sm text-ink-soft">
                  Escolha <strong className="text-ink">qualquer um</strong> dos apps abaixo e instale no seu celular.
                  Todos funcionam da mesma forma.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { name: "Google Authenticator", hint: "Android e iOS" },
                  { name: "Authy", hint: "Android, iOS e Desktop" },
                  { name: "1Password", hint: "Se já usa 1Password" },
                ].map((app) => (
                  <div
                    key={app.name}
                    className="flex items-center rounded-xl border border-paper-border bg-paper-alt px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{app.name}</p>
                      <p className="text-xs text-ink-soft">{app.hint}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="brand" className="w-full h-11 font-medium" onClick={() => setStep(2)}>
                Já tenho o app instalado →
              </Button>
            </div>
          )}

          {/* ── Etapa 2: Abrir modo de scan ──────────────────────── */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-3">
                  <div className="p-3 rounded-full bg-brand/10">
                    <ShieldCheck className="h-7 w-7 text-ink" />
                  </div>
                </div>
                <h1 className="text-xl font-semibold text-ink">Passo 2 de 5 — Abrir o app</h1>
                <p className="text-sm text-ink-soft">Prepare o app para escanear o QR Code.</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-paper-border bg-paper-alt p-4 space-y-3">
                  <p className="text-sm font-semibold text-ink">No app autenticador:</p>
                  <ol className="space-y-2 text-sm text-ink-soft">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-ink text-xs font-bold flex items-center justify-center mt-0.5">
                        1
                      </span>
                      Abra o app no celular
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-ink text-xs font-bold flex items-center justify-center mt-0.5">
                        2
                      </span>
                      Toque no botão <strong className="text-ink">+</strong> ou "Adicionar conta"
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-ink text-xs font-bold flex items-center justify-center mt-0.5">
                        3
                      </span>
                      Selecione <strong className="text-ink">"Escanear QR Code"</strong>
                    </li>
                  </ol>
                </div>

                <div className="rounded-xl border border-danger-mid-border bg-danger-soft px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-danger-mid flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-danger-strong">
                    <strong>Não abra a câmera padrão do celular.</strong> O QR Code só funciona dentro do app
                    autenticador.
                  </p>
                </div>
              </div>

              <Button variant="brand" className="w-full h-11 font-medium" onClick={() => setStep(3)}>
                Estou com o app pronto para escanear →
              </Button>

              <button
                onClick={() => setStep(1)}
                className="w-full text-xs text-ink-soft hover:text-brand transition-colors text-center"
              >
                ← Voltar
              </button>
            </div>
          )}

          {/* ── Etapa 3: Escanear QR Code ────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <h1 className="text-xl font-semibold text-ink">Passo 3 de 5 — Escanear</h1>
                <p className="text-sm text-ink-soft">Aponte o app para o QR Code abaixo.</p>
              </div>

              {starting && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
                  <p className="text-sm text-ink-soft">Gerando QR Code...</p>
                </div>
              )}

              {!starting && startError && (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <p className="text-sm text-destructive">{startError}</p>
                  <Button variant="outline" size="sm" onClick={() => startEnrollment(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                  </Button>
                </div>
              )}

              {!starting && enrollment && (
                <>
                  <div className="flex flex-col items-center">
                    <div className="p-4 bg-white rounded-2xl border border-paper-border shadow-md">
                      <img src={enrollment.qrCode} alt="QR Code MFA" className="w-48 h-48" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-ink-soft text-center">
                      Prefere adicionar manualmente? Cole esta chave no app:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-2 py-1.5 bg-paper-alt border border-paper-border rounded text-xs break-all select-all font-mono text-ink">
                        {enrollment.secret}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={handleCopy}
                        aria-label={copied ? "Copiado" : "Copiar chave"}
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <Button variant="brand" className="w-full h-11 font-medium" onClick={() => setStep(4)}>
                    Escanei o QR Code →
                  </Button>
                </>
              )}

              <button
                onClick={() => setStep(2)}
                className="w-full text-xs text-ink-soft hover:text-brand transition-colors text-center"
              >
                ← Voltar
              </button>
            </div>
          )}

          {/* ── Etapa 4: Digitar código ──────────────────────────── */}
          {step === 4 && enrollment && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <h1 className="text-xl font-semibold text-ink">Passo 4 de 5 — Confirmar</h1>
                <p className="text-sm text-ink-soft">Digite o código de 6 dígitos que aparece no app agora.</p>
              </div>

              <div className="space-y-4">
                <OtpInput value={code} onChange={handleCodeChange} disabled={submitting} />
                {submitting && (
                  <div className="flex justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
                  </div>
                )}
              </div>

              <Button
                variant="brand"
                className="w-full h-11 font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98]"
                onClick={() => handleVerify(code)}
                disabled={code.length < 6 || submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar e acessar
              </Button>

              <div className="flex flex-col items-center gap-2">
                <button onClick={() => setStep(3)} className="text-xs text-ink-soft hover:text-brand transition-colors">
                  ← Voltar para o QR Code
                </button>
                <button
                  onClick={() => setHelpOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-brand transition-colors"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Precisa de ajuda?
                </button>
              </div>
            </div>
          )}

          {/* ── Etapa 5: Códigos de recuperação (obrigatório) ────── */}
          {step === 5 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-3">
                  <div className="p-3 rounded-full bg-brand/10">
                    <ShieldCheck className="h-7 w-7 text-ink" />
                  </div>
                </div>
                <h1 className="text-xl font-semibold text-ink">Passo 5 de 5 — Salve seus códigos</h1>
                <p className="text-sm text-ink-soft">
                  Se você perder o acesso ao autenticador, estes códigos são a{" "}
                  <strong className="text-ink">única forma</strong> de entrar. Gere agora e guarde num lugar seguro.
                </p>
              </div>

              <MfaBackupCodes />

              <Button
                variant="brand"
                className="w-full h-11 font-medium"
                onClick={() => navigate("/inicio", { replace: true })}
              >
                Já salvei — acessar o Pilar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Lado Direito - Visual */}
      <div className="hidden lg:flex w-1/2 relative bg-black items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            src="/video-login.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-70 scale-105 animate-pulse-slow grayscale"
            style={{ animationDuration: "20s" }}
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-16 text-white">
          <div className="animate-in fade-in slide-in-from-top-8 duration-700 flex justify-end">
            <div className="flex items-center gap-3 opacity-80">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-8 w-8 brightness-0 invert hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-xl font-medium tracking-tight">
                Pilar
                <sup className="text-[9px] font-normal text-white/50 ml-0.5 relative -top-2">®</sup>
              </span>
            </div>
          </div>

          <div className="space-y-8 max-w-lg ml-auto text-right animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            <div className="flex justify-end">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                Impulsionado por Trinity Company
              </span>
            </div>

            <blockquote className="text-3xl font-light leading-snug">
              "A gestão eficiente é o alicerce onde grandes empresas constroem seu futuro."
            </blockquote>

            <div className="flex flex-col items-end gap-3 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Controle Financeiro Integrado</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Gestão de Projetos e Obras</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>CRM e Relacionamento</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
            </div>
          </div>

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            © {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>

      <MfaHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
