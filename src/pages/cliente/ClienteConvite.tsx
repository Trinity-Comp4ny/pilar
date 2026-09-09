import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { setPortalToken } from "@/hooks/useClienteAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import { passwordResetSchema, passwordResetDefaultValues, type PasswordResetFormData } from "@/schemas";
import { Logo } from "@/components/Logo";

type ConviteResp = { ok: boolean; token?: string; nome?: string; erro?: string };

export default function ClienteConvite() {
  usePageTitle("Portal | Definir senha");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  if (!token) {
    return (
      <div className="landing-grain min-h-screen w-full flex items-center justify-center bg-paper p-8">
        <div className="w-full max-w-[400px] space-y-4 text-center">
          <Logo size="lg" className="text-ink mx-auto" />
          <h1 className="text-xl font-semibold text-ink">Link inválido</h1>
          <p className="text-sm text-ink-soft">
            Este link de convite está incompleto. Peça ao escritório para reenviar o convite.
          </p>
          <Button variant="outline" onClick={() => navigate("/cliente/login")}>
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-grain min-h-screen w-full flex items-center justify-center bg-paper p-8">
      <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
            <Logo size="lg" className="text-ink" />
          </div>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-ink">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Defina sua senha</h1>
          <p className="text-sm text-ink-soft">Escolha a senha do seu acesso ao portal do cliente.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
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
                  <p className="text-xs text-muted-foreground">
                    Mínimo 12 caracteres, com maiúscula, minúscula, número e caractere especial.
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                "Definir senha e entrar"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
