export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string;
          owner_id: string | null;
          nome: string;
          cnpj: string | null;
          email: string | null;
          contato: string | null;
          endereco: string | null;
          cidade: string | null;
          estado: string | null;
          cep: string | null;
          logo_url: string | null;
          status: Database["public"]["Enums"]["status_empresa"];
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          nome: string;
          cnpj?: string | null;
          email?: string | null;
          contato?: string | null;
          endereco?: string | null;
          cidade?: string | null;
          estado?: string | null;
          cep?: string | null;
          logo_url?: string | null;
          status?: Database["public"]["Enums"]["status_empresa"];
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          nome?: string;
          cnpj?: string | null;
          email?: string | null;
          contato?: string | null;
          endereco?: string | null;
          cidade?: string | null;
          estado?: string | null;
          cep?: string | null;
          logo_url?: string | null;
          status?: Database["public"]["Enums"]["status_empresa"];
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          email: string;
          role: Database["public"]["Enums"]["user_role"];
          contato: string | null;
          avatar_url: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id: string;
          empresa_id: string;
          nome: string;
          email: string;
          role?: Database["public"]["Enums"]["user_role"];
          contato?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          email?: string;
          role?: Database["public"]["Enums"]["user_role"];
          contato?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      pessoas: {
        Row: {
          id: string;
          empresa_id: string;
          profile_id: string | null;
          nome: string;
          cpf: string | null;
          cargo: string | null;
          email: string | null;
          telefone: string | null;
          tipo_contrato: string | null;
          endereco: string | null;
          data_admissao: string | null;
          data_demissao: string | null;
          salario_fixo: number | null;
          valor_m2: number | null;
          conta_bancaria: string | null;
          contas_bancarias: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          profile_id?: string | null;
          nome: string;
          cpf?: string | null;
          cargo?: string | null;
          email?: string | null;
          telefone?: string | null;
          tipo_contrato?: string | null;
          endereco?: string | null;
          data_admissao?: string | null;
          data_demissao?: string | null;
          salario_fixo?: number | null;
          valor_m2?: number | null;
          conta_bancaria?: string | null;
          contas_bancarias?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          profile_id?: string | null;
          nome?: string;
          cpf?: string | null;
          cargo?: string | null;
          email?: string | null;
          telefone?: string | null;
          tipo_contrato?: string | null;
          endereco?: string | null;
          data_admissao?: string | null;
          data_demissao?: string | null;
          salario_fixo?: number | null;
          valor_m2?: number | null;
          conta_bancaria?: string | null;
          contas_bancarias?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pessoas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          cpf_cnpj: string | null;
          contato: string | null;
          email: string | null;
          endereco: string | null;
          tipo_nf: string | null;
          origem: string | null;
          contas_bancarias: Json;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          cpf_cnpj?: string | null;
          contato?: string | null;
          email?: string | null;
          endereco?: string | null;
          tipo_nf?: string | null;
          origem?: string | null;
          contas_bancarias?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          cpf_cnpj?: string | null;
          contato?: string | null;
          email?: string | null;
          endereco?: string | null;
          tipo_nf?: string | null;
          origem?: string | null;
          contas_bancarias?: Json;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          email: string | null;
          contato: string | null;
          status: string;
          origem: string | null;
          cliente_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          email?: string | null;
          contato?: string | null;
          status?: string;
          origem?: string | null;
          cliente_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          email?: string | null;
          contato?: string | null;
          status?: string;
          origem?: string | null;
          cliente_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      fornecedores: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          cnpj: string | null;
          contato: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          cnpj?: string | null;
          contato?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          cnpj?: string | null;
          contato?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      contas: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          banco: string;
          saldo_inicial: number;
          saldo_atual: number;
          cor: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          banco: string;
          saldo_inicial?: number;
          saldo_atual?: number;
          cor?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          banco?: string;
          saldo_inicial?: number;
          saldo_atual?: number;
          cor?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cartoes_credito: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          dia_fechamento: number | null;
          dia_vencimento: number | null;
          limite: number;
          conta_pagamento_id: string | null;
          cor: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          limite: number;
          conta_pagamento_id?: string | null;
          cor?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          limite?: number;
          conta_pagamento_id?: string | null;
          cor?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cartoes_credito_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias_financeiras: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nome: string;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          nome?: string;
          tipo?: Database["public"]["Enums"]["tipo_categoria"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      projetos: {
        Row: {
          id: string;
          empresa_id: string;
          cliente_id: string | null;
          codigo_projeto: string | null;
          nome: string;
          localizacao: string | null;
          latitude: number | null;
          longitude: number | null;
          status: Database["public"]["Enums"]["status_projeto"];
          prioridade: string;
          data_inicio: string | null;
          data_previsao: string | null;
          data_final: string | null;
          valor_contrato: number | null;
          observacao: string | null;
          parcelas: string | null;
          area_m2: number;
          disciplinas: Json;
          status_data: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          cliente_id?: string | null;
          codigo_projeto?: string | null;
          nome: string;
          localizacao?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: Database["public"]["Enums"]["status_projeto"];
          prioridade?: string;
          data_inicio?: string | null;
          data_previsao?: string | null;
          data_final?: string | null;
          valor_contrato?: number | null;
          observacao?: string | null;
          parcelas?: string | null;
          area_m2?: number;
          disciplinas?: Json;
          status_data?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          cliente_id?: string | null;
          codigo_projeto?: string | null;
          nome?: string;
          localizacao?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          status?: Database["public"]["Enums"]["status_projeto"];
          prioridade?: string;
          data_inicio?: string | null;
          data_previsao?: string | null;
          data_final?: string | null;
          valor_contrato?: number | null;
          observacao?: string | null;
          parcelas?: string | null;
          area_m2?: number;
          disciplinas?: Json;
          status_data?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projetos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projetos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      projetos_responsaveis: {
        Row: {
          id: string;
          empresa_id: string;
          projeto_id: string;
          pessoa_id: string;
          disciplina: string;
          responsabilidade: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          projeto_id: string;
          pessoa_id: string;
          disciplina: string;
          responsabilidade?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          projeto_id?: string;
          pessoa_id?: string;
          disciplina?: string;
          responsabilidade?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projetos_responsaveis_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projetos_responsaveis_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      receitas: {
        Row: {
          id: string;
          empresa_id: string;
          descricao: string;
          valor: number;
          data_vencimento: string;
          data_recebimento: string | null;
          status: Database["public"]["Enums"]["status_financeiro"];
          projeto_id: string | null;
          cliente_id: string | null;
          categoria_id: string | null;
          conta_id: string | null;
          nota_fiscal: string | null;
          forma_pagamento: string | null;
          observacao: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id?: string;
          descricao: string;
          valor: number;
          data_vencimento: string;
          data_recebimento?: string | null;
          status?: Database["public"]["Enums"]["status_financeiro"];
          projeto_id?: string | null;
          cliente_id?: string | null;
          categoria_id?: string | null;
          conta_id?: string | null;
          nota_fiscal?: string | null;
          forma_pagamento?: string | null;
          observacao?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          descricao?: string;
          valor?: number;
          data_vencimento?: string;
          data_recebimento?: string | null;
          status?: Database["public"]["Enums"]["status_financeiro"];
          projeto_id?: string | null;
          cliente_id?: string | null;
          categoria_id?: string | null;
          conta_id?: string | null;
          nota_fiscal?: string | null;
          forma_pagamento?: string | null;
          observacao?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receitas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_financeiras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
        ];
      };
      faturas: {
        Row: {
          id: string;
          empresa_id: string;
          cartao_id: string;
          mes_referencia: number;
          ano_referencia: number;
          data_inicio: string;
          data_fim: string;
          data_vencimento: string;
          valor_total: number;
          valor_pago: number;
          status: string;
          conta_pagamento_id: string | null;
          data_pagamento: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          cartao_id: string;
          mes_referencia: number;
          ano_referencia: number;
          data_inicio: string;
          data_fim: string;
          data_vencimento: string;
          valor_total?: number;
          valor_pago?: number;
          status?: string;
          conta_pagamento_id?: string | null;
          data_pagamento?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          cartao_id?: string;
          mes_referencia?: number;
          ano_referencia?: number;
          data_inicio?: string;
          data_fim?: string;
          data_vencimento?: string;
          valor_total?: number;
          valor_pago?: number;
          status?: string;
          conta_pagamento_id?: string | null;
          data_pagamento?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "faturas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "cartoes_credito";
            referencedColumns: ["id"];
          },
        ];
      };
      despesas: {
        Row: {
          id: string;
          empresa_id: string;
          descricao: string;
          valor: number;
          data_vencimento: string;
          data_pagamento: string | null;
          status: Database["public"]["Enums"]["status_financeiro"];
          projeto_id: string | null;
          fornecedor_id: string | null;
          categoria_id: string | null;
          conta_id: string | null;
          cartao_id: string | null;
          fatura_id: string | null;
          nota_fiscal: string | null;
          observacao: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          empresa_id?: string;
          descricao: string;
          valor: number;
          data_vencimento: string;
          data_pagamento?: string | null;
          status?: Database["public"]["Enums"]["status_financeiro"];
          projeto_id?: string | null;
          fornecedor_id?: string | null;
          categoria_id?: string | null;
          conta_id?: string | null;
          cartao_id?: string | null;
          fatura_id?: string | null;
          nota_fiscal?: string | null;
          observacao?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          descricao?: string;
          valor?: number;
          data_vencimento?: string;
          data_pagamento?: string | null;
          status?: Database["public"]["Enums"]["status_financeiro"];
          projeto_id?: string | null;
          fornecedor_id?: string | null;
          categoria_id?: string | null;
          conta_id?: string | null;
          cartao_id?: string | null;
          fatura_id?: string | null;
          nota_fiscal?: string | null;
          observacao?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "despesas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_fornecedor_id_fkey";
            columns: ["fornecedor_id"];
            isOneToOne: false;
            referencedRelation: "fornecedores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_financeiras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "cartoes_credito";
            referencedColumns: ["id"];
          },
        ];
      };
      folha_pagamento: {
        Row: {
          id: string;
          empresa_id: string;
          pessoa_id: string;
          mes: number;
          ano: number;
          salario_fixo: number;
          total_area_projetada: number;
          valor_m2: number;
          adicional_variavel: number;
          total_receber: number;
          status: string;
          data_pagamento: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          pessoa_id: string;
          mes: number;
          ano: number;
          salario_fixo?: number;
          total_area_projetada?: number;
          valor_m2?: number;
          adicional_variavel?: number;
          total_receber?: number;
          status?: string;
          data_pagamento?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          empresa_id?: string;
          pessoa_id?: string;
          mes?: number;
          ano?: number;
          salario_fixo?: number;
          total_area_projetada?: number;
          valor_m2?: number;
          adicional_variavel?: number;
          total_receber?: number;
          status?: string;
          data_pagamento?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      disciplinas: {
        Row: {
          id: string;
          nome: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      metas: {
        Row: {
          id: string;
          nome: string;
          alvo: number;
          atual: number;
          prazo: string | null;
          categoria: string | null;
          tipo: string;
          pessoa_id: string | null;
          projeto_id: string | null;
          empresa_id: string | null;
          descricao: string | null;
          unidade: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          alvo: number;
          atual?: number;
          prazo?: string | null;
          categoria?: string | null;
          tipo?: string;
          pessoa_id?: string | null;
          projeto_id?: string | null;
          empresa_id?: string | null;
          descricao?: string | null;
          unidade?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          alvo?: number;
          atual?: number;
          prazo?: string | null;
          categoria?: string | null;
          tipo?: string;
          pessoa_id?: string | null;
          projeto_id?: string | null;
          empresa_id?: string | null;
          descricao?: string | null;
          unidade?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metas_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      view_financas_resumo: {
        Row: {
          conta_id: string;
          conta_nome: string;
          banco: string;
          cor: string | null;
          empresa_id: string;
          saldo_inicial: number;
          total_entradas: number;
          total_saidas: number;
          saldo_atual: number;
        };
      };
      view_cartao_resumo: {
        Row: {
          id: string;
          nome: string;
          empresa_id: string;
          dia_fechamento: number;
          dia_vencimento: number;
          cor: string | null;
          limite: number;
          conta_pagamento_id: string | null;
          usado: number;
          disponivel: number;
        };
      };
      view_fatura_resumo: {
        Row: {
          id: string;
          empresa_id: string;
          cartao_id: string;
          cartao_nome: string;
          cartao_cor: string | null;
          mes_referencia: number;
          ano_referencia: number;
          data_inicio: string;
          data_fim: string;
          data_vencimento: string;
          status: string;
          data_pagamento: string | null;
          conta_pagamento_id: string | null;
          conta_pagamento_nome: string | null;
          valor_total: number;
          valor_pago: number;
          qtd_despesas: number;
        };
      };
    };
    Functions: {
      get_user_empresa_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      has_role: {
        Args: { required_roles: string[] };
        Returns: boolean;
      };
      gerar_fatura: {
        Args: { p_cartao_id: string; p_mes: number; p_ano: number };
        Returns: string;
      };
      pagar_fatura: {
        Args: {
          p_fatura_id: string;
          p_conta_id: string;
          p_valor_pago?: number | null;
          p_data_pagamento?: string | null;
        };
        Returns: undefined;
      };
    };
    Enums: {
      status_empresa: "active" | "suspended" | "cancelled";
      user_role: "admin" | "financeiro" | "marketing" | "operacional" | "user";
      status_projeto: "Planejamento" | "Em andamento" | "Revisão" | "Paralisado" | "Concluído" | "Cancelado";
      status_financeiro: "Pendente" | "Pago" | "Recebido" | "Atrasado" | "Cancelado";
      tipo_categoria: "Receita" | "Despesa";
      status_lead: "Novo" | "Em contato" | "Proposta" | "Negociação" | "Ganho" | "Perdido";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      status_empresa: ["active", "suspended", "cancelled"],
      user_role: ["admin", "financeiro", "marketing", "operacional", "user"],
      status_projeto: ["Planejamento", "Em andamento", "Revisão", "Paralisado", "Concluído", "Cancelado"],
      status_financeiro: ["Pendente", "Pago", "Recebido", "Atrasado", "Cancelado"],
      tipo_categoria: ["Receita", "Despesa"],
      status_lead: ["Novo", "Em contato", "Proposta", "Negociação", "Ganho", "Perdido"],
    },
  },
} as const;
