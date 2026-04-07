import { z } from "zod";
import { CONTRACT_TYPES } from "@/constants";

export const contaBancariaSchema = z.object({
  banco: z.string().min(1, "Banco é obrigatório"),
  agencia: z.string().min(1, "Agência é obrigatória"),
  conta: z.string().min(1, "Conta é obrigatória"),
  tipo: z.enum(["corrente", "poupanca", "pj"]).default("corrente"),
});

export type ContaBancariaFormData = z.infer<typeof contaBancariaSchema>;

export const pessoaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().optional().default(""),
  tipo_contrato: z.string().default(CONTRACT_TYPES.CONTRATADO),
  cargo: z.string().min(1, "Cargo é obrigatório"),
  telefone: z.string().optional().default(""),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  endereco: z.string().optional().default(""),
  data_admissao: z.string().optional().default(""),
  data_demissao: z.string().optional().default(""),
  salario_fixo: z.string().optional().default(""),
  valor_m2: z.string().optional().default(""),
});

export type PessoaFormData = z.infer<typeof pessoaSchema>;

export const pessoaDefaultValues: PessoaFormData = {
  nome: "",
  cpf: "",
  tipo_contrato: CONTRACT_TYPES.CONTRATADO,
  cargo: "",
  telefone: "",
  email: "",
  endereco: "",
  data_admissao: "",
  data_demissao: "",
  salario_fixo: "",
  valor_m2: "",
};
