import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Loader2 } from "lucide-react";
import { getPortalToken, setPortalToken } from "./useClienteAuth";
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
    <div className="min-h-screen w-full flex overflow-hidden bg-white">
      {/* Lado Esquerdo — Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-white">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-6">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-12 w-auto" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Portal do Cliente</h1>
            <p className="text-sm text-slate-500">Acompanhe seus projetos em tempo real</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Email
              </Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 group-focus-within:text-accent-orange transition-colors" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Senha
              </Label>
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

          <div className="text-center">
            <p className="text-xs text-slate-400">Acesso exclusivo para clientes convidados pelo escritório.</p>
          </div>
        </div>
      </div>

      {/* Lado Direito — Visual Branding */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/20 via-slate-900 to-slate-900" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-orange/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent-orange/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-16 text-white">
          <div className="flex justify-end animate-in fade-in slide-in-from-top-8 duration-700">
            <div className="flex items-center gap-3 opacity-80">
              <img src="/pilar-logo.svg" alt="Pilar" className="h-8 w-8 brightness-0 invert" />
              <span className="text-xl font-medium tracking-tight">Pilar</span>
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
