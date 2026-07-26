import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { getPortalToken } from "@/hooks/useClienteAuth";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import { trocarSenhaPortalSchema, trocarSenhaPortalDefaultValues, type TrocarSenhaPortalFormData } from "@/schemas";

interface TrocarSenhaFormProps {
  // No fluxo forçado o botão de cancelar some e o texto de sucesso muda.
  forced?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

// Mensagens que o RPC portal_change_password devolve prontas para o cliente.
// Qualquer outra vira uma mensagem genérica.
const KNOWN_ERRORS = new Set([
  "Senha atual incorreta",
  "A nova senha deve ser diferente da atual",
  "A nova senha não atende à política de segurança.",
]);

export function TrocarSenhaForm({ forced = false, onSuccess, onCancel }: TrocarSenhaFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);

  const form = useForm<TrocarSenhaPortalFormData>({
    resolver: zodResolver(trocarSenhaPortalSchema),
    mode: "onChange",
    defaultValues: trocarSenhaPortalDefaultValues,
  });

  const handleSubmit = async (values: TrocarSenhaPortalFormData) => {
    const token = getPortalToken();
    if (!token) {
      toast.error("Sessão expirada", { description: "Entre novamente para trocar a senha." });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await callUntypedRpc<{ ok: boolean }>("portal_change_password", {
        p_token: token,
        p_senha_atual: values.senhaAtual,
        p_nova_senha: values.novaSenha,
      });

      if (error) {
        const msg = KNOWN_ERRORS.has(error.message)
          ? error.message
          : "Não foi possível trocar a senha. Tente novamente.";
        if (error.message === "Senha atual incorreta") {
          form.setError("senhaAtual", { message: error.message });
        }
        toast.error("Erro ao trocar senha", { description: msg });
        return;
      }

      toast.success("Senha alterada", { description: "Use a nova senha nos próximos acessos." });
      form.reset();
      onSuccess();
    } catch {
      toast.error("Falha na conexão", { description: "Verifique sua internet e tente novamente." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="senhaAtual"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-ink-soft font-medium">Senha atual</FormLabel>
              <FormControl>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40" />
                  <Input
                    {...field}
                    type={showAtual ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAtual((v) => !v)}
                    aria-label={showAtual ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showAtual}
                    className="absolute right-3 top-3 text-ink/40 hover:text-ink-soft transition-colors"
                  >
                    {showAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="novaSenha"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-ink-soft font-medium">Nova senha</FormLabel>
              <FormControl>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40" />
                  <Input
                    {...field}
                    type={showNova ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNova((v) => !v)}
                    aria-label={showNova ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showNova}
                    className="absolute right-3 top-3 text-ink/40 hover:text-ink-soft transition-colors"
                  >
                    {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
          name="confirmarSenha"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel className="text-ink-soft font-medium">Confirmar nova senha</FormLabel>
              <FormControl>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-ink/40" />
                  <Input
                    {...field}
                    type={showNova ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-10 h-11"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-1">
          {!forced && onCancel && (
            <Button type="button" variant="outline" className="flex-1 h-11" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
          )}
          <Button type="submit" variant="brand" className="flex-1 h-11 font-medium" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              "Salvar nova senha"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
