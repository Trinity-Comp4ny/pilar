import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePageTitle } from "@/hooks/usePageTitle";
import { setCampoToken } from "./useCampoAuth";

type Resp = { ok: boolean; token?: string; nome?: string; erro?: string };

export default function CampoConvite() {
  usePageTitle("Pilar Campo | Definir senha");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (senha.length < 8) {
      toast.error("Senha curta", { description: "Use ao menos 8 caracteres." });
      return;
    }
    if (senha !== confirma) {
      toast.error("As senhas não conferem");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("campo_convite_definir_senha", { p_token: token, p_senha: senha });
      if (error) throw error;
      const res = data as unknown as Resp;
      if (!res?.ok || !res.token) {
        toast.error("Não foi possível definir a senha", {
          description: res?.erro ?? "O convite pode ter expirado. Peça um novo ao responsável pela obra.",
        });
        return;
      }
      setCampoToken(res.token);
      toast.success("Senha definida");
      navigate("/campo", { replace: true });
    } catch {
      toast.error("Falha na conexão", { description: "Verifique a internet e tente de novo." });
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-semibold text-ink">Link inválido</h1>
        <p className="text-sm text-muted-foreground">
          Este link de convite está incompleto. Peça ao responsável pela obra para reenviar.
        </p>
        <Button variant="outline" onClick={() => navigate("/campo/login")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-ink">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-ink">Defina sua senha</h1>
          <p className="text-sm text-muted-foreground">Escolha a senha do seu acesso ao Pilar Campo.</p>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nova">Nova senha</Label>
            <div className="relative">
              <Input
                id="nova"
                type={showSenha ? "text" : "password"}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="ao menos 8 caracteres"
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
          <div className="space-y-1.5">
            <Label htmlFor="confirma">Repita a senha</Label>
            <Input
              id="confirma"
              type={showSenha ? "text" : "password"}
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              placeholder="••••••••"
              className="h-12 text-base"
            />
          </div>

          <Button type="submit" variant="brand" className="h-12 w-full text-base" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Definir senha e entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
