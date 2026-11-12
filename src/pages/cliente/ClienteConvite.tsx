import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Eye, EyeOff, Mail, Building2 } from "lucide-react";
import { setPortalToken } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { passwordResetSchema, passwordResetDefaultValues, type PasswordResetFormData } from "@/schemas";
import { Logo } from "@/components/Logo";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { PageLoader } from "@/components/motion/PageLoader";

import { BusyMark } from "@/components/motion/BusyMark";
import { AvisoPrivacidadeConvidado } from "@/components/legal/AvisoPrivacidadeConvidado";

type ConviteResp = { ok: boolean; token?: string; nome?: string; erro?: string };
type ConviteInfo = { ok: boolean; nome?: string; email?: string; empresa?: string; erro?: string };
type Estado =
  | { fase: "carregando" }
  | { fase: "invalido"; erro: string }
  | { fase: "boas-vindas"; info: ConviteInfo }
  | { fase: "senha"; info: ConviteInfo };

export default function ClienteConvite() {
  usePageTitle("Portal | Definir senha");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [estado, setEstado] = useState<Estado>({ fase: token ? "carregando" : "invalido" });

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    supabase
      .rpc("portal_convite_consultar", { p_token: token })
      .then(({ data, error }) => {
        if (!ativo) return;
        const info = data as unknown as ConviteInfo | null;
        if (error || !info?.ok || !info.email) {
          setEstado({
            fase: "invalido",
            erro: error ? "Não foi possível abrir o convite agora. Tente novamente em instantes." : (info?.erro ?? "Convite inválido ou expirado"),
          });
          return;
        }
        setEstado({ fase: "boas-vindas", info });
      })
      .catch(() => {
        if (ativo) setEstado({ fase: "invalido", erro: "Não foi possível abrir o convite agora. Tente novamente em instantes." });
      });
    return () => {
      ativo = false;
    };
  }, [token]);

  const form = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema),
    mode: "onChange",
    defaultValues: passwordResetDefaultValues,
  });

  const handleSubmit = async (values: PasswordResetFormData) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("portal_convite_definir_senha", {
        p_token: token,
        p_senha: values.password,
      });

      if (error) throw error;
      const res = data as unknown as ConviteResp;

      if (!res?.ok || !res.token) {
        toast.error("Não foi possível definir a senha", {
          description: res?.erro ?? "O convite pode ter expirado. Peça um novo ao escritório.",
        });
        return;
      }

      setPortalToken(res.token);
      toast.success("Senha definida", { description: `Bem-vindo, ${res.nome ?? "cliente"}.` });
      navigate("/cliente/dashboard");
    } catch {
      toast.error("Falha na conexão", { description: "Verifique sua internet e tente novamente." });
    } finally {
      setIsLoading(false);
    }
  };

  const senha = form.watch("password");

  if (estado.fase === "carregando") {
    return (
      <div className="landing-grain min-h-dvh w-full flex items-center justify-center bg-paper p-8">
        <PageLoader label="Abrindo seu convite" />
      </div>
    );
  }

  if (estado.fase === "invalido") {
    return (
      <div className="landing-grain min-h-dvh w-full flex items-center justify-center bg-paper p-8">
        <div className="w-full max-w-[400px] space-y-4 text-center">
          <Logo size="lg" className="text-ink mx-auto" />
          <h1 className="text-xl font-semibold text-ink">Link inválido</h1>
          <p className="text-sm text-ink-soft">
            {token
              ? "Este convite não é mais válido. Peça ao escritório para reenviar o convite."
              : "Este link de convite está incompleto. Peça ao escritório para reenviar o convite."}
          </p>
          <Button variant="outline" onClick={() => navigate("/cliente/login")}>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  const { info } = estado;
  const empresa = info.empresa?.trim() || "Um escritório";

  if (estado.fase === "boas-vindas") {
    return (
      <div className="landing-grain min-h-dvh w-full flex items-center justify-center bg-paper p-8">
        <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-6">
              <Logo size="lg" className="text-ink" />
            </div>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-ink">
              <Building2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Portal do cliente Pilar</h1>
            <p className="text-sm text-ink-soft">
              <strong className="font-semibold text-ink">{empresa}</strong> deu acesso a você ao portal do cliente na
              Pilar. Acompanhe seus projetos, entregas e documentos em um só lugar.
            </p>
          </div>
          <Button
            variant="brand"
            className="w-full h-11 font-medium"
            onClick={() => setEstado({ fase: "senha", info })}
          >
            Criar conta
          </Button>
          <AvisoPrivacidadeConvidado />
        </div>
      </div>
    );
  }

  return (
    <div className="landing-grain min-h-dvh w-full flex items-center justify-center bg-paper p-8">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
            <Logo size="lg" className="text-ink" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Crie sua conta</h1>
          <p className="text-sm text-ink-soft">Defina a senha do seu acesso ao portal do cliente.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="convite-email" className="text-sm leading-none text-ink-soft font-medium">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-ink/40" />
                <Input
                  id="convite-email"
                  type="email"
                  value={info.email}
                  readOnly
                  disabled
                  className="pl-10 h-11 bg-paper-alt border-paper-border"
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-ink-soft font-medium">Nova senha</FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40" />
                      <Input
                        {...field}
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11 bg-paper-alt border-paper-border"
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
                  <PasswordRequirements password={senha ?? ""} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-ink-soft font-medium">Confirmar senha</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-11 bg-paper-alt border-paper-border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button variant="brand" className="w-full h-11 font-medium" type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <BusyMark className="mr-2 h-4 w-4" /> Salvando...
                </>
              ) : (
                "Definir senha e entrar"
              )}
            </Button>
          </form>
        </Form>
        <AvisoPrivacidadeConvidado />
      </div>
    </div>
  );
}
