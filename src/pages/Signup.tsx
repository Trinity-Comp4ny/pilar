import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff, User, Building2, Phone } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { GoogleButton } from "@/components/GoogleButton";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { env } from "@/lib/env";
import { signupSchema, signupDefaultValues, type SignupFormData } from "@/schemas";
import { translateAuthError } from "@/lib/authErrors";

export default function Signup() {
  usePageTitle("Criar conta");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  // Anti-abuso do cadastro aberto (spam de tenants): captcha só é exigido quando há
  // site key configurada. Sem ela (ex.: ambiente sem Turnstile), o cadastro segue.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRequerido = Boolean(env.VITE_TURNSTILE_SITE_KEY);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: signupDefaultValues,
  });

  const password = form.watch("password");

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) navigate("/inicio");
    };
    checkUser();
  }, [navigate]);

  const handleSignup = async (values: SignupFormData) => {
    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          nome: values.nome.trim(),
          telefone: values.telefone.trim(),
          company_name: values.companyName.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });

    if (error) {
      toast.error("Erro ao criar conta", { description: translateAuthError(error) });
      setIsLoading(false);
      return;
    }

    setEmailEnviado(true);
    setIsLoading(false);
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error("Erro ao continuar com Google", { description: translateAuthError(error) });
      setIsGoogleLoading(false);
    }
    // Em sucesso o browser redireciona para o Google; não há o que fazer aqui.
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo - Formulário de Cadastro */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative">
        <Link
          to="/"
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </Link>

        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-6">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-12 w-auto hover:rotate-12 transition-transform duration-300"
              />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Criar conta</h1>
            <p className="text-sm text-ink-soft">14 dias grátis, sem cartão</p>
          </div>

          {emailEnviado ? (
            <div className="space-y-6 text-center animate-in fade-in duration-500">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15">
                  <Mail className="h-7 w-7 text-brand" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-ink">Confira seu email</h2>
                <p className="text-sm text-ink-soft">
                  Enviamos um link de confirmação para{" "}
                  <span className="font-medium text-ink">{form.getValues("email")}</span>. Clique nele para ativar sua
                  conta e continuar.
                </p>
              </div>
              <p className="text-xs text-ink/40">Não recebeu? Verifique o spam ou tente criar a conta novamente.</p>
              <Button
                variant="outline"
                className="w-full h-10 border-paper-border text-ink-soft hover:text-brand hover:border-brand/50 hover:bg-brand/10 transition-all text-sm font-medium"
                asChild
              >
                <Link to="/login">Ir para o login</Link>
              </Button>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSignup)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">
                          Nome <span className="text-danger-mid">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <User className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                            <Input
                              {...field}
                              autoFocus
                              placeholder="Seu nome"
                              className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">
                          Email <span className="text-danger-mid">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="seu@empresa.com"
                              className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">
                          Celular <span className="text-danger-mid">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                            <Input
                              {...field}
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder="(11) 90000-0000"
                              className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">
                          Senha <span className="text-danger-mid">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3 top-3 text-ink/40 hover:text-brand transition-colors"
                              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        {password && <PasswordStrengthIndicator password={password} />}
                        <PasswordRequirements password={password ?? ""} />
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
                          Confirmar senha <span className="text-danger-mid">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              className="absolute right-3 top-3 text-ink/40 hover:text-brand transition-colors"
                              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">
                          Nome da empresa <span className="text-danger-mid">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Building2 className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                            <Input
                              {...field}
                              placeholder="Sua empresa"
                              className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {captchaRequerido && (
                    <TurnstileWidget onToken={setCaptchaToken} onError={() => setCaptchaToken(null)} />
                  )}

                  <Button
                    variant="brand"
                    className="w-full h-11 font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98] text-sm"
                    type="submit"
                    disabled={!form.formState.isValid || isLoading || (captchaRequerido && !captchaToken)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando conta...
                      </>
                    ) : (
                      "Criar conta"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-paper-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-paper px-2 text-ink/40">ou</span>
                </div>
              </div>

              <GoogleButton onClick={handleGoogle} loading={isGoogleLoading} disabled={isLoading} />

              <p className="text-center text-sm text-ink-soft">
                Já tem conta?{" "}
                <Link to="/login" className="font-medium text-ink decoration-brand underline-offset-2 hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Lado Direito - Visual e Branding (Escondido no Mobile) */}
      <div className="hidden lg:flex w-1/2 relative bg-black items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            src="/video-login.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-60 scale-105 animate-pulse-slow grayscale contrast-125"
            style={{ animationDuration: "20s" }}
          />
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
              <span className="text-xl font-medium tracking-tight">Pilar</span>
            </div>
          </div>

          <div className="space-y-8 max-w-lg ml-auto text-right animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            <div className="flex justify-end">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                14 dias grátis
              </span>
            </div>

            <blockquote className="text-3xl font-light leading-snug">
              "Saiba se cada projeto está dando lucro antes de terminar."
            </blockquote>

            <div className="flex flex-col items-end gap-3 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Controle financeiro por projeto</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Gestão de projetos e obras</span>
                <CheckCircle2 className="w-5 h-5 text-brand" />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                <span>Sem cartão para começar</span>
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
