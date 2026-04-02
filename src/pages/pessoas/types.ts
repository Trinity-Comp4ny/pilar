export interface ContaBancaria {
  banco: string;
  agencia: string;
  conta: string;
  tipo: string;
  is_primary: boolean;
}

export interface Pessoa {
  id: string;
  nome: string;
  cpf: string;
  tipo_contrato: string;
  cargo: string;
  telefone: string;
  email: string;
  endereco?: string;
  data_admissao?: string;
  salario_fixo?: number;
  valor_m2?: number;
  data_demissao?: string;
  contas_bancarias?: ContaBancaria[];
}
