import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, HardHat, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
}

interface Credencial {
  email: string;
  senha: string;
}

function useInviteCampo() {
  return useMutation({
    mutationFn: async (input: { obraId: string; nome: string; email: string }): Promise<Credencial> => {
      const { data, error } = await supabase.functions.invoke("invite-campo", {
        body: { obra_id: input.obraId, nome: input.nome, email: input.email },
      });
      if (error) throw error;
      const res = data as { success?: boolean; email?: string; senha?: string; error?: string };
      if (!res?.success || !res.senha || !res.email) throw new Error(res?.error ?? "Falha ao criar o acesso");
      return { email: res.email, senha: res.senha };
    },
  });
}

export function CriarAcessoCampoDialog({ open, onOpenChange, obraId }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cred, setCred] = useState<Credencial | null>(null);
  const [copiado, setCopiado] = useState(false);
  const invite = useInviteCampo();

  useEffect(() => {
    if (!open) {
      setNome("");
      setEmail("");
      setCred(null);
      setCopiado(false);
    }
  }, [open]);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;
    try {
      const c = await invite.mutateAsync({ obraId, nome: nome.trim(), email: email.trim() });
      setCred(c);
    } catch (err) {
      toast.error("Não foi possível criar o acesso", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    }
  };

  const copiar = async () => {
    if (!cred) return;
    await navigator.clipboard.writeText(`Pilar Campo\nEmail: ${cred.email}\nSenha: ${cred.senha}`);
    setCopiado(true);
    toast.success("Acesso copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-muted-foreground" />
            Acesso de campo
          </DialogTitle>
          <DialogDescription>
            {cred
              ? "Anote agora: a senha só aparece uma vez. Entregue ao pessoal de campo."
              : "Crie um acesso ao Pilar Campo para quem está na obra registrar o dia pelo celular."}
          </DialogDescription>
        </DialogHeader>

        {cred ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-black/5 bg-muted/40 p-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Endereço</span>
                <span className="font-medium text-ink">pilarsoft.com.br/campo</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-ink">{cred.email}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Senha</span>
                <span className="font-mono font-medium text-ink">{cred.senha}</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button type="button" variant="brand" onClick={copiar}>
                {copiado ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                Copiar acesso
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={criar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campo-nome">Nome</Label>
              <Input
                id="campo-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: João (encarregado)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campo-email">Email de acesso</Label>
              <Input
                id="campo-email"
                type="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao.obra@campo.local"
              />
              <p className="text-xs text-muted-foreground">Serve de login. Se a pessoa não tem email, invente um.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={invite.isPending}>
                {invite.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Gerar acesso
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
