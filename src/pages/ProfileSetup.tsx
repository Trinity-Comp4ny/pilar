import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Lock, Phone, User } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";
import { getSafeErrorMessage } from "@/lib/safeError";
import {
  profileSetupSchema,
  profileSetupOAuthSchema,
  profileSetupDefaultValues,
  type ProfileSetupFormData,
} from "@/schemas";

export default function ProfileSetup() {
  usePageTitle("Configuração do Perfil");
  const [isLoading, setIsLoading] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Conta OAuth (Google) chega sem senha própria: escondemos o campo de senha e
  // pulamos o updateUser({ password }). Ref para o resolver ler o valor atual sem
  // recriar o form; state para re-renderizar a UI.
  const [isOAuth, setIsOAuth] = useState(false);
  const isOAuthRef = useRef(false);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const resolver = useMemo<Resolver<ProfileSetupFormData>>(() => {
    return (values, context, options) => {
      const schema = isOAuthRef.current ? profileSetupOAuthSchema : profileSetupSchema;
      return zodResolver(schema)(values, context, options);
    };
  }, []);

  const form = useForm<ProfileSetupFormData>({
    resolver,
    mode: "onChange",
    defaultValues: profileSetupDefaultValues,
  });

  const password = form.watch("password");

  const targetProgress = useMemo(() => {
    const step = 1;
    const total = 2;
    return Math.round((step / total) * 100);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setProgressValue(targetProgress), 150);
    return () => window.clearTimeout(t);
  }, [targetProgress]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // OAuth = provider google no app_metadata, ou identidade google sem
        // identidade 'email' (conta que nunca teve senha própria).
        const provider = user.app_metadata?.provider;
        const identities = user.identities ?? [];
        const temGoogle = identities.some((i) => i.provider === "google");
        const temEmail = identities.some((i) => i.provider === "email");
        const oauth = provider === "google" || (temGoogle && !temEmail);
        isOAuthRef.current = oauth;
        setIsOAuth(oauth);
        form.clearErrors();

        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, contato, email")
          .eq("id", user.id)
          .single();

        if (profile) {
          form.reset({
            firstName: profile.first_name ?? "",
            lastName: profile.last_name ?? "",
            phone: profile.contato ?? "",
            password: "",
            confirmPassword: "",
          });
        }
      } finally {
        // profile load complete
      }
    };
    loadProfile();
  }, [form]);

  const handleUpdate = async (values: ProfileSetupFormData) => {
    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      // 1. Definir a senha PRIMEIRO (fluxo email/senha). Marcar onboarding antes
      //    disso deixava o usuário "onboarded sem senha" se o updateUser falhasse.
      //    Conta OAuth (Google) já tem identidade verificada e não define senha aqui.
      if (!isOAuth) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: values.password,
        });
        if (pwdError) throw pwdError;
      }

      // 2. Só então gravar o perfil e concluir o onboarding.
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          contato: values.phone,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (error) throw error;

      // 3. Forçar refresh do contexto para garantir que PrivateRoute leia onboarding_completed: true
      await refreshProfile();

      toast.success("Perfil atualizado!", { description: "Você já pode acessar o sistema." });

      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("role, empresas(onboarding_completed)")
        .eq("id", user.id)
        .single();

      const isAdmin = updatedProfile?.role === "admin" || updatedProfile?.role === "ultra_admin";
      const needsCompanySetup = isAdmin && !updatedProfile?.empresas?.onboarding_completed;

      navigate(needsCompanySetup ? "/company-setup" : "/inicio");
    } catch (err: unknown) {
      toast.error("Erro ao salvar", { description: getSafeErrorMessage(err) });
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
          to="/inicio"
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
                  <div className="text-xs text-ink-soft">Configuração inicial · Etapa 1 de 2</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-brand shadow-sm shadow-brand/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              </div>
            </div>

            <Progress
              value={progressValue}
              className="h-2 bg-paper-border"
              indicatorClassName="bg-gradient-brand transition-all duration-700 ease-out"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Seu perfil</h1>
            <p className="text-sm text-ink-soft">
              {isOAuth
                ? "Confirme seus dados para continuar."
                : "Confirme seus dados e defina uma senha para continuar."}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
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
                            placeholder="Ex: Maria"
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
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-ink-soft font-medium">
                        Sobrenome <span className="text-danger-mid">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Souza"
                          className="h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-ink-soft font-medium">
                      Telefone <span className="text-danger-mid">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                        <Input
                          {...field}
                          type="tel"
                          placeholder="(00) 00000-0000"
                          className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            const formatted = value
                              .replace(/^(\d{2})/, "($1) ")
                              .replace(/(\d{5})(\d)/, "$1-$2")
                              .slice(0, 15);
                            field.onChange(formatted);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isOAuth && (
                <>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-ink-soft font-medium">
                      Nova senha <span className="text-danger-mid">*</span>
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
                    <p className="text-xs text-ink-soft">
                      Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.
                    </p>
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
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-3 text-ink/40 hover:text-brand transition-colors"
                          aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                </>
              )}

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
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="text-xs text-ink/40">
            Ao continuar, você confirma que as informações acima estão corretas.
          </div>
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
                Perfil e empresa em minutos
              </span>
            </div>

            <blockquote className="text-3xl font-light leading-snug">
              "Antes do primeiro dashboard, uma base bem feita."
            </blockquote>

            <p className="text-sm text-white/70">
              Vamos deixar sua conta pronta com as informações essenciais — rápido, bonito e sem fricção.
            </p>
          </div>

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            © {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}
