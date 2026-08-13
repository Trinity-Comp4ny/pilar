import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { GoogleButton } from "@/components/GoogleButton";
import { loginSchema, loginDefaultValues, type LoginFormData } from "@/schemas";
import { STORAGE_KEYS } from "@/constants";
import { translateAuthError } from "@/lib/authErrors";
import { marcarLogin, ultimoMetodo } from "@/lib/ultimoLogin";

export default function Login() {
  usePageTitle("Login");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const ultimo = ultimoMetodo();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: loginDefaultValues,
  });

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/inicio");
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (values: LoginFormData) => {
    setIsLoading(true);

    const { data: loginAllowed, error: guardError } = await supabase.rpc("guard_login_attempt", {
      p_email: values.email,
    });
    // Fail-open: só bloqueia quando o guard NEGA explicitamente. Se a RPC de
    // rate-limit falha (erro de infra), não travar o login legítimo de todos.
    if (!guardError && loginAllowed === false) {
      toast.error("Muitas tentativas", {
        description: "Aguarde 15 minutos antes de tentar novamente.",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      toast.error("Erro ao fazer login", {
        description: translateAuthError(error),
      });
      setIsLoading(false);
      return;
    }

    // Se MFA (aal2) é requerido, vai pro challenge sem toast de sucesso.
    // Toast só aparece quando login está de fato concluído (MfaChallenge dispara
    // "MFA verificado" após passar). PrivateRoute cuida dos redirects de onboarding.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaRequired = aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1";

    if (rememberMe) {
      localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, "1");
    } else {
      localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    }

    if (mfaRequired) {
      navigate("/mfa");
      setIsLoading(false);
      return;
    }

    marcarLogin("senha");
    toast.success("Login realizado com sucesso!", {
      description: "Bem-vindo de volta.",
    });
    sessionStorage.setItem("pilar_post_login", "1");
    navigate("/inicio");
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
    // Em sucesso o browser redireciona para o Google; marcarLogin roda no callback.
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo - Formulário de Login */}
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
              {/* <img src="/pilar-logo.svg" className="h-12 w-auto" alt="Pilar Logo" /> */}
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-12 w-auto hover:rotate-12 transition-transform duration-300"
              />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Bem-vindo</h1>
            <p className="text-sm text-ink-soft">Acesse sua conta</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-5">
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
                          autoFocus
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
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-ink-soft font-medium">
                        Senha <span className="text-danger-mid">*</span>
                      </FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-ink-soft decoration-brand underline-offset-2 hover:underline"
                      >
                        Esqueceu a senha?
                      </Link>
                    </div>
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-me"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(!!v)}
                    className="data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-ink"
                  />
                  <label htmlFor="remember-me" className="text-sm text-ink-soft cursor-pointer select-none leading-none">
                    Lembre-me
                  </label>
                </div>
                {ultimo === "senha" && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-ink">
                    usado por último
                  </span>
                )}
              </div>

              <Button
                variant="brand"
                className="w-full h-11 font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98] text-sm"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
                  </>
                ) : (
                  "Entrar"
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

          <GoogleButton
            onClick={handleGoogle}
            loading={isGoogleLoading}
            disabled={isLoading}
            destaque={ultimo === "google"}
          />

          <p className="text-center text-sm text-ink-soft">
            Ainda não tem conta?{" "}
            <Link
              to="/cadastro"
              className="font-medium text-ink decoration-brand underline-offset-2 hover:underline"
            >
              Criar conta
            </Link>
          </p>
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
