export interface ContaBancaria {
  banco: string;
  agencia: string;
  conta: string;
  tipo: string;
  is_primary: boolean;
}

export interface ChavePix {
  chave: string;
  tipo: string;
}

export interface Pessoa {
  id: string;
  nome: string;
  primeiro_nome?: string;
  sobrenome?: string;
  cpf: string;
  rg?: string;
  data_nascimento?: string;
  tipo_contrato: string;
  status?: string;
  cargo: string;
  telefone: string;
  email: string;
  endereco?: string;
  data_admissao?: string;
  data_demissao?: string;
  salario_fixo?: number;
  valor_m2?: number;
  cnpj?: string;
  razao_social?: string;
  pis_nit?: string;
  contas_bancarias?: ContaBancaria[];
  chaves_pix?: ChavePix[];
}
