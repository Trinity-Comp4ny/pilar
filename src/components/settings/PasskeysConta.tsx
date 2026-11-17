import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { cadastrarPasskey, passkeyDisponivel } from "@/lib/passkey";
import { formatDate } from "@/lib/format";
import { haptico } from "@/lib/haptico";

const CHAVE = ["passkeys"];

/** Segurança: entrar com biometria neste aparelho. Some onde passkey não está ligado/suportado. */
export function PasskeysConta() {
  // Wrapper: sem passkey ligado nem toca em React Query (telas e testes sem provider seguem iguais).
  if (!passkeyDisponivel()) return null;
  return <PasskeysContaAtiva />;
}

function PasskeysContaAtiva() {
  const queryClient = useQueryClient();
  const [removendo, setRemovendo] = useState<string | null>(null);

  const { data: lista = [] } = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      return data ?? [];
    },
  });

  const adicionar = useMutation({
    meta: { haptico: false },
    mutationFn: async () => {
      const r = await cadastrarPasskey();
      if (!r.ok && !r.cancelado) throw new Error(r.mensagem);
      return r.ok;
    },
    onSuccess: (feito) => {
      if (!feito) return;
      haptico("sucesso");
      toast.success("Biometria ativada neste aparelho");
      void queryClient.invalidateQueries({ queryKey: CHAVE });
    },
  });

  const remover = useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await supabase.auth.passkey.delete({ passkeyId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso por biometria removido");
      setRemovendo(null);
      void queryClient.invalidateQueries({ queryKey: CHAVE });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Entrar com biometria
        </CardTitle>
        <CardDescription>
          Use a digital, o rosto ou o PIN do aparelho em vez de digitar a senha. Cada aparelho cadastra o seu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lista.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.friendly_name || "Aparelho"}</p>
              <p className="text-xs text-muted-foreground">Cadastrado em {formatDate(p.created_at)}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setRemovendo(p.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" loading={adicionar.isPending} onClick={() => adicionar.mutate()}>
          <Fingerprint className="mr-2 h-4 w-4" />
          Ativar neste aparelho
        </Button>
      </CardContent>
      <ConfirmDialog
        open={removendo !== null}
        onOpenChange={(o) => !o && setRemovendo(null)}
        onConfirm={() => removendo && remover.mutate(removendo)}
        title="Remover acesso por biometria?"
        description="Esse aparelho volta a pedir a senha para entrar."
        confirmText="Remover"
        variant="destructive"
        loading={remover.isPending}
      />
    </Card>
  );
}
