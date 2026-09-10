import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, HardHat } from "lucide-react";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  obraId: string;
}

type Resultado = { modo: "convite"; email: string } | { modo: "senha"; email: string; senha: string };

function useInviteCampo() {
  return useMutation({
    mutationFn: async (input: { obraId: string; nome: string; email: string }): Promise<Resultado> => {
      const { data, error } = await supabase.functions.invoke("invite-campo", {
        body: { obra_id: input.obraId, nome: input.nome, email: input.email || undefined },
      });
      if (error) throw error;
      const res = data as {
        success?: boolean;
        modo?: "convite" | "senha";
        email?: string;
        senha?: string;
        error?: string;
      };
      if (!res?.success || !res.email) throw new Error(res?.error ?? "Falha ao criar o acesso");
      if (res.modo === "convite") return { modo: "convite", email: res.email };
      if (!res.senha) throw new Error("Falha ao criar o acesso");
      return { modo: "senha", email: res.email, senha: res.senha };
    },
  });
}

export function CriarAcessoCampoDialog({ open, onOpenChange, obraId }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const invite = useInviteCampo();

  useEffect(() => {
    if (!open) {
      setNome("");
      setEmail("");
      setResultado(null);
      setCopiado(false);
    }
  }, [open]);

  const criar = async () => {
    if (!nome.trim()) return;
    try {
      const r = await invite.mutateAsync({ obraId, nome: nome.trim(), email: email.trim() });
      setResultado(r);
    } catch (err) {
      toast.error("Não foi possível criar o acesso", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    }
  };

  const copiar = async () => {
    if (!resultado) return;
    const texto =
      resultado.modo === "convite"
        ? `Pilar Campo\nEnviamos um convite para ${resultado.email} para definir a senha.`
        : `Pilar Campo\nEmail: ${resultado.email}\nSenha: ${resultado.senha}`;
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success("Copiado");
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-muted-foreground" />
          Acesso de campo
        </span>
      }
      description={
        resultado
          ? resultado.modo === "convite"
            ? "Convite enviado. A pessoa recebe um link para escolher a própria senha."
            : "Anote agora: a senha só aparece uma vez. Entregue ao pessoal de campo."
          : "Crie um acesso ao Pilar Campo para quem está na obra registrar o dia pelo celular."
      }
      size="md"
      onSubmit={resultado ? copiar : criar}
      isPending={resultado ? false : invite.isPending}
      cancelLabel={resultado ? "Fechar" : "Cancelar"}
      submitLabel={resultado ? "Copiar" : "Criar acesso"}
    >
      {resultado ? (
        <div className="space-y-2 rounded-xl border border-black/5 bg-muted/40 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Endereço</span>
            <span className="font-medium text-ink">
              {resultado.modo === "convite" ? "pilarsoft.com.br/campo/convite" : "pilarsoft.com.br/campo"}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-ink">{resultado.email}</span>
          </div>
          {resultado.modo === "senha" && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Senha</span>
              <span className="font-mono font-medium text-ink">{resultado.senha}</span>
            </div>
          )}
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? "Copiado" : "Use o botão abaixo pra copiar"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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
            <Label htmlFor="campo-email">Email (opcional)</Label>
            <Input
              id="campo-email"
              type="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@email.com"
            />
            <p className="text-xs text-muted-foreground">
              Com email, mandamos um link para a pessoa criar a própria senha. Sem email, você entrega a senha na mão.
            </p>
          </div>
        </div>
      )}
    </FormDialog>
  );
}
