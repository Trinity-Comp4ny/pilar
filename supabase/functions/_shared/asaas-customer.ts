/**
 * De onde saem os dados do cliente Asaas quando a empresa ainda não tem um.
 *
 * Empresa criada pelo /ultra-admin não passa pelo checkout pago, então nunca
 * ganha `asaas_customer_id`: em 03/09 isso era 5 de 5 empresas ativas em
 * produção e nenhuma conseguia comprar pacote de tokens. Na primeira compra o
 * cliente é criado na hora, e a única informação que a Asaas exige e que pode
 * faltar é o CPF/CNPJ.
 *
 * Precedência: o que o usuário acabou de digitar no pagamento vale mais que o
 * cadastro, porque é o dado que vai na cobrança. Cartão sempre traz titular;
 * PIX e boleto não pedem esse dado na tela, então dependem do CNPJ da empresa.
 */

export interface HolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
}

export interface EmpresaCobranca {
  nome?: string | null;
  cnpj?: string | null;
  email?: string | null;
}

export type DadosCliente = { name: string; email: string; cpfCnpj: string; phone?: string };

export type ResolucaoCliente = { ok: true; dados: DadosCliente } | { ok: false; error: string };

const SEM_DOCUMENTO =
  "Cadastre o CNPJ da empresa em Configurações antes de comprar tokens, ou pague com cartão para informar o CPF/CNPJ do titular.";
const SEM_CONTATO = "Complete o nome e o e-mail da empresa em Configurações antes de comprar tokens.";

export function resolverDadosCliente(params: {
  holder?: HolderInfo;
  empresa?: EmpresaCobranca | null;
  userEmail?: string | null;
}): ResolucaoCliente {
  const { holder, empresa, userEmail } = params;

  const cpfCnpj = (holder?.cpfCnpj ?? empresa?.cnpj ?? "").replace(/\D/g, "");
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    return { ok: false, error: SEM_DOCUMENTO };
  }

  const name = trimOrUndefined(holder?.name) ?? trimOrUndefined(empresa?.nome);
  const email = trimOrUndefined(holder?.email) ?? trimOrUndefined(empresa?.email) ?? trimOrUndefined(userEmail);
  if (!name || !email) {
    return { ok: false, error: SEM_CONTATO };
  }

  return { ok: true, dados: { name, email, cpfCnpj, phone: trimOrUndefined(holder?.phone) } };
}

function trimOrUndefined(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}
