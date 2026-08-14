import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, HardHat, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getCampoToken, setCampoToken } from "./useCampoAuth";

type LoginResp = { ok: boolean; token?: string; nome?: string; must_change_senha?: boolean; erro?: string };

export default function CampoLogin() {
  usePageTitle("Pilar Campo | Entrar");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  // Já tem sessão? vai direto.
  useEffect(() => {
    if (getCampoToken()) navigate("/campo", { replace: true });
  }, [navigate]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("campo_login", { p_email: email.trim(), p_senha: senha });
      if (error) throw error;
      const res = data as unknown as LoginResp;
      if (!res?.ok || !res.token) {
        toast.error("Não foi possível entrar", { description: res?.erro ?? "Email ou senha inválidos" });
        return;
      }
      setCampoToken(res.token);
      navigate(res.must_change_senha ? "/campo/senha" : "/campo", { replace: true });
    } catch {
      toast.error("Falha na conexão", { description: "Verifique a internet e tente de novo." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-ink">
            <HardHat className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Pilar Campo</h1>
          <p className="text-sm text-muted-foreground">Registre o dia da obra pelo celular.</p>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu acesso"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <Input
                id="senha"
                type={showSenha ? "text" : "password"}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="h-12 pr-11 text-base"
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-3.5 text-muted-foreground"
              >
                {showSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          O acesso é criado pelo escritório. Perdeu a senha? Fale com o responsável pela obra.
        </p>
      </div>
    </div>
  );
}
