import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, ArrowRight, Loader2, Lock, Phone, User } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { passwordSchema } from "@/lib/passwordPolicy";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

export default function ProfileSetup() {
  usePageTitle("Configuração do Perfil");
  const [isLoading, setIsLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, contato, email")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.first_name) setFirstName(profile.first_name);
          if (profile.last_name) setLastName(profile.last_name);
          if (profile.contato) setPhone(profile.contato);
        }
      } finally {
        // profile load complete
      }
    };
    loadProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password && password !== confirmPassword) {
      toast.error("Senhas não conferem", { description: "Por favor, digite a mesma senha nos dois campos." });
      return;
    }

    if (password) {
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
        toast.error("Senha fraca", { description: parsed.error.issues[0]?.message });
        return;
      }
    }

    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      // 1. Atualizar perfil PRIMEIRO — assim o onAuthStateChange que dispara
      //    depois (pelo updateUser de senha) já lê onboarding_completed: true do banco.
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          contato: phone,
          onboarding_completed: true,
        })
        .eq("id", user.id);

      if (error) throw error;

      // 2. Atualizar senha após o perfil — o onAuthStateChange lerá o perfil já atualizado
      if (password) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: password,
        });
        if (pwdError) throw pwdError;
      }

      // 3. Forçar refresh do contexto para garantir que PrivateRoute leia onboarding_completed: true
      await refreshProfile();

      toast.success("Perfil atualizado!", { description: "Você já pode acessar o sistema." });

      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("role, empresas(onboarding_completed)")
        .eq("id", user.id)
        .single();

      const isAdmin = updatedProfile?.role === "admin";
      const needsCompanySetup = isAdmin && !updatedProfile?.empresas?.onboarding_completed;

      navigate(needsCompanySetup ? "/company-setup" : "/dashboard");
    } catch (err: unknown) {
      toast.error("Erro ao salvar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-grain min-h-screen w-full flex overflow-hidden bg-paper">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-paper relative overflow-hidden">
        {/* Aurora sutil */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-accent-orange/6 rounded-full blur-[100px] animate-aurora" />
        </div>
        <Link
          to="/dashboard"
          className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-accent-orange transition-colors font-medium text-sm group"
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
                    Pilar<sup className="text-[8px] font-normal text-slate-400 ml-0.5 relative -top-1.5">®</sup>
                  </div>
                  <div className="text-xs text-ink-soft">Configuração inicial · Etapa 1 de 2</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-accent-orange shadow-sm shadow-accent-orange/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              </div>
            </div>

            <Progress
              value={progressValue}
              className="h-2 bg-paper-border"
              indicatorClassName="bg-gradient-to-r from-accent-orange via-orange-500 to-yellow-400 transition-all duration-700 ease-out"
            />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Seu perfil</h1>
            <p className="text-sm text-ink-soft">Confirme seus dados e defina uma senha para continuar.</p>
          </div>

          <form onSubmit={handleUpdate} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-ink-soft font-medium">
                  Nome
                </Label>
                <div className="relative group">
                  <User className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-accent-orange transition-colors" />
                  <Input
                    id="firstName"
                    placeholder="Ex: Maria"
                    className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-ink-soft font-medium">
                  Sobrenome
                </Label>
                <Input
                  id="lastName"
                  placeholder="Ex: Souza"
                  className="h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-ink-soft font-medium">
                Telefone
              </Label>
              <div className="relative group">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-accent-orange transition-colors" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    const formatted = value
                      .replace(/^(\d{2})/, "($1) ")
                      .replace(/(\d{5})(\d)/, "$1-$2")
                      .slice(0, 15);
                    setPhone(formatted);
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-ink-soft font-medium">
                Nova senha
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
                  minLength={12}
                />
              </div>
              {password && <PasswordStrengthIndicator password={password} />}
              <p className="text-xs text-ink-soft">Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-ink-soft font-medium">
                Confirmar senha
              </Label>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-accent-orange transition-colors" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-accent-orange focus:ring-accent-orange/20 transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
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
