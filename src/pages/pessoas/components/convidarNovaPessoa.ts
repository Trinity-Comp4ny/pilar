import { toast } from "sonner";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { reportInvokeError } from "@/lib/monitoring";
import { convidarPessoa } from "../hooks/useAcessoPessoa";

/**
 * Convida a pessoa recém-cadastrada. Ela já está salva: falha aqui não desfaz o
 * cadastro, só avisa como tentar de novo pela ficha da pessoa.
 */
export async function convidarNovaPessoa(pessoa: { id: string; nome: string; email: string }) {
  try {
    await convidarPessoa(pessoa);
    toast.success("Convite enviado", { description: `Um e-mail foi enviado para ${pessoa.email}.` });
  } catch (err) {
    reportInvokeError(err, "invite-user:nova-pessoa");
    toast.error("Pessoa cadastrada, mas o convite não saiu", {
      description: await edgeFunctionErrorMessage(err, 'Abra a pessoa na Equipe e use "Convidar para a Pilar".'),
    });
  }
}
