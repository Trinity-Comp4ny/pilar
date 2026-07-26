import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { getPortalToken, setPortalToken } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { clienteLoginSchema, clienteLoginDefaultValues, type ClienteLoginFormData } from "@/schemas";

// Sem contexto de empresa antes do login, a recuperação de acesso cai no suporte
// do Pilar, que encaminha ao escritório responsável pela conta.
const SUPORTE_EMAIL = "suporte@pilarsoft.com.br";

export default function ClienteLogin() {
  usePageTitle("Portal | Login");
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Sessão expirou e o ClientePrivateRoute redirecionou pra cá: explica o motivo
    // em vez de deixar o cliente sem saber por que caiu no login.
    const reason = (location.state as { reason?: string } | null)?.reason;
    if (reason === "expired") {
      toast.info("Sua sessão expirou", { description: "Entre novamente para continuar." });
      // Limpa o state pra não repetir a mensagem ao recarregar ou voltar.
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const form = useForm<ClienteLoginFormData>({
    resolver: zodResolver(clienteLoginSchema),
    mode: "onChange",
    defaultValues: clienteLoginDefaultValues,
  });

  useEffect(() => {
    // Se já tem token válido, redireciona. Usa o verificador read-only: o
    // portal_verify_session rotaciona o token e devolve new_token; como esta
    // checagem descartava o new_token, o token guardado ficava obsoleto e o
    // dashboard revalidava com token velho, deslogando o cliente.
    const token = getPortalToken();
    if (token) {
      // (supabase as any): RPC nova ainda não está no types.ts gerado (rodar
      // gen:types pós-merge). Mesmo padrão de useFinanceChartData.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .rpc("portal_verify_session_readonly", { p_token: token })
        .then(({ data }: { data: unknown }) => {
          if (data) navigate("/cliente/dashboard");
        });
    }
  }, [navigate]);

  const handleLogin = async (values: ClienteLoginFormData) => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc("portal_login", {
        p_email: values.email,
        p_senha: values.password,
      });

      if (error) throw error;
      if (!data) throw new Error("credencial");

      // RPC portal_login retorna Json no schema; estrutura { token, nome } é contrato do backend.
      const result = data as { token: string; nome: string };
      setPortalToken(result.token);

      toast.success("Login realizado!", { description: `Bem-vindo, ${result.nome}.` });

      navigate("/cliente/dashboard");
    } catch (err) {
      const isNetwork =
        err instanceof TypeError ||
        (err instanceof Error && /fetch|network|failed to fetch|timeout/i.test(err.message));
      if (isNetwork) {
        toast.error("Falha na conexão", {
          description: "Verifique sua internet e tente novamente.",
        });
      } else {
        toast.error("Erro ao fazer login", { description: "Email ou senha inválidos." });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-grain min-h-screen w-full flex overflow-hidden bg-paper">
      {/* Lado Esquerdo — Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-[100px] animate-aurora" />
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-ink-soft font-medium">
                      Email <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="seu@email.com"
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
                      Senha <span className="text-red-500">*</span>
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
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          aria-pressed={showPassword}
                          className="absolute right-3 top-3 text-ink/40 hover:text-ink-soft transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

          <div className="text-center space-y-1.5">
            <p className="text-xs text-ink-soft">
              Esqueceu a senha?{" "}
              <a
                href={`mailto:${SUPORTE_EMAIL}?subject=${encodeURIComponent(
                  "Recuperar acesso ao portal do cliente"
                )}&body=${encodeURIComponent("Olá, preciso recuperar o acesso ao portal. Meu e-mail de cadastro é: ")}`}
                className="font-medium text-ink hover:underline"
              >
                Recuperar acesso
              </a>
            </p>
            <p className="text-xs text-ink/60">Acesso exclusivo para clientes convidados pelo escritório.</p>
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
              Acompanhe o progresso, visualize etapas e gerencie entregas em um só lugar.
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
