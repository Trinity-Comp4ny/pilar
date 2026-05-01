import { z } from "zod";
import { CONTRACT_TYPES, PESSOA_STATUS } from "@/constants";
import { onlyDigits } from "@/lib/maskUtils";

function isValidCPF(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem >= 10) rem = 0;
  if (rem !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem >= 10) rem = 0;
  return rem === Number(d[10]);
}

function isValidCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    let s = 0;
    let w = len - 7;
    for (let i = len; i >= 1; i--) {
      s += Number(d[len - i]) * w--;
      if (w < 2) w = 9;
    }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const contaBancariaSchema = z.object({
  banco: z.string().min(1, "Banco é obrigatório"),
  agencia: z.string().min(1, "Agência é obrigatória"),
  conta: z.string().min(1, "Conta é obrigatória"),
  tipo: z.enum(["corrente", "poupanca", "pj"]).default("corrente"),
});

export type ContaBancariaFormData = z.infer<typeof contaBancariaSchema>;

export const pessoaSchema = z
  .object({
    primeiro_nome: z.string().min(1, "Nome é obrigatório"),
    sobrenome: z.string().min(1, "Sobrenome é obrigatório"),
    cpf: z.string().optional().default(""),
    rg: z.string().optional().default(""),
    data_nascimento: z.string().optional().default(""),
    tipo_contrato: z
      .enum([
        CONTRACT_TYPES.CLT,
        CONTRACT_TYPES.PJ,
        CONTRACT_TYPES.ESTAGIARIO,
        CONTRACT_TYPES.SOCIO,
        CONTRACT_TYPES.TERCEIRIZADO,
      ])
      .default(CONTRACT_TYPES.CLT),
    status: z.enum([PESSOA_STATUS.ATIVO, PESSOA_STATUS.INATIVO, PESSOA_STATUS.AFASTADO]).default(PESSOA_STATUS.ATIVO),
    cargo: z.string().min(1, "Cargo é obrigatório"),
    telefone: z.string().optional().default(""),
    email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
    endereco: z.string().optional().default(""),
    data_admissao: z.string().optional().default(""),
    data_demissao: z.string().optional().default(""),
    salario_fixo: z.string().optional().default(""),
    valor_m2: z.string().optional().default(""),
    cnpj: z.string().optional().default(""),
    razao_social: z.string().optional().default(""),
    pis_nit: z.string().optional().default(""),
  })
  .refine((data) => data.tipo_contrato !== CONTRACT_TYPES.PJ || data.cnpj.trim().length > 0, {
    message: "CNPJ é obrigatório para PJ",
    path: ["cnpj"],
  })
  .refine(
    (data) => {
      const digits = onlyDigits(data.cpf ?? "");
      if (digits.length === 0) return true;
      return isValidCPF(data.cpf ?? "");
    },
    { message: "CPF inválido", path: ["cpf"] }
  )
  .refine(
    (data) => {
      if (data.tipo_contrato !== CONTRACT_TYPES.PJ) return true;
      const digits = onlyDigits(data.cnpj ?? "");
      if (digits.length === 0) return true;
      return isValidCNPJ(data.cnpj ?? "");
    },
    { message: "CNPJ inválido", path: ["cnpj"] }
  )
  .refine(
    (data) => {
      if (!data.data_admissao || !data.data_demissao) return true;
      return data.data_admissao <= data.data_demissao;
    },
    { message: "Demissão não pode ser anterior à admissão", path: ["data_demissao"] }
  );

export type PessoaFormData = z.infer<typeof pessoaSchema>;

export const pessoaDefaultValues: PessoaFormData = {
  primeiro_nome: "",
  sobrenome: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  tipo_contrato: CONTRACT_TYPES.CLT,
  status: PESSOA_STATUS.ATIVO,
  cargo: "",
  telefone: "",
  email: "",
  endereco: "",
  data_admissao: "",
  data_demissao: "",
  salario_fixo: "",
  valor_m2: "",
  cnpj: "",
  razao_social: "",
  pis_nit: "",
};
