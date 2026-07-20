import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, HelpCircle, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { translateAuthError } from "@/lib/authErrors";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MfaHelpModal } from "@/components/MfaHelpModal";
import { useMfa } from "@/hooks/useMfa";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { passwordResetSchema, passwordResetDefaultValues, type PasswordResetFormData } from "@/schemas";

type Step = "loading" | "mfa" | "password" | "expired";

export default function PasswordReset() {
  usePageTitle("Redefinir senha");
  const navigate = useNavigate();
  const { resetAllFactors } = useMfa();

  const [step, setStep] = useState<Step>("loading");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [backupMode, setBackupMode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [backupSubmitting, setBackupSubmitting] = useState(false);

  const form = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema),
    mode: "onChange",
    defaultValues: passwordResetDefaultValues,
  });

  const password = form.watch("password");

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
      // 8s (era 3s): hidratação lenta da sessão com link válido marcava
      // "expirado" cedo demais. O onAuthStateChange acima ainda recupera se o
      // evento chegar antes. ACH-AUTH-06.
      timeoutId = window.setTimeout(() => {
        checkSession().then((readyNow) => {
          if (!readyNow) setStep("expired");
        });
      }, 8000);
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
      // Consome o backup, desregistra todos os fatores e envia para reconfigurar o MFA.
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

  const requirements = [
    { label: "12+ caracteres", ok: (password?.length ?? 0) >= 12 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(password ?? "") },
    { label: "Número", ok: /\d/.test(password ?? "") },
    { label: "Caractere especial", ok: /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~';]/.test(password ?? "") },
  ];

  const handleUpdatePassword = async (values: PasswordResetFormData) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-[100px] animate-aurora" />
        </div>

        <Link
          to="/login"
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
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
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
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
                className="w-full h-11 bg-brand hover:bg-brand/90 text-ink font-medium"
                onClick={() => navigate("/forgot-password")}
              >
                Solicitar novo link
              </Button>
            </div>
          )}

          {step === "mfa" && backupMode && (
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-2xl bg-amber-100 border border-amber-200">
                    <KeyRound className="h-8 w-8 text-amber-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Código de recuperação</h1>
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
                    onClick={() => {
                      setBackupMode(false);
                      setBackupCode("");
                    }}
                    className="text-xs text-ink-soft hover:text-ink transition-colors underline"
                  >
                    Voltar para autenticador
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "mfa" && !backupMode && (
            <div className="space-y-8">
              <MfaHelpModal open={helpOpen} onOpenChange={setHelpOpen} />

              <div className="text-center space-y-2">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-2xl bg-brand/10 border border-brand/20">
                    <ShieldCheck className="h-8 w-8 text-brand" />
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
                className="w-full h-11 bg-brand hover:bg-brand/90 text-ink font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98]"
                disabled={submitting || mfaCode.length !== 6}
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
          )}

          {step === "password" && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdatePassword)} className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-ink">Nova senha</h1>
                  <p className="text-sm text-ink-soft">Defina uma senha forte para sua conta.</p>
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-ink-soft font-medium">
                        Nova senha <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            placeholder="••••••••••••"
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
                      </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-ink-soft font-medium">
                        Confirmar senha <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                          <Input
                            {...field}
                            type={showConfirm ? "text" : "password"}
                            className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            placeholder="••••••••••••"
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 bg-brand hover:bg-brand/90 text-ink font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98]"
                  disabled={submitting || !form.formState.isValid}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar nova senha
                </Button>
              </form>
            </Form>
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
    </div>
  );
}
