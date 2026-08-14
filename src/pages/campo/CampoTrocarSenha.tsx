import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageTitle } from "@/hooks/usePageTitle";
import { getCampoToken, setCampoToken } from "./useCampoAuth";

type Resp = { ok: boolean; token?: string; erro?: string };

export default function CampoTrocarSenha() {
  usePageTitle("Pilar Campo | Nova senha");
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("Senha curta", { description: "Use ao menos 8 caracteres." });
      return;
    }
    if (senha !== confirma) {
      toast.error("As senhas não conferem");
      return;
    }
    const token = getCampoToken();
    if (!token) {
      navigate("/campo/login", { replace: true });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("campo_trocar_senha", { p_token: token, p_nova_senha: senha });
      if (error) throw error;
      const res = data as unknown as Resp;
      if (!res?.ok || !res.token) {
        toast.error("Não foi possível salvar", { description: res?.erro ?? "Tente novamente" });
        return;
      }
      // A troca rotaciona o token; guarda o novo para seguir sem novo login.
      setCampoToken(res.token);
      toast.success("Senha atualizada");
      navigate("/campo", { replace: true });
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
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Crie sua senha</h1>
          <p className="text-sm text-muted-foreground">Troque a senha que o escritório te passou por uma só sua.</p>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nova">Nova senha</Label>
            <Input
              id="nova"
              type="password"
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="ao menos 8 caracteres"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirma">Repita a senha</Label>
            <Input
              id="confirma"
              type="password"
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              placeholder="••••••••"
              className="h-12 text-base"
            />
          </div>

          <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Salvar e entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
