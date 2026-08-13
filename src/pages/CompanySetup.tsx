import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, Hash, Loader2 } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { companySetupSchema, companySetupDefaultValues, type CompanySetupFormData } from "@/schemas";

export default function CompanySetup() {
  usePageTitle("Configuração da Empresa");
  const [isLoading, setIsLoading] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const form = useForm<CompanySetupFormData>({
    resolver: zodResolver(companySetupSchema),
    mode: "onChange",
    defaultValues: companySetupDefaultValues,
  });

  // Prefill com o que a empresa já tem (o nome sempre é gravado na criação:
  // form do ultra-admin ou company_name do checkout). Sem isso, o dono
  // redigitava o nome do zero e podia sobrescrever com um valor divergente.
  const { reset } = form;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const empresa = profile?.empresas;
    if (!empresa || hydrated) return;
    reset({ name: empresa.nome ?? "", cnpj: empresa.cnpj ?? "" });
    setHydrated(true);
  }, [profile?.empresas, hydrated, reset]);

  const targetProgress = useMemo(() => {
    const step = 2;
    const total = 2;
    return Math.round((step / total) * 100);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setProgressValue(targetProgress), 150);
    return () => window.clearTimeout(t);
  }, [targetProgress]);

  const handleUpdate = async (values: CompanySetupFormData) => {
    setIsLoading(true);

    try {
      // 1. Pegar ID da empresa do usuário logado
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", user.id).single();

      if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

      // 2. Atualizar dados da empresa e marcar onboarding completo
      const { error } = await supabase
        .from("empresas")
        .update({ nome: values.name, cnpj: values.cnpj, onboarding_completed: true })
        .eq("id", profile.empresa_id);

      if (error) throw error;

      // Atualiza o contexto antes de navegar para evitar loop no PrivateRoute
      await refreshProfile();

      toast.success("Empresa configurada!", {
        description: "Bem-vindo ao sistema Pilar.",
      });

      navigate("/inicio");
    } catch (err: unknown) {
      toast.error("Erro ao salvar", {
        description: getSafeErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-grain min-h-screen w-full flex overflow-hidden bg-paper">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        {/* Aurora sutil */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-[100px] animate-aurora" />
        </div>
        <Link
          to="/profile-setup"
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </Link>

        <div className="w-full max-w-[460px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/pilar-logo.svg"
                  alt="Pilar"
                  className="h-10 w-auto hover:rotate-12 transition-transform duration-300"
                />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-ink">
                    Pilar<sup className="text-[8px] font-normal text-ink-disabled ml-0.5 relative -top-1.5">®</sup>
                  </div>
                  <div className="text-xs text-ink-soft">Configuração inicial · Etapa 2 de 2</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-brand/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-brand shadow-sm shadow-brand/30" />
              </div>
            </div>

            <Progress
              value={progressValue}
              className="h-2 bg-paper-border"
              indicatorClassName="bg-gradient-brand transition-all duration-700 ease-out"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Sua empresa</h1>
            <p className="text-sm text-ink-soft">Confirme o nome da organização e o CNPJ para emissão e cadastro.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-ink-soft font-medium">
                      Razão social / Nome fantasia <span className="text-danger-mid">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Building2 className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                        <Input
                          {...field}
                          placeholder="Ex: Construtora Pilar Ltda"
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
                name="cnpj"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-ink-soft font-medium">CNPJ</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Hash className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                        <Input
                          {...field}
                          placeholder="00.000.000/0000-00"
                          className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                          maxLength={18}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            const formatted = value
                              .replace(/^(\d{2})(\d)/, "$1.$2")
                              .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
                              .replace(/\.(\d{3})(\d)/, ".$1/$2")
                              .replace(/(\d{4})(\d)/, "$1-$2")
                              .slice(0, 18);
                            field.onChange(formatted);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs text-ink-soft">
                      Você pode preencher depois, se preferir.
                    </FormDescription>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    Finalizar e entrar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="text-xs text-ink/40">Pronto: ao finalizar, você será direcionado para o dashboard.</div>
        </div>
      </div>

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

          <div className="space-y-6 max-w-lg ml-auto text-right animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            <div className="flex justify-end">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                Último passo
              </span>
            </div>

            <blockquote className="text-3xl font-light leading-snug">
              "Uma empresa bem configurada vira processo. Processo vira escala."
            </blockquote>

            <p className="text-sm text-white/70">Você está a um clique do dashboard. Vamos começar.</p>
          </div>

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            © {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}
