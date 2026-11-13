import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useRequireAal2 } from "@/hooks/useRequireAal2";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { getSafeErrorMessage } from "@/lib/safeError";
import { reportInvokeError } from "@/lib/monitoring";
import { formatDate } from "@/lib/format";
import {
  useContaDaPessoa,
  useContasSemPessoa,
  useConvidarPessoa,
  useConvitePendente,
  useVincularConta,
} from "../hooks/useAcessoPessoa";

interface PessoaAcessoSecaoProps {
  pessoa: { id: string; nome: string; email: string; profile_id?: string | null };
  /** Chamado depois de ligar/desligar, para o dono do diálogo refletir o novo vínculo. */
  onVinculoAlterado?: (profileId: string | null) => void;
}

const PAPEIS_ADMIN = ["admin", "owner", "ultra_admin"];

/**
 * Acesso à Pilar da pessoa da Equipe: se ela tem login e qual é. Quem tem login
 * aparece no @ das atividades e recebe o aviso da menção (no sistema e por e-mail).
 * Admin convida (o convite já nasce ligado à pessoa) ou liga a um login que já existe
 * com outro e-mail.
 */
export function PessoaAcessoSecao({ pessoa, onVinculoAlterado }: PessoaAcessoSecaoProps) {
  const { profile } = useAuth();
  const podeGerir = PAPEIS_ADMIN.includes(String(profile?.role ?? ""));
  const requireAal2 = useRequireAal2();
  const [contaEscolhida, setContaEscolhida] = useState("");

  const profileId = pessoa.profile_id ?? null;
  const { data: conta } = useContaDaPessoa(profileId);
  const { data: convite } = useConvitePendente(pessoa.id, podeGerir && !profileId);
  const { data: contasLivres = [] } = useContasSemPessoa(profile?.empresa_id, podeGerir && !profileId);
  const vincular = useVincularConta();
  const convidar = useConvidarPessoa();

  const ligar = (novoProfileId: string | null) => {
    vincular.mutate(
      { pessoaId: pessoa.id, profileId: novoProfileId },
      {
        onSuccess: () => {
          setContaEscolhida("");
          onVinculoAlterado?.(novoProfileId);
          toast.success(novoProfileId ? "Acesso ligado" : "Acesso desligado", {
            description: novoProfileId
              ? `${pessoa.nome} passa a receber as menções.`
              : `${pessoa.nome} deixa de receber as menções.`,
          });
        },
        onError: (err) =>
          toast.error("Não foi possível alterar o acesso", {
            description: getSafeErrorMessage(err, "Tente de novo em instantes."),
          }),
      }
    );
  };

  const enviarConvite = async () => {
    if (!(await requireAal2())) return;
    convidar.mutate(pessoa, {
      onSuccess: ({ contaExistente }) =>
        toast.success("Convite enviado", {
          description: contaExistente
            ? `${pessoa.email} já tem login: é só entrar com ele.`
            : `Um e-mail foi enviado para ${pessoa.email}.`,
        }),
      onError: async (err) => {
        reportInvokeError(err, "invite-user:equipe");
        toast.error("Erro ao convidar", {
          description: await edgeFunctionErrorMessage(err, "Não foi possível enviar o convite. Tente de novo."),
        });
      },
    });
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5" />
        Acesso à Pilar
      </h4>

      {profileId ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="font-medium">Tem acesso</p>
            {conta?.email && <p className="truncate text-muted-foreground">Entra como {conta.email}</p>}
          </div>
          {podeGerir && (
            <Button variant="outline" size="sm" loading={vincular.isPending} onClick={() => ligar(null)}>
              Desligar
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {convite
              ? `Convite enviado para ${convite.email}, válido até ${formatDate(convite.expira_em)}.`
              : "Sem login na Pilar: não aparece no @ das atividades e não recebe avisos."}
          </p>

          {podeGerir && (
            <>
              <Button
                variant={convite ? "outline" : "brand"}
                size="sm"
                loading={convidar.isPending}
                disabled={!pessoa.email}
                onClick={enviarConvite}
              >
                {convite ? "Reenviar convite" : "Convidar para a Pilar"}
              </Button>

              {contasLivres.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Já tem login com outro e-mail? Ligue à conta dela:</p>
                  <div className="flex gap-2">
                    <Select value={contaEscolhida} onValueChange={setContaEscolhida}>
                      <SelectTrigger className="h-9 flex-1" aria-label="Conta de login">
                        <SelectValue placeholder="Escolher conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {contasLivres.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} ({c.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={!contaEscolhida}
                      loading={vincular.isPending}
                      onClick={() => ligar(contaEscolhida)}
                    >
                      Ligar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
