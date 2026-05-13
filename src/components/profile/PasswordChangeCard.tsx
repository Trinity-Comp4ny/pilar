import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";

type Props = { currentEmail: string };

export function PasswordChangeCard({ currentEmail }: Props) {
  const [editing, setEditing] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    setEditing(false);
  };

  const handleSave = async () => {
    if (newPwd.length < 8) {
      toast.error("Senha muito curta", { description: "Use ao menos 8 caracteres." });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (!currentEmail) {
      toast.error("Email não disponível");
      return;
    }

    setSaving(true);
    try {
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPwd,
      });
      if (reauthErr) {
        toast.error("Senha atual incorreta");
        setSaving(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast.success("Senha atualizada");
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar senha";
      toast.error("Erro ao trocar senha", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border border-black/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Senha
        </CardTitle>
        <CardDescription>Atualizar exige confirmação da senha atual</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {editing ? (
          <>
            <div className="space-y-2">
              <Label>Senha atual</Label>
              <Input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                disabled={saving}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-brand hover:bg-brand/90 text-ink">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Trocar senha
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
