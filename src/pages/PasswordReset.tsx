import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { passwordSchema } from "@/lib/passwordPolicy";
import { translateAuthError } from "@/lib/authErrors";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "loading" | "mfa" | "password" | "expired";

export default function PasswordReset() {
  usePageTitle("Redefinir senha");
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("loading");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return false;

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verified = factorsData?.totp?.find((f) => f.status === "verified");

      if (verified) {
        setMfaFactorId(verified.id);
        setStep("mfa");
      } else {
        setStep("password");
      }
      return true;
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        checkSession();
      }
    });

    checkSession().then((ready) => {
      if (ready) return;
      timeoutId = window.setTimeout(() => {
        checkSession().then((readyNow) => {
          if (!readyNow) setStep("expired");
        });
      }, 3000);
    });

    return () => {
      subscription.subscription.unsubscribe();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const handleVerifyMfa = async (code: string) => {
    if (!mfaFactorId || !/^\d{6}$/.test(code)) return;
    setSubmitting(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (chErr || !challenge) throw chErr ?? new Error("Falha no challenge");
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) throw vErr;
      setStep("password");
      setMfaCode("");
    } catch (err) {
      toast.error("Código inválido", { description: translateAuthError(err) });
      setMfaCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaChange = (value: string) => {
    setMfaCode(value);
    if (value.length === 6) handleVerifyMfa(value);
  };

  const requirements = [
    { label: "8+ caracteres", ok: password.length > 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(password) },
    { label: "Número", ok: /\d/.test(password) },
    { label: "Caractere especial", ok: /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~';]/.test(password) },
  ];
  const allRequirementsMet = requirements.every((r) => r.ok);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = allRequirementsMet && passwordsMatch;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Senhas não conferem");
      return;
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error("Senha fraca", { description: parsed.error.issues[0]?.message });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Senha alterada!", { description: "Faça login com a nova senha." });
      navigate("/login");
    } catch (err) {
      toast.error("Erro ao alterar senha", { description: translateAuthError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="landing-grain min-h-screen w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-accent-orange/6 rounded-full blur-[100px] animate-aurora" />
        </div>

        <Link
          to="/login"
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-accent-orange transition-colors font-medium text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar para o login
        </Link>

        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="flex justify-center items-center gap-2">
            <img
              src="/pilar-logo.svg"
              alt="Pilar"
              className="h-10 w-auto hover:rotate-12 transition-transform duration-300"
            />
            <span className="text-2xl font-medium tracking-tight text-ink">
              Pilar<sup className="text-[10px] font-normal text-slate-400 ml-0.5 relative -top-2.5">®</sup>
            </span>
          </div>

          {step === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-accent-orange" />
              <p className="text-sm text-ink-soft">Validando link de recuperação...</p>
            </div>
          )}

          {step === "expired" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="text-xl font-semibold text-ink">Link expirado</p>
              <p className="text-sm text-ink-soft">
                O link de recuperação é válido por tempo limitado. Solicite um novo.
              </p>
              <Button
                className="w-full h-11 bg-accent-orange hover:bg-accent-orange/90 text-ink font-medium"
                onClick={() => navigate("/forgot-password")}
              >
                Solicitar novo link
              </Button>
            </div>
          )}

          {step === "mfa" && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-2xl bg-accent-orange/10 border border-accent-orange/20">
                    <ShieldCheck className="h-8 w-8 text-accent-orange" />
                  </div>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Verificação em dois fatores</h1>
                <p className="text-sm text-ink-soft leading-relaxed">
                  Digite o código do seu app autenticador
                  <br />
                  <span className="text-ink/40 text-xs">(Google Authenticator, Authy, 1Password)</span>
                </p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={mfaCode} onChange={handleMfaChange} autoFocus disabled={submitting}>
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
                onClick={() => handleVerifyMfa(mfaCode)}
                className="w-full h-11 bg-accent-orange hover:bg-accent-orange/90 text-ink font-medium shadow-lg shadow-accent-orange/20 hover:shadow-accent-orange/30 transition-all active:scale-[0.98]"
                disabled={submitting || mfaCode.length !== 6}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar
              </Button>
            </div>
          )}

          {step === "password" && (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Nova senha</h1>
                <p className="text-sm text-ink-soft">Defina uma senha forte para sua conta.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-ink-soft font-medium">
                  Nova senha
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-accent-orange transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-3 text-ink/40 hover:text-ink-soft transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-2 pt-1">
                  {requirements.map(({ label, ok }) => (
                    <li key={label} className="flex items-center gap-2">
                      <Check
                        className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-200 ${ok ? "text-chart-success" : "text-ink/20"}`}
                        strokeWidth={2.5}
                      />
                      <span
                        className={`text-xs transition-colors duration-200 ${ok ? "text-chart-success font-medium" : "text-ink-soft"}`}
                      >
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-ink-soft font-medium">
                  Confirmar senha
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-accent-orange transition-colors" />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-3 text-ink/40 hover:text-ink-soft transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-accent-orange hover:bg-accent-orange/90 text-ink font-medium shadow-lg shadow-accent-orange/20 hover:shadow-accent-orange/30 transition-all active:scale-[0.98]"
                disabled={submitting || !canSubmit}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar nova senha
              </Button>
            </form>
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
                Pilar<sup className="text-[9px] font-normal text-white/50 ml-0.5 relative -top-2">®</sup>
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
                <CheckCircle2 className="w-5 h-5 text-accent-orange" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Gestão de Projetos e Obras</span>
                <CheckCircle2 className="w-5 h-5 text-accent-orange" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>CRM e Relacionamento</span>
                <CheckCircle2 className="w-5 h-5 text-accent-orange" />
              </div>
            </div>
          </div>

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            © {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}
