import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Erro ao fazer login",
        description: "Verifique suas credenciais e tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: "Login realizado com sucesso!",
      description: "Bem-vindo de volta.",
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, role, empresas(onboarding_completed)')
        .eq('id', user.id)
        .single();

      if (profile && !profile.onboarding_completed) {
        navigate("/profile-setup");
      } else if (profile?.role === 'admin' && !profile.empresas?.onboarding_completed) {
        navigate("/company-setup");
      } else {
        navigate("/dashboard");
      }
    } else {
      navigate("/dashboard");
    }
    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      toast({
        title: "Informe o email",
        description: "Digite seu email no campo acima para receber o link de redefinição.",
        variant: "destructive",
      });
      return;
    }
    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/profile-setup`,
    });
    if (error) {
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email enviado!",
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
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-slate-500 hover:text-accent-orange transition-colors font-medium text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </Link>

        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-6">
                {/* <img src="/pilar-logo.svg" className="h-12 w-auto" alt="Pilar Logo" /> */}
                <img src="/pilar-logo.svg" alt="Pilar" className="h-12 w-auto hover:rotate-12 transition-transform duration-300" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
              Bem-vindo
            </h1>
            <p className="text-sm text-slate-500">
              Acesse sua conta
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-accent-orange transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@empresa.com"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 font-medium">Senha</Label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isResetting}
                  className="text-xs font-medium text-accent-orange hover:text-orange-700 hover:underline disabled:opacity-50"
                >
                  {isResetting ? "Enviando..." : "Esqueceu a senha?"}
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-accent-orange transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button 
              className="w-full h-11 bg-accent-orange hover:bg-orange-600 text-white font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all active:scale-[0.98] text-sm" 
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
              <span className="bg-white px-2 text-slate-400">
                Ainda não tem conta?
              </span>
            </div>
          </div>

          <div className="text-center pt-2">
             <Button variant="outline" className="w-full h-10 border-slate-200 text-slate-600 hover:text-accent-orange hover:border-accent-orange/50 hover:bg-orange-50/50 transition-all text-sm font-medium" asChild>
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
            style={{ animationDuration: '20s' }}
          />
          {/* Overlay gradiente + tintura laranja */}
          <div className="absolute inset-0 bg-accent-orange/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-16 text-white">
          <div className="animate-in fade-in slide-in-from-top-8 duration-700 flex justify-end">
            <div className="flex items-center gap-3 opacity-80">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8 brightness-0 invert hover:rotate-12 transition-transform duration-300" />
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