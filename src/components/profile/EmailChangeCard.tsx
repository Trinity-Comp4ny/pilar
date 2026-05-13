import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AtSign, Loader2 } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  currentEmail: string;
  onChanged: (newEmail: string) => void;
};

export function EmailChangeCard({ currentEmail, onChanged }: Props) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      toast.error("Email inválido");
      return;
    }
    if (trimmed === currentEmail.toLowerCase()) {
      toast.error("Novo email igual ao atual");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      toast.success("Email de confirmação enviado", {
        description: "Confirme no link enviado para o novo endereço para concluir a troca.",
      });
      onChanged(trimmed);
      setNewEmail("");
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar email";
      toast.error("Erro ao trocar email", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border border-black/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AtSign className="h-5 w-5" />
          Email de login
        </CardTitle>
        <CardDescription>Trocar exige confirmação no novo endereço</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Email atual</Label>
          <Input value={currentEmail} readOnly className="bg-black/5 border-black/10 text-black/80" />
        </div>
        {editing ? (
          <>
            <div className="space-y-2">
              <Label>Novo email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@empresa.com"
                disabled={saving}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setNewEmail("");
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-brand hover:bg-brand/90 text-ink">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar confirmação"}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Trocar email
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
