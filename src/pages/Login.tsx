import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Login() {
  usePageTitle("Login");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // guard_login_attempt não está nos tipos gerados ainda — usar cast seguro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: loginAllowed } = await (supabase.rpc as any)("guard_login_attempt", { p_email: email });
    if (loginAllowed === false) {
      toast.error("Muitas tentativas", {
        description: "Aguarde 15 minutos antes de tentar novamente.",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Erro ao fazer login", {
        description: "Verifique suas credenciais e tente novamente.",
      });
      setIsLoading(false);
      return;
    }

    // Se MFA (aal2) é requerido, vai pro challenge sem toast de sucesso.
    // Toast só aparece quando login está de fato concluído (MfaChallenge dispara
    // "MFA verificado" após passar). PrivateRoute cuida dos redirects de onboarding.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaRequired = aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1";

    if (mfaRequired) {
      navigate("/mfa");
      setIsLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso!", {
      description: "Bem-vindo de volta.",
    });
    sessionStorage.setItem("pilar_post_login", "1");
    navigate("/dashboard");
    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast.error("Informe o email", {
        description: "Digite seu email no campo acima para receber o link de redefinição.",
      });
      return;
    }
    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("Erro ao enviar", {
        description: "Tente novamente em alguns instantes.",
      });
    } else {
      toast.success("Email enviado!", {
        description: "Verifique sua caixa de entrada para redefinir a senha.",
      });
    }
    setIsResetting(false);
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden bg-white">
      {/* Lado Esquerdo - Formulário de Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-white relative">
        <Link
          to="/"
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-slate-500 hover:text-brand transition-colors font-medium text-sm group"
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
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Bem-vindo</h1>
            <p className="text-sm text-slate-500">Acesse sua conta</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@empresa.com"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:border-brand focus:ring-brand/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  Senha
                </Label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isResetting}
                  className="text-xs font-medium text-brand hover:text-brand/70 hover:underline disabled:opacity-50"
                >
                  {isResetting ? "Enviando..." : "Esqueceu a senha?"}
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 focus:border-brand focus:ring-brand/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-brand transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              className="w-full h-11 bg-brand hover:bg-brand/80 text-ink font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98] text-sm"
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">Ainda não tem conta?</span>
            </div>
          </div>

          <div className="text-center pt-2">
            <Button
              variant="outline"
              className="w-full h-10 border-slate-200 text-slate-600 hover:text-brand hover:border-brand/50 hover:bg-brand/10 transition-all text-sm font-medium"
              asChild
            >
              <a href="https://trnty.com.br" target="_blank" rel="noopener noreferrer">
                Fale com nossa equipe comercial
              </a>
            </Button>
          </div>
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
          {/* Overlay gradiente + tintura laranja */}
          <div className="absolute inset-0 bg-brand/40 mix-blend-multiply" />
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
