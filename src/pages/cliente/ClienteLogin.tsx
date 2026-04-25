import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Loader2 } from "lucide-react";
import { getPortalToken, setPortalToken } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function ClienteLogin() {
  usePageTitle("Portal | Login");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Se já tem token válido, redireciona
    const token = getPortalToken();
    if (token) {
      supabase.rpc("portal_verify_session", { p_token: token }).then(({ data }) => {
        if (data) navigate("/cliente/dashboard");
      });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc("portal_login", {
        p_email: email,
        p_senha: password,
      });

      if (error) throw error;
      if (!data) throw new Error("Resposta inválida");

      const result = data as unknown as { token: string; nome: string };
      setPortalToken(result.token);

      toast.success("Login realizado!", { description: `Bem-vindo, ${result.nome}.` });

      navigate("/cliente/dashboard");
    } catch {
      toast.error("Erro ao fazer login", { description: "Email ou senha inválidos." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-grain min-h-screen w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo — Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-accent-orange/6 rounded-full blur-[100px] animate-aurora" />
        </div>
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="text-center space-y-2">
            <div className="flex justify-center items-center gap-2 mb-6">
              <img
                src="/pilar-logo.svg"
                alt="Pilar"
                className="h-10 w-auto hover:rotate-12 transition-transform duration-300"
              />
              <span className="text-2xl font-medium tracking-tight text-ink">
                Pilar<sup className="text-[10px] font-normal text-slate-400 ml-0.5 relative -top-2.5">®</sup>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Portal do Cliente</h1>
            <p className="text-sm text-ink-soft">Acompanhe seus projetos em tempo real</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-ink-soft font-medium">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-accent-orange transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-ink-soft font-medium">
                Senha
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-accent-orange transition-colors" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button
              className="w-full h-11 bg-accent-orange hover:bg-accent-orange/90 text-ink font-medium shadow-lg shadow-accent-orange/20 hover:shadow-accent-orange/30 transition-all active:scale-[0.98] text-sm"
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

          <div className="text-center">
            <p className="text-xs text-ink/40">Acesso exclusivo para clientes convidados pelo escritório.</p>
          </div>
        </div>
      </div>

      {/* Lado Direito — Visual Branding */}
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
          <div className="flex justify-end animate-in fade-in slide-in-from-top-8 duration-700">
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

          <div className="space-y-6 max-w-lg ml-auto text-right animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            <blockquote className="text-3xl font-light leading-snug">
              "Transparência e acompanhamento em cada etapa do seu projeto."
            </blockquote>
            <p className="text-sm text-white/60">
              Acompanhe o progresso, visualize etapas e gerencie entregas — tudo em um só lugar.
            </p>
          </div>

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            &copy; {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}
