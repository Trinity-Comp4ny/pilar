export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string;
          actor_email: string;
          actor_id: string;
          actor_role: string;
          category: string;
          created_at: string;
          empresa_id: string | null;
          id: string;
          ip_address: string | null;
          metadata: Json;
          target_id: string | null;
          target_name: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_email: string;
          actor_id: string;
          actor_role: string;
          category: string;
          created_at?: string;
          empresa_id?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json;
          target_id?: string | null;
          target_name?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string;
          actor_id?: string;
          actor_role?: string;
          category?: string;
          created_at?: string;
          empresa_id?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json;
          target_id?: string | null;
          target_name?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      alertas: {
        Row: {
          created_at: string | null;
          empresa_id: string;
          expires_at: string | null;
          id: string;
          lido: boolean | null;
          lido_em: string | null;
          lido_por: string | null;
          mensagem: string;
          referencia_id: string | null;
          referencia_tipo: string | null;
          severidade: string | null;
          tipo: string;
          titulo: string;
        };
        Insert: {
          created_at?: string | null;
          empresa_id: string;
          expires_at?: string | null;
          id?: string;
          lido?: boolean | null;
          lido_em?: string | null;
          lido_por?: string | null;
          mensagem: string;
          referencia_id?: string | null;
          referencia_tipo?: string | null;
          severidade?: string | null;
          tipo: string;
          titulo: string;
        };
        Update: {
          created_at?: string | null;
          empresa_id?: string;
          expires_at?: string | null;
          id?: string;
          lido?: boolean | null;
          lido_em?: string | null;
          lido_por?: string | null;
          mensagem?: string;
          referencia_id?: string | null;
          referencia_tipo?: string | null;
          severidade?: string | null;
          tipo?: string;
          titulo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alertas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      aprovacoes: {
        Row: {
          aprovador_id: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          empresa_id: string;
          id: string;
          justificativa: string | null;
          referencia_id: string;
          referencia_tipo: string;
          resposta: string | null;
          solicitante_id: string | null;
          status: string;
          tipo: string;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          aprovador_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          empresa_id: string;
          id?: string;
          justificativa?: string | null;
          referencia_id: string;
          referencia_tipo: string;
          resposta?: string | null;
          solicitante_id?: string | null;
          status?: string;
          tipo: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          aprovador_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          empresa_id?: string;
          id?: string;
          justificativa?: string | null;
          referencia_id?: string;
          referencia_tipo?: string;
          resposta?: string | null;
          solicitante_id?: string | null;
          status?: string;
          tipo?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "aprovacoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      asaas_config: {
        Row: {
          ambiente: string;
          api_key: string;
          created_at: string;
          empresa_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          ambiente?: string;
          api_key: string;
          created_at?: string;
          empresa_id: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          ambiente?: string;
          api_key?: string;
          created_at?: string;
          empresa_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asaas_config_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      asaas_webhook_logs: {
        Row: {
          empresa_id: string | null;
          event: string;
          id: string;
          payload: Json | null;
          payment_id: string | null;
          processed_at: string | null;
          receita_id: string | null;
        };
        Insert: {
          empresa_id?: string | null;
          event: string;
          id?: string;
          payload?: Json | null;
          payment_id?: string | null;
          processed_at?: string | null;
          receita_id?: string | null;
        };
        Update: {
          empresa_id?: string | null;
          event?: string;
          id?: string;
          payload?: Json | null;
          payment_id?: string | null;
          processed_at?: string | null;
          receita_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "asaas_webhook_logs_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asaas_webhook_logs_receita_id_fkey";
            columns: ["receita_id"];
            isOneToOne: false;
            referencedRelation: "receitas";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          diff: Json | null;
          empresa_id: string | null;
          id: string;
          metadata: Json;
          target_id: string | null;
          target_table: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          empresa_id?: string | null;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_table?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          empresa_id?: string | null;
          id?: string;
          metadata?: Json;
          target_id?: string | null;
          target_table?: string | null;
        };
        Relationships: [];
      };
      audit_logs_archive: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          archived_at: string;
          created_at: string;
          diff: Json | null;
          empresa_id: string | null;
          id: string;
          ip_address: string | null;
          new_data: Json | null;
          old_data: Json | null;
          target_id: string | null;
          target_table: string;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          archived_at?: string;
          created_at: string;
          diff?: Json | null;
          empresa_id?: string | null;
          id: string;
          ip_address?: string | null;
          new_data?: Json | null;
          old_data?: Json | null;
          target_id?: string | null;
          target_table: string;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          archived_at?: string;
          created_at?: string;
          diff?: Json | null;
          empresa_id?: string | null;
          id?: string;
          ip_address?: string | null;
          new_data?: Json | null;
          old_data?: Json | null;
          target_id?: string | null;
          target_table?: string;
        };
        Relationships: [];
      };
      cartoes: {
        Row: {
          conta_pagamento_id: string | null;
          cor: string | null;
          created_at: string | null;
          deleted_at: string | null;
          dia_fechamento: number | null;
          dia_vencimento: number | null;
          empresa_id: string;
          id: string;
          limite: number;
          nome: string;
          tipo: string;
          updated_at: string | null;
          usado: number | null;
        };
        Insert: {
          conta_pagamento_id?: string | null;
          cor?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          empresa_id: string;
          id?: string;
          limite: number;
          nome: string;
          tipo?: string;
          updated_at?: string | null;
          usado?: number | null;
        };
        Update: {
          conta_pagamento_id?: string | null;
          cor?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          empresa_id?: string;
          id?: string;
          limite?: number;
          nome?: string;
          tipo?: string;
          updated_at?: string | null;
          usado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
          {
            foreignKeyName: "cartoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias_financeiras: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          tipo: Database["public"]["Enums"]["tipo_categoria"];
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          tipo?: Database["public"]["Enums"]["tipo_categoria"];
          updated_at?: string | null;
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
      centros_custo: {
        Row: {
          ativo: boolean;
          codigo: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          descricao: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          ativo?: boolean;
          codigo?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean;
          codigo?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      cliente_portal_accounts: {
        Row: {
          ativo: boolean | null;
          cliente_id: string;
          created_at: string | null;
          created_by: string | null;
          email: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          senha_hash: string | null;
          token_expira_em: string | null;
          token_sessao: string | null;
          ultimo_acesso: string | null;
          updated_at: string | null;
        };
        Insert: {
          ativo?: boolean | null;
          cliente_id: string;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          senha_hash?: string | null;
          token_expira_em?: string | null;
          token_sessao?: string | null;
          ultimo_acesso?: string | null;
          updated_at?: string | null;
        };
        Update: {
          ativo?: boolean | null;
          cliente_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          senha_hash?: string | null;
          token_expira_em?: string | null;
          token_sessao?: string | null;
          ultimo_acesso?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cliente_portal_accounts_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cliente_portal_accounts_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          asaas_customer_id: string | null;
          chaves_pix: Json | null;
          contas_bancarias: Json | null;
          contato: string;
          cpf_cnpj: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          email: string;
          empresa_id: string;
          endereco: string | null;
          id: string;
          nome: string;
          origem: string | null;
          sobrenome: string | null;
          tipo_nf: string | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          asaas_customer_id?: string | null;
          chaves_pix?: Json | null;
          contas_bancarias?: Json | null;
          contato: string;
          cpf_cnpj?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          email: string;
          empresa_id: string;
          endereco?: string | null;
          id?: string;
          nome: string;
          origem?: string | null;
          sobrenome?: string | null;
          tipo_nf?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          asaas_customer_id?: string | null;
          chaves_pix?: Json | null;
          contas_bancarias?: Json | null;
          contato?: string;
          cpf_cnpj?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string;
          empresa_id?: string;
          endereco?: string | null;
          id?: string;
          nome?: string;
          origem?: string | null;
          sobrenome?: string | null;
          tipo_nf?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
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
      contas: {
        Row: {
          banco: string;
          chave_pix: string | null;
          cor: string | null;
          created_at: string | null;
          deleted_at: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          saldo_atual: number | null;
          saldo_inicial: number | null;
          tipo_chave_pix: string | null;
          updated_at: string | null;
        };
        Insert: {
          banco: string;
          chave_pix?: string | null;
          cor?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          saldo_atual?: number | null;
          saldo_inicial?: number | null;
          tipo_chave_pix?: string | null;
          updated_at?: string | null;
        };
        Update: {
          banco?: string;
          chave_pix?: string | null;
          cor?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          saldo_atual?: number | null;
          saldo_inicial?: number | null;
          tipo_chave_pix?: string | null;
          updated_at?: string | null;
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
      convites: {
        Row: {
          cargo: Database["public"]["Enums"]["user_role"];
          created_at: string;
          criado_por: string | null;
          email: string;
          empresa_id: string;
          expira_em: string;
          features: Json;
          id: string;
          nome: string | null;
          token: string;
          usado_em: string | null;
        };
        Insert: {
          cargo?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          criado_por?: string | null;
          email: string;
          empresa_id: string;
          expira_em?: string;
          features?: Json;
          id?: string;
          nome?: string | null;
          token?: string;
          usado_em?: string | null;
        };
        Update: {
          cargo?: Database["public"]["Enums"]["user_role"];
          created_at?: string;
          criado_por?: string | null;
          email?: string;
          empresa_id?: string;
          expira_em?: string;
          features?: Json;
          id?: string;
          nome?: string | null;
          token?: string;
          usado_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      critical_alerts: {
        Row: {
          actor_email: string | null;
          actor_id: string | null;
          alert_type: string;
          created_at: string;
          empresa_id: string | null;
          id: string;
          message: string;
          metadata: Json | null;
          notified: boolean | null;
          severity: string;
          target_id: string | null;
          target_table: string | null;
        };
        Insert: {
          actor_email?: string | null;
          actor_id?: string | null;
          alert_type: string;
          created_at?: string;
          empresa_id?: string | null;
          id?: string;
          message: string;
          metadata?: Json | null;
          notified?: boolean | null;
          severity: string;
          target_id?: string | null;
          target_table?: string | null;
        };
        Update: {
          actor_email?: string | null;
          actor_id?: string | null;
          alert_type?: string;
          created_at?: string;
          empresa_id?: string | null;
          id?: string;
          message?: string;
          metadata?: Json | null;
          notified?: boolean | null;
          severity?: string;
          target_id?: string | null;
          target_table?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "critical_alerts_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      data_deletion_requests: {
        Row: {
          empresa_id: string | null;
          id: string;
          motivo: string | null;
          notes: string | null;
          notified_at: string | null;
          processed_at: string | null;
          processed_by: string | null;
          requested_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          empresa_id?: string | null;
          id?: string;
          motivo?: string | null;
          notes?: string | null;
          notified_at?: string | null;
          processed_at?: string | null;
          processed_by?: string | null;
          requested_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          empresa_id?: string | null;
          id?: string;
          motivo?: string | null;
          notes?: string | null;
          notified_at?: string | null;
          processed_at?: string | null;
          processed_by?: string | null;
          requested_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "data_deletion_requests_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      data_export_requests: {
        Row: {
          completed_at: string | null;
          created_at: string;
          download_url: string | null;
          empresa_id: string | null;
          expires_at: string | null;
          id: string;
          requested_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          download_url?: string | null;
          empresa_id?: string | null;
          expires_at?: string | null;
          id?: string;
          requested_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          download_url?: string | null;
          empresa_id?: string | null;
          expires_at?: string | null;
          id?: string;
          requested_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "data_export_requests_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      despesas: {
        Row: {
          cartao_id: string | null;
          categoria_id: string | null;
          centro_custo_id: string | null;
          conta_id: string | null;
          created_at: string | null;
          created_by: string | null;
          data_competencia: string | null;
          data_pagamento: string | null;
          data_vencimento: string | null;
          deleted_at: string | null;
          descricao: string;
          despesa_pai_id: string | null;
          empresa_id: string;
          fatura_id: string | null;
          forma_pagamento: string | null;
          fornecedor_id: string | null;
          grupo_parcela: string | null;
          id: string;
          is_fatura_payment: boolean;
          nota_fiscal: string | null;
          observacao: string | null;
          parcela_numero: number | null;
          parcela_total: number | null;
          periodicidade: string | null;
          projeto_id: string | null;
          recorrente: boolean | null;
          status: Database["public"]["Enums"]["status_financeiro"] | null;
          tags: string[] | null;
          updated_at: string | null;
          updated_by: string | null;
          valor: number;
        };
        Insert: {
          cartao_id?: string | null;
          categoria_id?: string | null;
          centro_custo_id?: string | null;
          conta_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_competencia?: string | null;
          data_pagamento?: string | null;
          data_vencimento?: string | null;
          deleted_at?: string | null;
          descricao: string;
          despesa_pai_id?: string | null;
          empresa_id: string;
          fatura_id?: string | null;
          forma_pagamento?: string | null;
          fornecedor_id?: string | null;
          grupo_parcela?: string | null;
          id?: string;
          is_fatura_payment?: boolean;
          nota_fiscal?: string | null;
          observacao?: string | null;
          parcela_numero?: number | null;
          parcela_total?: number | null;
          periodicidade?: string | null;
          projeto_id?: string | null;
          recorrente?: boolean | null;
          status?: Database["public"]["Enums"]["status_financeiro"] | null;
          tags?: string[] | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor: number;
        };
        Update: {
          cartao_id?: string | null;
          categoria_id?: string | null;
          centro_custo_id?: string | null;
          conta_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_competencia?: string | null;
          data_pagamento?: string | null;
          data_vencimento?: string | null;
          deleted_at?: string | null;
          descricao?: string;
          despesa_pai_id?: string | null;
          empresa_id?: string;
          fatura_id?: string | null;
          forma_pagamento?: string | null;
          fornecedor_id?: string | null;
          grupo_parcela?: string | null;
          id?: string;
          is_fatura_payment?: boolean;
          nota_fiscal?: string | null;
          observacao?: string | null;
          parcela_numero?: number | null;
          parcela_total?: number | null;
          periodicidade?: string | null;
          projeto_id?: string | null;
          recorrente?: boolean | null;
          status?: Database["public"]["Enums"]["status_financeiro"] | null;
          tags?: string[] | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "despesas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "cartoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "view_cartao_resumo";
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
            foreignKeyName: "despesas_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
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
            foreignKeyName: "despesas_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
          {
            foreignKeyName: "despesas_despesa_pai_id_fkey";
            columns: ["despesa_pai_id"];
            isOneToOne: false;
            referencedRelation: "despesas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "despesas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
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
            foreignKeyName: "despesas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      disciplinas: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
        };
        Relationships: [];
      };
      empresa_owners_pending: {
        Row: {
          company_name: string;
          created_at: string;
          criado_por: string | null;
          email: string;
          expira_em: string;
          id: string;
          nome: string | null;
          token: string;
          usado_em: string | null;
        };
        Insert: {
          company_name: string;
          created_at?: string;
          criado_por?: string | null;
          email: string;
          expira_em?: string;
          id?: string;
          nome?: string | null;
          token?: string;
          usado_em?: string | null;
        };
        Update: {
          company_name?: string;
          created_at?: string;
          criado_por?: string | null;
          email?: string;
          expira_em?: string;
          id?: string;
          nome?: string | null;
          token?: string;
          usado_em?: string | null;
        };
        Relationships: [];
      };
      empresas: {
        Row: {
          cep: string | null;
          cidade: string | null;
          cnpj: string | null;
          contato: string | null;
          created_at: string | null;
          created_by: string | null;
          email: string | null;
          endereco: string | null;
          estado: string | null;
          features: Json;
          id: string;
          logo_url: string | null;
          nome: string;
          onboarding_completed: boolean | null;
          owner_id: string | null;
          pix_chave: string | null;
          pix_instrucoes: string | null;
          status: Database["public"]["Enums"]["status_empresa"] | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          cep?: string | null;
          cidade?: string | null;
          cnpj?: string | null;
          contato?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          endereco?: string | null;
          estado?: string | null;
          features?: Json;
          id?: string;
          logo_url?: string | null;
          nome: string;
          onboarding_completed?: boolean | null;
          owner_id?: string | null;
          pix_chave?: string | null;
          pix_instrucoes?: string | null;
          status?: Database["public"]["Enums"]["status_empresa"] | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          cep?: string | null;
          cidade?: string | null;
          cnpj?: string | null;
          contato?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string | null;
          endereco?: string | null;
          estado?: string | null;
          features?: Json;
          id?: string;
          logo_url?: string | null;
          nome?: string;
          onboarding_completed?: boolean | null;
          owner_id?: string | null;
          pix_chave?: string | null;
          pix_instrucoes?: string | null;
          status?: Database["public"]["Enums"]["status_empresa"] | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      escopo_historico: {
        Row: {
          acao: string;
          created_at: string | null;
          detalhes: Json | null;
          escopo_id: string;
          id: string;
          usuario_id: string | null;
          usuario_nome: string | null;
        };
        Insert: {
          acao: string;
          created_at?: string | null;
          detalhes?: Json | null;
          escopo_id: string;
          id?: string;
          usuario_id?: string | null;
          usuario_nome?: string | null;
        };
        Update: {
          acao?: string;
          created_at?: string | null;
          detalhes?: Json | null;
          escopo_id?: string;
          id?: string;
          usuario_id?: string | null;
          usuario_nome?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "escopo_historico_escopo_id_fkey";
            columns: ["escopo_id"];
            isOneToOne: false;
            referencedRelation: "escopos";
            referencedColumns: ["id"];
          },
        ];
      };
      escopo_itens: {
        Row: {
          created_at: string | null;
          custo: number | null;
          descricao: string;
          disciplina: string | null;
          escopo_id: string;
          horas: number | null;
          id: string;
        };
        Insert: {
          created_at?: string | null;
          custo?: number | null;
          descricao: string;
          disciplina?: string | null;
          escopo_id: string;
          horas?: number | null;
          id?: string;
        };
        Update: {
          created_at?: string | null;
          custo?: number | null;
          descricao?: string;
          disciplina?: string | null;
          escopo_id?: string;
          horas?: number | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "escopo_itens_escopo_id_fkey";
            columns: ["escopo_id"];
            isOneToOne: false;
            referencedRelation: "escopos";
            referencedColumns: ["id"];
          },
        ];
      };
      escopos: {
        Row: {
          aprovado_em: string | null;
          aprovado_por: string | null;
          created_at: string | null;
          created_by: string | null;
          custo_estimado: number | null;
          deleted_at: string | null;
          descricao: string;
          empresa_id: string;
          horas_estimadas: number | null;
          id: string;
          impacto_prazo_dias: number | null;
          justificativa: string | null;
          projeto_id: string;
          status: string | null;
          tipo: string;
          updated_at: string | null;
          updated_by: string | null;
          valor_aditivo: number | null;
        };
        Insert: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custo_estimado?: number | null;
          deleted_at?: string | null;
          descricao: string;
          empresa_id: string;
          horas_estimadas?: number | null;
          id?: string;
          impacto_prazo_dias?: number | null;
          justificativa?: string | null;
          projeto_id: string;
          status?: string | null;
          tipo: string;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_aditivo?: number | null;
        };
        Update: {
          aprovado_em?: string | null;
          aprovado_por?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custo_estimado?: number | null;
          deleted_at?: string | null;
          descricao?: string;
          empresa_id?: string;
          horas_estimadas?: number | null;
          id?: string;
          impacto_prazo_dias?: number | null;
          justificativa?: string | null;
          projeto_id?: string;
          status?: string | null;
          tipo?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_aditivo?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "escopos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "escopos_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      faturas: {
        Row: {
          ano_referencia: number;
          cartao_id: string;
          conta_pagamento_id: string | null;
          created_at: string | null;
          created_by: string | null;
          data_fim: string;
          data_inicio: string;
          data_pagamento: string | null;
          data_vencimento: string;
          deleted_at: string | null;
          empresa_id: string;
          id: string;
          idempotency_key: string | null;
          mes_referencia: number;
          status: string;
          updated_at: string | null;
          updated_by: string | null;
          valor_pago: number;
          valor_total: number;
        };
        Insert: {
          ano_referencia: number;
          cartao_id: string;
          conta_pagamento_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_fim: string;
          data_inicio: string;
          data_pagamento?: string | null;
          data_vencimento: string;
          deleted_at?: string | null;
          empresa_id: string;
          id?: string;
          idempotency_key?: string | null;
          mes_referencia: number;
          status?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_pago?: number;
          valor_total?: number;
        };
        Update: {
          ano_referencia?: number;
          cartao_id?: string;
          conta_pagamento_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_fim?: string;
          data_inicio?: string;
          data_pagamento?: string | null;
          data_vencimento?: string;
          deleted_at?: string | null;
          empresa_id?: string;
          id?: string;
          idempotency_key?: string | null;
          mes_referencia?: number;
          status?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_pago?: number;
          valor_total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "faturas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "cartoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "view_cartao_resumo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
          {
            foreignKeyName: "faturas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          description: string | null;
          enabled_for_all: boolean;
          enabled_for_empresas: string[];
          key: string;
          percentage: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          enabled_for_all?: boolean;
          enabled_for_empresas?: string[];
          key: string;
          percentage?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          enabled_for_all?: boolean;
          enabled_for_empresas?: string[];
          key?: string;
          percentage?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      fluxos_disciplinas: {
        Row: {
          ativo: boolean | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          descricao: string | null;
          empresa_id: string;
          etapas: Json;
          id: string;
          nome: string;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          ativo?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id: string;
          etapas?: Json;
          id?: string;
          nome: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id?: string;
          etapas?: Json;
          id?: string;
          nome?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fluxos_disciplinas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      folha_pagamento: {
        Row: {
          adicional_variavel: number | null;
          ano: number;
          created_at: string;
          data_pagamento: string | null;
          empresa_id: string;
          id: string;
          mes: number;
          pessoa_id: string;
          salario_fixo: number | null;
          status: string | null;
          total_area_projetada: number | null;
          total_receber: number | null;
          updated_at: string;
          valor_m2: number | null;
        };
        Insert: {
          adicional_variavel?: number | null;
          ano: number;
          created_at?: string;
          data_pagamento?: string | null;
          empresa_id: string;
          id?: string;
          mes: number;
          pessoa_id: string;
          salario_fixo?: number | null;
          status?: string | null;
          total_area_projetada?: number | null;
          total_receber?: number | null;
          updated_at?: string;
          valor_m2?: number | null;
        };
        Update: {
          adicional_variavel?: number | null;
          ano?: number;
          created_at?: string;
          data_pagamento?: string | null;
          empresa_id?: string;
          id?: string;
          mes?: number;
          pessoa_id?: string;
          salario_fixo?: number | null;
          status?: string | null;
          total_area_projetada?: number | null;
          total_receber?: number | null;
          updated_at?: string;
          valor_m2?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folha_pagamento_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "view_folha_pagamento";
            referencedColumns: ["pessoa_id"];
          },
        ];
      };
      fornecedores: {
        Row: {
          cnpj: string | null;
          contato: string | null;
          created_at: string | null;
          deleted_at: string | null;
          email: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          updated_at: string | null;
        };
        Insert: {
          cnpj?: string | null;
          contato?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          updated_at?: string | null;
        };
        Update: {
          cnpj?: string | null;
          contato?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          updated_at?: string | null;
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
      grupos_parcela: {
        Row: {
          categoria_id: string | null;
          centro_custo_id: string | null;
          contraparte_id: string | null;
          contraparte_tipo: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          descricao: string | null;
          dia_vencimento: number | null;
          empresa_id: string;
          id: string;
          num_parcelas: number | null;
          observacao: string | null;
          periodicidade: string | null;
          projeto_id: string | null;
          renegociado_de: string | null;
          status_agregado: string;
          tipo_grupo: string;
          tipo_lancamento: string;
          total_original: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          categoria_id?: string | null;
          centro_custo_id?: string | null;
          contraparte_id?: string | null;
          contraparte_tipo?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          dia_vencimento?: number | null;
          empresa_id: string;
          id?: string;
          num_parcelas?: number | null;
          observacao?: string | null;
          periodicidade?: string | null;
          projeto_id?: string | null;
          renegociado_de?: string | null;
          status_agregado?: string;
          tipo_grupo?: string;
          tipo_lancamento: string;
          total_original?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          categoria_id?: string | null;
          centro_custo_id?: string | null;
          contraparte_id?: string | null;
          contraparte_tipo?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          dia_vencimento?: number | null;
          empresa_id?: string;
          id?: string;
          num_parcelas?: number | null;
          observacao?: string | null;
          periodicidade?: string | null;
          projeto_id?: string | null;
          renegociado_de?: string | null;
          status_agregado?: string;
          tipo_grupo?: string;
          tipo_lancamento?: string;
          total_original?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "grupos_parcela_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_financeiras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grupos_parcela_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grupos_parcela_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grupos_parcela_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grupos_parcela_renegociado_de_fkey";
            columns: ["renegociado_de"];
            isOneToOne: false;
            referencedRelation: "grupos_parcela";
            referencedColumns: ["id"];
          },
        ];
      };
      impersonation_sessions: {
        Row: {
          admin_id: string;
          admin_role: string;
          ended_at: string | null;
          expires_at: string;
          id: string;
          ip_address: string | null;
          started_at: string;
          target_role: string;
          user_agent: string | null;
        };
        Insert: {
          admin_id: string;
          admin_role: string;
          ended_at?: string | null;
          expires_at?: string;
          id?: string;
          ip_address?: string | null;
          started_at?: string;
          target_role: string;
          user_agent?: string | null;
        };
        Update: {
          admin_id?: string;
          admin_role?: string;
          ended_at?: string | null;
          expires_at?: string;
          id?: string;
          ip_address?: string | null;
          started_at?: string;
          target_role?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      lancamento_rateios: {
        Row: {
          centro_custo_id: string;
          created_at: string;
          created_by: string | null;
          empresa_id: string;
          id: string;
          lancamento_id: string;
          observacao: string | null;
          percentual: number;
          tipo_lancamento: string;
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          centro_custo_id: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id: string;
          id?: string;
          lancamento_id: string;
          observacao?: string | null;
          percentual: number;
          tipo_lancamento: string;
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          centro_custo_id?: string;
          created_at?: string;
          created_by?: string | null;
          empresa_id?: string;
          id?: string;
          lancamento_id?: string;
          observacao?: string | null;
          percentual?: number;
          tipo_lancamento?: string;
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "lancamento_rateios_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamento_rateios_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          cliente_id: string | null;
          contato: string | null;
          convertido_em: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          email: string | null;
          empresa_id: string;
          empresa_lead: string | null;
          id: string;
          motivo_perda: string | null;
          nome: string;
          notas: string | null;
          origem: string | null;
          previsao_fechamento: string | null;
          responsavel_id: string | null;
          sobrenome: string | null;
          status: string | null;
          updated_at: string | null;
          valor_estimado: number | null;
        };
        Insert: {
          cliente_id?: string | null;
          contato?: string | null;
          convertido_em?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          empresa_id: string;
          empresa_lead?: string | null;
          id?: string;
          motivo_perda?: string | null;
          nome: string;
          notas?: string | null;
          origem?: string | null;
          previsao_fechamento?: string | null;
          responsavel_id?: string | null;
          sobrenome?: string | null;
          status?: string | null;
          updated_at?: string | null;
          valor_estimado?: number | null;
        };
        Update: {
          cliente_id?: string | null;
          contato?: string | null;
          convertido_em?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          empresa_id?: string;
          empresa_lead?: string | null;
          id?: string;
          motivo_perda?: string | null;
          nome?: string;
          notas?: string | null;
          origem?: string | null;
          previsao_fechamento?: string | null;
          responsavel_id?: string | null;
          sobrenome?: string | null;
          status?: string | null;
          updated_at?: string | null;
          valor_estimado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      marcos_faturamento: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          data_faturada: string | null;
          data_prevista: string | null;
          deleted_at: string | null;
          disciplina: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          percentual: number | null;
          projeto_id: string;
          receita_id: string | null;
          status: string | null;
          updated_at: string | null;
          updated_by: string | null;
          valor: number;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          data_faturada?: string | null;
          data_prevista?: string | null;
          deleted_at?: string | null;
          disciplina?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          percentual?: number | null;
          projeto_id: string;
          receita_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor: number;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          data_faturada?: string | null;
          data_prevista?: string | null;
          deleted_at?: string | null;
          disciplina?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          percentual?: number | null;
          projeto_id?: string;
          receita_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marcos_faturamento_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marcos_faturamento_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marcos_faturamento_receita_id_fkey";
            columns: ["receita_id"];
            isOneToOne: false;
            referencedRelation: "receitas";
            referencedColumns: ["id"];
          },
        ];
      };
      metas: {
        Row: {
          alvo: number;
          atual: number;
          auto_sync: boolean | null;
          categoria: string | null;
          created_at: string;
          deleted_at: string | null;
          descricao: string | null;
          empresa_id: string | null;
          id: string;
          nome: string;
          pessoa_id: string | null;
          prazo: string | null;
          projeto_id: string | null;
          sync_filtro: Json | null;
          sync_fonte: string | null;
          tipo: string;
          unidade: string;
        };
        Insert: {
          alvo: number;
          atual?: number;
          auto_sync?: boolean | null;
          categoria?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id?: string | null;
          id?: string;
          nome: string;
          pessoa_id?: string | null;
          prazo?: string | null;
          projeto_id?: string | null;
          sync_filtro?: Json | null;
          sync_fonte?: string | null;
          tipo?: string;
          unidade?: string;
        };
        Update: {
          alvo?: number;
          atual?: number;
          auto_sync?: boolean | null;
          categoria?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id?: string | null;
          id?: string;
          nome?: string;
          pessoa_id?: string | null;
          prazo?: string | null;
          projeto_id?: string | null;
          sync_filtro?: Json | null;
          sync_fonte?: string | null;
          tipo?: string;
          unidade?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metas_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metas_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "view_folha_pagamento";
            referencedColumns: ["pessoa_id"];
          },
          {
            foreignKeyName: "metas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      mfa_backup_codes: {
        Row: {
          code_hash: string;
          created_at: string;
          id: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          code_hash: string;
          created_at?: string;
          id?: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          id?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      orcamento_versoes: {
        Row: {
          created_at: string | null;
          criado_por: string | null;
          dados: Json;
          empresa_id: string;
          id: string;
          motivo: string | null;
          projeto_id: string;
          versao: number;
        };
        Insert: {
          created_at?: string | null;
          criado_por?: string | null;
          dados: Json;
          empresa_id: string;
          id?: string;
          motivo?: string | null;
          projeto_id: string;
          versao?: number;
        };
        Update: {
          created_at?: string | null;
          criado_por?: string | null;
          dados?: Json;
          empresa_id?: string;
          id?: string;
          motivo?: string | null;
          projeto_id?: string;
          versao?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orcamento_versoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orcamento_versoes_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      pessoas: {
        Row: {
          cargo: string | null;
          chaves_pix: Json | null;
          cnpj: string | null;
          contas_bancarias: Json | null;
          cpf: string | null;
          created_at: string | null;
          created_by: string | null;
          data_admissao: string | null;
          data_demissao: string | null;
          data_nascimento: string | null;
          deleted_at: string | null;
          email: string;
          empresa_id: string;
          endereco: string | null;
          horas_semanais: number | null;
          id: string;
          nome: string;
          pis_nit: string | null;
          primeiro_nome: string;
          profile_id: string | null;
          razao_social: string | null;
          rg: string | null;
          salario_fixo: number | null;
          sobrenome: string;
          status: string;
          telefone: string | null;
          tipo_contrato: string | null;
          updated_at: string | null;
          updated_by: string | null;
          valor_m2: number | null;
        };
        Insert: {
          cargo?: string | null;
          chaves_pix?: Json | null;
          cnpj?: string | null;
          contas_bancarias?: Json | null;
          cpf?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_admissao?: string | null;
          data_demissao?: string | null;
          data_nascimento?: string | null;
          deleted_at?: string | null;
          email: string;
          empresa_id: string;
          endereco?: string | null;
          horas_semanais?: number | null;
          id?: string;
          nome: string;
          pis_nit?: string | null;
          primeiro_nome: string;
          profile_id?: string | null;
          razao_social?: string | null;
          rg?: string | null;
          salario_fixo?: number | null;
          sobrenome: string;
          status?: string;
          telefone?: string | null;
          tipo_contrato?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_m2?: number | null;
        };
        Update: {
          cargo?: string | null;
          chaves_pix?: Json | null;
          cnpj?: string | null;
          contas_bancarias?: Json | null;
          cpf?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_admissao?: string | null;
          data_demissao?: string | null;
          data_nascimento?: string | null;
          deleted_at?: string | null;
          email?: string;
          empresa_id?: string;
          endereco?: string | null;
          horas_semanais?: number | null;
          id?: string;
          nome?: string;
          pis_nit?: string | null;
          primeiro_nome?: string;
          profile_id?: string | null;
          razao_social?: string | null;
          rg?: string | null;
          salario_fixo?: number | null;
          sobrenome?: string;
          status?: string;
          telefone?: string | null;
          tipo_contrato?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_m2?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "pessoas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pessoas_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pilar_checkout_webhook_logs: {
        Row: {
          asaas_payment_id: string | null;
          asaas_subscription_id: string | null;
          created_at: string;
          error: string | null;
          event: string;
          id: string;
          payload: Json | null;
          pending_signup_id: string | null;
          processed: boolean;
          subscription_id: string | null;
        };
        Insert: {
          asaas_payment_id?: string | null;
          asaas_subscription_id?: string | null;
          created_at?: string;
          error?: string | null;
          event: string;
          id?: string;
          payload?: Json | null;
          pending_signup_id?: string | null;
          processed?: boolean;
          subscription_id?: string | null;
        };
        Update: {
          asaas_payment_id?: string | null;
          asaas_subscription_id?: string | null;
          created_at?: string;
          error?: string | null;
          event?: string;
          id?: string;
          payload?: Json | null;
          pending_signup_id?: string | null;
          processed?: boolean;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pilar_checkout_webhook_logs_pending_signup_id_fkey";
            columns: ["pending_signup_id"];
            isOneToOne: false;
            referencedRelation: "pilar_pending_signups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilar_checkout_webhook_logs_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "pilar_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      pilar_pending_signups: {
        Row: {
          activated_at: string | null;
          asaas_customer_id: string | null;
          asaas_payment_id: string | null;
          asaas_subscription_id: string | null;
          billing_cycle: string;
          billing_type: string;
          checkout_session_token: string;
          company_name: string;
          cpf_cnpj: string;
          created_at: string;
          email: string;
          empresa_owner_pending_id: string | null;
          id: string;
          invite_dispatched_at: string | null;
          nome: string;
          paid_at: string | null;
          payment_metadata: Json | null;
          payment_status: string;
          plan_id: string;
          telefone: string | null;
          updated_at: string;
        };
        Insert: {
          activated_at?: string | null;
          asaas_customer_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_subscription_id?: string | null;
          billing_cycle?: string;
          billing_type: string;
          checkout_session_token?: string;
          company_name: string;
          cpf_cnpj: string;
          created_at?: string;
          email: string;
          empresa_owner_pending_id?: string | null;
          id?: string;
          invite_dispatched_at?: string | null;
          nome: string;
          paid_at?: string | null;
          payment_metadata?: Json | null;
          payment_status?: string;
          plan_id: string;
          telefone?: string | null;
          updated_at?: string;
        };
        Update: {
          activated_at?: string | null;
          asaas_customer_id?: string | null;
          asaas_payment_id?: string | null;
          asaas_subscription_id?: string | null;
          billing_cycle?: string;
          billing_type?: string;
          checkout_session_token?: string;
          company_name?: string;
          cpf_cnpj?: string;
          created_at?: string;
          email?: string;
          empresa_owner_pending_id?: string | null;
          id?: string;
          invite_dispatched_at?: string | null;
          nome?: string;
          paid_at?: string | null;
          payment_metadata?: Json | null;
          payment_status?: string;
          plan_id?: string;
          telefone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pilar_pending_signups_empresa_owner_pending_id_fkey";
            columns: ["empresa_owner_pending_id"];
            isOneToOne: false;
            referencedRelation: "empresa_owners_pending";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilar_pending_signups_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "pilar_subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      pilar_subscription_plans: {
        Row: {
          ativo: boolean;
          created_at: string;
          descricao: string | null;
          destaque: boolean;
          features: Json;
          id: string;
          max_projetos: number | null;
          max_usuarios: number | null;
          nome: string;
          ordem: number;
          preco_anual: number | null;
          preco_mensal: number;
          slug: string;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          destaque?: boolean;
          features?: Json;
          id?: string;
          max_projetos?: number | null;
          max_usuarios?: number | null;
          nome: string;
          ordem?: number;
          preco_anual?: number | null;
          preco_mensal: number;
          slug: string;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          descricao?: string | null;
          destaque?: boolean;
          features?: Json;
          id?: string;
          max_projetos?: number | null;
          max_usuarios?: number | null;
          nome?: string;
          ordem?: number;
          preco_anual?: number | null;
          preco_mensal?: number;
          slug?: string;
        };
        Relationships: [];
      };
      pilar_subscriptions: {
        Row: {
          asaas_customer_id: string | null;
          asaas_subscription_id: string | null;
          billing_cycle: string | null;
          billing_type: string | null;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          empresa_id: string;
          id: string;
          pending_signup_id: string | null;
          plan_id: string;
          status: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          billing_cycle?: string | null;
          billing_type?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          empresa_id: string;
          id?: string;
          pending_signup_id?: string | null;
          plan_id: string;
          status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          asaas_customer_id?: string | null;
          asaas_subscription_id?: string | null;
          billing_cycle?: string | null;
          billing_type?: string | null;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          empresa_id?: string;
          id?: string;
          pending_signup_id?: string | null;
          plan_id?: string;
          status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pilar_subscriptions_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: true;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilar_subscriptions_pending_signup_id_fkey";
            columns: ["pending_signup_id"];
            isOneToOne: false;
            referencedRelation: "pilar_pending_signups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pilar_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "pilar_subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_download_logs: {
        Row: {
          arquivo_path: string | null;
          cliente_id: string | null;
          created_at: string;
          empresa_id: string;
          entrega_id: string | null;
          id: string;
          ip: string | null;
          user_agent: string | null;
        };
        Insert: {
          arquivo_path?: string | null;
          cliente_id?: string | null;
          created_at?: string;
          empresa_id: string;
          entrega_id?: string | null;
          id?: string;
          ip?: string | null;
          user_agent?: string | null;
        };
        Update: {
          arquivo_path?: string | null;
          cliente_id?: string | null;
          created_at?: string;
          empresa_id?: string;
          entrega_id?: string | null;
          id?: string;
          ip?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portal_download_logs_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_download_logs_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_entregas: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          descricao: string | null;
          drive_url: string | null;
          empresa_id: string;
          id: string;
          projeto_id: string;
          respondido_em: string | null;
          resposta_cliente: string | null;
          status: string | null;
          tipo: string | null;
          titulo: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          descricao?: string | null;
          drive_url?: string | null;
          empresa_id: string;
          id?: string;
          projeto_id: string;
          respondido_em?: string | null;
          resposta_cliente?: string | null;
          status?: string | null;
          tipo?: string | null;
          titulo: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          descricao?: string | null;
          drive_url?: string | null;
          empresa_id?: string;
          id?: string;
          projeto_id?: string;
          respondido_em?: string | null;
          resposta_cliente?: string | null;
          status?: string | null;
          tipo?: string | null;
          titulo?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portal_entregas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_entregas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          contato: string | null;
          created_at: string | null;
          created_by: string | null;
          email: string;
          empresa_id: string;
          features: Json;
          first_name: string;
          id: string;
          last_name: string;
          nome: string | null;
          onboarding_completed: boolean | null;
          role: Database["public"]["Enums"]["user_role"] | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          contato?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email: string;
          empresa_id: string;
          features?: Json;
          first_name?: string;
          id: string;
          last_name?: string;
          nome?: string | null;
          onboarding_completed?: boolean | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          contato?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string;
          empresa_id?: string;
          features?: Json;
          first_name?: string;
          id?: string;
          last_name?: string;
          nome?: string | null;
          onboarding_completed?: boolean | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
          updated_at?: string | null;
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
      projeto_disciplina_responsaveis: {
        Row: {
          id: string;
          pessoa_id: string;
          projeto_disciplina_id: string;
        };
        Insert: {
          id?: string;
          pessoa_id: string;
          projeto_disciplina_id: string;
        };
        Update: {
          id?: string;
          pessoa_id?: string;
          projeto_disciplina_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projeto_disciplina_responsaveis_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projeto_disciplina_responsaveis_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "view_folha_pagamento";
            referencedColumns: ["pessoa_id"];
          },
          {
            foreignKeyName: "projeto_disciplina_responsaveis_projeto_disciplina_id_fkey";
            columns: ["projeto_disciplina_id"];
            isOneToOne: false;
            referencedRelation: "projeto_disciplinas";
            referencedColumns: ["id"];
          },
        ];
      };
      projeto_disciplinas: {
        Row: {
          created_at: string | null;
          custo_hora: number | null;
          data_fim: string | null;
          data_fim_real: string | null;
          data_inicio: string | null;
          horas_estimadas: number | null;
          id: string;
          justificativa_atraso: string | null;
          nome: string;
          observacoes: string | null;
          ordem_etapa: number | null;
          prioridade: string | null;
          projeto_id: string;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          custo_hora?: number | null;
          data_fim?: string | null;
          data_fim_real?: string | null;
          data_inicio?: string | null;
          horas_estimadas?: number | null;
          id?: string;
          justificativa_atraso?: string | null;
          nome: string;
          observacoes?: string | null;
          ordem_etapa?: number | null;
          prioridade?: string | null;
          projeto_id: string;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          custo_hora?: number | null;
          data_fim?: string | null;
          data_fim_real?: string | null;
          data_inicio?: string | null;
          horas_estimadas?: number | null;
          id?: string;
          justificativa_atraso?: string | null;
          nome?: string;
          observacoes?: string | null;
          ordem_etapa?: number | null;
          prioridade?: string | null;
          projeto_id?: string;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projeto_disciplinas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      projeto_orcamento_fases: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          custo_estimado: number | null;
          custo_hora: number | null;
          deleted_at: string | null;
          disciplina: string;
          empresa_id: string;
          horas_estimadas: number | null;
          id: string;
          margem_alvo_pct: number | null;
          observacao: string | null;
          projeto_id: string;
          updated_at: string | null;
          updated_by: string | null;
          valor_venda: number | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          custo_estimado?: number | null;
          custo_hora?: number | null;
          deleted_at?: string | null;
          disciplina: string;
          empresa_id: string;
          horas_estimadas?: number | null;
          id?: string;
          margem_alvo_pct?: number | null;
          observacao?: string | null;
          projeto_id: string;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_venda?: number | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          custo_estimado?: number | null;
          custo_hora?: number | null;
          deleted_at?: string | null;
          disciplina?: string;
          empresa_id?: string;
          horas_estimadas?: number | null;
          id?: string;
          margem_alvo_pct?: number | null;
          observacao?: string | null;
          projeto_id?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_venda?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "projeto_orcamento_fases_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projeto_orcamento_fases_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      projetos: {
        Row: {
          area_m2: number | null;
          cliente_id: string | null;
          codigo_projeto: string | null;
          created_at: string | null;
          created_by: string | null;
          custo_indireto_pct: number | null;
          data_final: string | null;
          data_inicio: string | null;
          data_previsao: string | null;
          deleted_at: string | null;
          disciplinas: Json | null;
          empresa_id: string;
          id: string;
          latitude: number | null;
          localizacao: string | null;
          longitude: number | null;
          nome: string;
          observacao: string | null;
          parcelas: string | null;
          prioridade: string;
          status: Database["public"]["Enums"]["status_projeto"] | null;
          status_data: string | null;
          updated_at: string | null;
          updated_by: string | null;
          valor_contrato: number | null;
        };
        Insert: {
          area_m2?: number | null;
          cliente_id?: string | null;
          codigo_projeto?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custo_indireto_pct?: number | null;
          data_final?: string | null;
          data_inicio?: string | null;
          data_previsao?: string | null;
          deleted_at?: string | null;
          disciplinas?: Json | null;
          empresa_id: string;
          id?: string;
          latitude?: number | null;
          localizacao?: string | null;
          longitude?: number | null;
          nome: string;
          observacao?: string | null;
          parcelas?: string | null;
          prioridade?: string;
          status?: Database["public"]["Enums"]["status_projeto"] | null;
          status_data?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_contrato?: number | null;
        };
        Update: {
          area_m2?: number | null;
          cliente_id?: string | null;
          codigo_projeto?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          custo_indireto_pct?: number | null;
          data_final?: string | null;
          data_inicio?: string | null;
          data_previsao?: string | null;
          deleted_at?: string | null;
          disciplinas?: Json | null;
          empresa_id?: string;
          id?: string;
          latitude?: number | null;
          localizacao?: string | null;
          longitude?: number | null;
          nome?: string;
          observacao?: string | null;
          parcelas?: string | null;
          prioridade?: string;
          status?: Database["public"]["Enums"]["status_projeto"] | null;
          status_data?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor_contrato?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      proposta_disciplinas: {
        Row: {
          created_at: string | null;
          custo_hora: number | null;
          disciplina: string;
          empresa_id: string;
          horas_estimadas: number | null;
          id: string;
          proposta_id: string;
          valor_venda: number | null;
        };
        Insert: {
          created_at?: string | null;
          custo_hora?: number | null;
          disciplina: string;
          empresa_id: string;
          horas_estimadas?: number | null;
          id?: string;
          proposta_id: string;
          valor_venda?: number | null;
        };
        Update: {
          created_at?: string | null;
          custo_hora?: number | null;
          disciplina?: string;
          empresa_id?: string;
          horas_estimadas?: number | null;
          id?: string;
          proposta_id?: string;
          valor_venda?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "proposta_disciplinas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposta_disciplinas_proposta_id_fkey";
            columns: ["proposta_id"];
            isOneToOne: false;
            referencedRelation: "propostas";
            referencedColumns: ["id"];
          },
        ];
      };
      proposta_templates: {
        Row: {
          arquivo_path: string;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          descricao: string | null;
          empresa_id: string;
          id: string;
          nome: string;
          tipo: string;
          updated_at: string | null;
          variaveis: string[] | null;
        };
        Insert: {
          arquivo_path: string;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id: string;
          id?: string;
          nome: string;
          tipo?: string;
          updated_at?: string | null;
          variaveis?: string[] | null;
        };
        Update: {
          arquivo_path?: string;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id?: string;
          id?: string;
          nome?: string;
          tipo?: string;
          updated_at?: string | null;
          variaveis?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "proposta_templates_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      propostas: {
        Row: {
          area_m2: number | null;
          campos_extras: Json | null;
          cliente_id: string | null;
          codigo: string | null;
          conteudo: Json | null;
          contrato_assinado: boolean;
          contrato_enviado: boolean;
          contrato_recusado: boolean;
          created_at: string | null;
          created_by: string | null;
          custo_estimado: number | null;
          dados_simulacao: Json | null;
          deleted_at: string | null;
          documento_path: string | null;
          empresa_id: string;
          id: string;
          lead_id: string | null;
          localizacao: string | null;
          margem_estimada_pct: number | null;
          observacao: string | null;
          prazo_estimado_dias: number | null;
          projeto_id: string | null;
          status: string | null;
          template_id: string | null;
          titulo: string;
          updated_at: string | null;
          updated_by: string | null;
          validade: string | null;
          valor_proposto: number | null;
        };
        Insert: {
          area_m2?: number | null;
          campos_extras?: Json | null;
          cliente_id?: string | null;
          codigo?: string | null;
          conteudo?: Json | null;
          contrato_assinado?: boolean;
          contrato_enviado?: boolean;
          contrato_recusado?: boolean;
          created_at?: string | null;
          created_by?: string | null;
          custo_estimado?: number | null;
          dados_simulacao?: Json | null;
          deleted_at?: string | null;
          documento_path?: string | null;
          empresa_id: string;
          id?: string;
          lead_id?: string | null;
          localizacao?: string | null;
          margem_estimada_pct?: number | null;
          observacao?: string | null;
          prazo_estimado_dias?: number | null;
          projeto_id?: string | null;
          status?: string | null;
          template_id?: string | null;
          titulo: string;
          updated_at?: string | null;
          updated_by?: string | null;
          validade?: string | null;
          valor_proposto?: number | null;
        };
        Update: {
          area_m2?: number | null;
          campos_extras?: Json | null;
          cliente_id?: string | null;
          codigo?: string | null;
          conteudo?: Json | null;
          contrato_assinado?: boolean;
          contrato_enviado?: boolean;
          contrato_recusado?: boolean;
          created_at?: string | null;
          created_by?: string | null;
          custo_estimado?: number | null;
          dados_simulacao?: Json | null;
          deleted_at?: string | null;
          documento_path?: string | null;
          empresa_id?: string;
          id?: string;
          lead_id?: string | null;
          localizacao?: string | null;
          margem_estimada_pct?: number | null;
          observacao?: string | null;
          prazo_estimado_dias?: number | null;
          projeto_id?: string | null;
          status?: string | null;
          template_id?: string | null;
          titulo?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          validade?: string | null;
          valor_proposto?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "propostas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "propostas_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "proposta_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_attempts: {
        Row: {
          action: string;
          attempted_at: string;
          id: string;
          key: string;
        };
        Insert: {
          action: string;
          attempted_at?: string;
          id?: string;
          key: string;
        };
        Update: {
          action?: string;
          attempted_at?: string;
          id?: string;
          key?: string;
        };
        Relationships: [];
      };
      receitas: {
        Row: {
          asaas_billing_type: string | null;
          asaas_payment_id: string | null;
          asaas_payment_status: string | null;
          asaas_payment_url: string | null;
          categoria_id: string | null;
          centro_custo_id: string | null;
          cliente_id: string | null;
          conta_id: string | null;
          created_at: string | null;
          created_by: string | null;
          data_competencia: string | null;
          data_recebimento: string | null;
          data_vencimento: string | null;
          deleted_at: string | null;
          descricao: string;
          empresa_id: string;
          forma_pagamento: string | null;
          grupo_parcela: string | null;
          id: string;
          nota_fiscal: string | null;
          observacao: string | null;
          parcela_numero: number | null;
          parcela_total: number | null;
          projeto_id: string | null;
          status: Database["public"]["Enums"]["status_financeiro"] | null;
          tags: string[] | null;
          updated_at: string | null;
          updated_by: string | null;
          valor: number;
        };
        Insert: {
          asaas_billing_type?: string | null;
          asaas_payment_id?: string | null;
          asaas_payment_status?: string | null;
          asaas_payment_url?: string | null;
          categoria_id?: string | null;
          centro_custo_id?: string | null;
          cliente_id?: string | null;
          conta_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_competencia?: string | null;
          data_recebimento?: string | null;
          data_vencimento?: string | null;
          deleted_at?: string | null;
          descricao: string;
          empresa_id: string;
          forma_pagamento?: string | null;
          grupo_parcela?: string | null;
          id?: string;
          nota_fiscal?: string | null;
          observacao?: string | null;
          parcela_numero?: number | null;
          parcela_total?: number | null;
          projeto_id?: string | null;
          status?: Database["public"]["Enums"]["status_financeiro"] | null;
          tags?: string[] | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor: number;
        };
        Update: {
          asaas_billing_type?: string | null;
          asaas_payment_id?: string | null;
          asaas_payment_status?: string | null;
          asaas_payment_url?: string | null;
          categoria_id?: string | null;
          centro_custo_id?: string | null;
          cliente_id?: string | null;
          conta_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          data_competencia?: string | null;
          data_recebimento?: string | null;
          data_vencimento?: string | null;
          deleted_at?: string | null;
          descricao?: string;
          empresa_id?: string;
          forma_pagamento?: string | null;
          grupo_parcela?: string | null;
          id?: string;
          nota_fiscal?: string | null;
          observacao?: string | null;
          parcela_numero?: number | null;
          parcela_total?: number | null;
          projeto_id?: string | null;
          status?: Database["public"]["Enums"]["status_financeiro"] | null;
          tags?: string[] | null;
          updated_at?: string | null;
          updated_by?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "receitas_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_financeiras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_centro_custo_id_fkey";
            columns: ["centro_custo_id"];
            isOneToOne: false;
            referencedRelation: "centros_custo";
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
            foreignKeyName: "receitas_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_conta_id_fkey";
            columns: ["conta_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
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
        ];
      };
      templates_projeto: {
        Row: {
          ativo: boolean | null;
          checklist: Json | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          descricao: string | null;
          empresa_id: string;
          fases: Json;
          id: string;
          nome: string;
          tipo_servico: string;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          ativo?: boolean | null;
          checklist?: Json | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id: string;
          fases?: Json;
          id?: string;
          nome: string;
          tipo_servico: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          ativo?: boolean | null;
          checklist?: Json | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id?: string;
          fases?: Json;
          id?: string;
          nome?: string;
          tipo_servico?: string;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "templates_projeto_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      transferencias: {
        Row: {
          conta_destino_id: string;
          conta_origem_id: string;
          created_at: string;
          created_by: string | null;
          data_transferencia: string;
          deleted_at: string | null;
          descricao: string | null;
          empresa_id: string;
          id: string;
          observacao: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          valor: number;
        };
        Insert: {
          conta_destino_id: string;
          conta_origem_id: string;
          created_at?: string;
          created_by?: string | null;
          data_transferencia: string;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id: string;
          id?: string;
          observacao?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valor: number;
        };
        Update: {
          conta_destino_id?: string;
          conta_origem_id?: string;
          created_at?: string;
          created_by?: string | null;
          data_transferencia?: string;
          deleted_at?: string | null;
          descricao?: string | null;
          empresa_id?: string;
          id?: string;
          observacao?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "transferencias_conta_destino_id_fkey";
            columns: ["conta_destino_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transferencias_conta_destino_id_fkey";
            columns: ["conta_destino_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
          {
            foreignKeyName: "transferencias_conta_origem_id_fkey";
            columns: ["conta_origem_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transferencias_conta_origem_id_fkey";
            columns: ["conta_origem_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
          {
            foreignKeyName: "transferencias_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      ultra_admin_modes: {
        Row: {
          scoped: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          scoped?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          scoped?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      lancamentos: {
        Row: {
          cartao_id: string | null;
          categoria_id: string | null;
          centro_custo_id: string | null;
          conta_id: string | null;
          contraparte_id: string | null;
          contraparte_tipo: string | null;
          created_at: string | null;
          created_by: string | null;
          data_competencia: string | null;
          data_efetivacao: string | null;
          data_vencimento: string | null;
          deleted_at: string | null;
          descricao: string | null;
          empresa_id: string | null;
          fatura_id: string | null;
          forma_pagamento: string | null;
          grupo_parcela: string | null;
          grupo_status: string | null;
          grupo_tipo: string | null;
          grupo_total_original: number | null;
          id: string | null;
          nota_fiscal: string | null;
          observacao: string | null;
          parcela_numero: number | null;
          parcela_total: number | null;
          projeto_id: string | null;
          status: string | null;
          tags: string[] | null;
          tipo: string | null;
          transferencia_par_id: string | null;
          updated_at: string | null;
          updated_by: string | null;
          valor: number | null;
        };
        Relationships: [];
      };
      view_cartao_resumo: {
        Row: {
          conta_pagamento_id: string | null;
          cor: string | null;
          dia_fechamento: number | null;
          dia_vencimento: number | null;
          disponivel: number | null;
          empresa_id: string | null;
          id: string | null;
          limite: number | null;
          nome: string | null;
          tipo: string | null;
          usado: number | null;
        };
        Insert: {
          conta_pagamento_id?: string | null;
          cor?: string | null;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          disponivel?: never;
          empresa_id?: string | null;
          id?: string | null;
          limite?: number | null;
          nome?: string | null;
          tipo?: string | null;
          usado?: never;
        };
        Update: {
          conta_pagamento_id?: string | null;
          cor?: string | null;
          dia_fechamento?: number | null;
          dia_vencimento?: number | null;
          disponivel?: never;
          empresa_id?: string | null;
          id?: string | null;
          limite?: number | null;
          nome?: string | null;
          tipo?: string | null;
          usado?: never;
        };
        Relationships: [
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
          {
            foreignKeyName: "cartoes_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      view_fatura_resumo: {
        Row: {
          ano_referencia: number | null;
          cartao_cor: string | null;
          cartao_id: string | null;
          cartao_nome: string | null;
          conta_pagamento_id: string | null;
          conta_pagamento_nome: string | null;
          data_fim: string | null;
          data_inicio: string | null;
          data_pagamento: string | null;
          data_vencimento: string | null;
          empresa_id: string | null;
          id: string | null;
          mes_referencia: number | null;
          qtd_despesas: number | null;
          status: string | null;
          valor_pago: number | null;
          valor_total: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "faturas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "cartoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_cartao_id_fkey";
            columns: ["cartao_id"];
            isOneToOne: false;
            referencedRelation: "view_cartao_resumo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "contas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey";
            columns: ["conta_pagamento_id"];
            isOneToOne: false;
            referencedRelation: "view_financas_resumo";
            referencedColumns: ["conta_id"];
          },
          {
            foreignKeyName: "faturas_empresa_id_fkey";
            columns: ["empresa_id"];
            isOneToOne: false;
            referencedRelation: "empresas";
            referencedColumns: ["id"];
          },
        ];
      };
      view_financas_resumo: {
        Row: {
          banco: string | null;
          conta_id: string | null;
          conta_nome: string | null;
          cor: string | null;
          empresa_id: string | null;
          saldo_atual: number | null;
          saldo_inicial: number | null;
          total_entradas: number | null;
          total_saidas: number | null;
        };
        Insert: {
          banco?: string | null;
          conta_id?: string | null;
          conta_nome?: string | null;
          cor?: string | null;
          empresa_id?: string | null;
          saldo_atual?: never;
          saldo_inicial?: number | null;
          total_entradas?: never;
          total_saidas?: never;
        };
        Update: {
          banco?: string | null;
          conta_id?: string | null;
          conta_nome?: string | null;
          cor?: string | null;
          empresa_id?: string | null;
          saldo_atual?: never;
          saldo_inicial?: number | null;
          total_entradas?: never;
          total_saidas?: never;
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
      view_folha_pagamento: {
        Row: {
          cargo: string | null;
          empresa_id: string | null;
          pessoa_id: string | null;
          pessoa_nome: string | null;
          qtd_projetos: number | null;
          salario_fixo: number | null;
          total_area_m2: number | null;
          total_comissao: number | null;
          total_receber: number | null;
          valor_m2: number | null;
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
    };
    Functions: {
      _feature_catalog: { Args: never; Returns: string[] };
      _portal_create_account: {
        Args: {
          p_cliente_id: string;
          p_created_by: string;
          p_email: string;
          p_empresa_id: string;
          p_nome: string;
          p_senha: string;
        };
        Returns: undefined;
      };
      _portal_reset_password: {
        Args: { p_account_id: string; p_nova_senha: string };
        Returns: undefined;
      };
      _validate_features_payload: {
        Args: { p_empresa_id: string; p_features: Json };
        Returns: undefined;
      };
      admin_create_company_owner: {
        Args: { p_company_name?: string; p_email: string; p_nome: string };
        Returns: Json;
      };
      audit_log_cleanup: { Args: never; Returns: number };
      audit_logs_archive_old: { Args: never; Returns: number };
      check_convite_rate_limit: {
        Args: { p_empresa_id: string };
        Returns: undefined;
      };
      cleanup_expired_pending_signups: { Args: never; Returns: number };
      cleanup_pending_signups: { Args: never; Returns: number };
      create_convite: {
        Args: {
          p_cargo: string;
          p_email: string;
          p_features?: Json;
          p_nome?: string;
        };
        Returns: string;
      };
      create_portal_token: {
        Args: {
          p_cliente_id: string;
          p_dias_validade?: number;
          p_email_cliente?: string;
          p_projeto_id: string;
        };
        Returns: string;
      };
      create_projeto_completo:
        | {
            Args: {
              p_area_m2?: number;
              p_cliente_id: string;
              p_codigo: string;
              p_data_final?: string;
              p_data_inicio?: string;
              p_data_previsao?: string;
              p_disciplinas?: Json;
              p_localizacao?: string;
              p_nome: string;
              p_observacao?: string;
              p_parcelas?: string;
              p_prioridade?: string;
              p_valor_contrato?: number;
            };
            Returns: string;
          }
        | {
            Args: {
              p_area_m2: number;
              p_cliente_id: string;
              p_codigo: string;
              p_data_final: string;
              p_data_inicio: string;
              p_data_previsao: string;
              p_disciplinas: Json;
              p_localizacao: string;
              p_nome: string;
              p_observacao: string;
              p_parcelas: string;
              p_valor_contrato: number;
            };
            Returns: string;
          }
        | {
            Args: {
              p_cliente_id: string;
              p_codigo: string;
              p_data_final: string;
              p_data_inicio: string;
              p_data_previsao: string;
              p_localizacao: string;
              p_nome: string;
              p_observacao: string;
              p_parcelas: string;
              p_responsaveis: Json;
              p_valor_contrato: number;
            };
            Returns: string;
          };
      current_effective_role: { Args: never; Returns: string };
      current_impersonation: {
        Args: never;
        Returns: {
          admin_id: string;
          admin_role: string;
          ended_at: string | null;
          expires_at: string;
          id: string;
          ip_address: string | null;
          started_at: string;
          target_role: string;
          user_agent: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "impersonation_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      find_or_create_fatura: {
        Args: { p_cartao_id: string; p_data_compra: string };
        Returns: string;
      };
      gerar_fatura: {
        Args: { p_ano: number; p_cartao_id: string; p_mes: number };
        Returns: string;
      };
      get_cliente_projeto_detail:
        | { Args: { p_projeto_id: string }; Returns: Json }
        | { Args: { p_projeto_id: string; p_token?: string }; Returns: Json };
      get_cliente_projetos: { Args: never; Returns: Json[] } | { Args: { p_token?: string }; Returns: Json[] };
      get_folha_preview: {
        Args: { p_ano: number; p_mes: number };
        Returns: {
          cargo: string;
          nome: string;
          pessoa_id: string;
          projetos_nomes: string[];
          salario_fixo: number;
          total_area: number;
          total_receber: number;
          total_variavel: number;
          valor_m2: number;
        }[];
      };
      get_lancamentos_kpis: {
        Args: { p_from?: string; p_to?: string };
        Returns: Json;
      };
      get_portal_propostas: {
        Args: { p_token: string };
        Returns: {
          area_m2: number;
          codigo: string;
          created_at: string;
          id: string;
          localizacao: string;
          observacao: string;
          prazo_estimado_dias: number;
          status: string;
          titulo: string;
          validade: string;
          valor_proposto: number;
        }[];
      };
      get_user_empresa_id: { Args: never; Returns: string };
      get_user_empresa_id_text: { Args: never; Returns: string };
      has_role: {
        Args: { allowed_roles: Database["public"]["Enums"]["user_role"][] };
        Returns: boolean;
      };
      impersonation_sessions_cleanup: { Args: never; Returns: number };
      insert_audit_log: {
        Args: {
          p_action: string;
          p_actor_email?: string;
          p_actor_id?: string;
          p_diff?: Json;
          p_metadata?: Json;
          p_target_id?: string;
          p_target_table?: string;
        };
        Returns: undefined;
      };
      is_company_admin: { Args: never; Returns: boolean };
      is_feature_flag_enabled: { Args: { p_key: string }; Returns: boolean };
      is_impersonating: { Args: never; Returns: boolean };
      is_ultra_admin: { Args: never; Returns: boolean };
      is_ultra_admin_scoped: { Args: never; Returns: boolean };
      pagar_fatura: {
        Args: {
          p_conta_id: string;
          p_data_pagamento?: string;
          p_fatura_id: string;
          p_idempotency_key?: string;
          p_valor_pago?: number;
        };
        Returns: undefined;
      };
      pilar_set_ultra_admin_scope: {
        Args: { p_scoped: boolean };
        Returns: boolean;
      };
      portal_atualizar_status_proposta: {
        Args: { p_proposta_id: string; p_status: string; p_token: string };
        Returns: Json;
      };
      portal_login: {
        Args: { p_email: string; p_senha: string };
        Returns: Json;
      };
      portal_verify_session: { Args: { p_token: string }; Returns: Json };
      recalc_grupo_parcela_status: {
        Args: { p_grupo_id: string };
        Returns: undefined;
      };
      request_data_deletion: { Args: { p_motivo?: string }; Returns: string };
      request_data_export: { Args: never; Returns: Json };
      rpc_atualizar_status_atrasados: { Args: never; Returns: Json };
      rpc_calcular_wip: {
        Args: { p_ano: number; p_mes: number };
        Returns: number;
      };
      rpc_converter_lead_cliente: {
        Args: { p_lead_id: string };
        Returns: string;
      };
      rpc_converter_proposta_projeto: {
        Args: { p_proposta_id: string };
        Returns: string;
      };
      rpc_criar_transferencia: {
        Args: {
          p_conta_destino_id: string;
          p_conta_origem_id: string;
          p_data: string;
          p_descricao?: string;
          p_observacao?: string;
          p_status?: string;
          p_valor: number;
        };
        Returns: string;
      };
      rpc_daily_maintenance: { Args: never; Returns: Json };
      rpc_dashboard_rentabilidade: { Args: never; Returns: Json };
      rpc_editar_transferencia: {
        Args: {
          p_conta_destino_id: string;
          p_conta_origem_id: string;
          p_data: string;
          p_descricao?: string;
          p_id: string;
          p_observacao?: string;
          p_status?: string;
          p_valor: number;
        };
        Returns: undefined;
      };
      rpc_excluir_transferencia: { Args: { p_id: string }; Returns: undefined };
      rpc_faturar_marco: { Args: { p_marco_id: string }; Returns: string };
      rpc_gerar_alertas: { Args: never; Returns: number } | { Args: { p_empresa_id: string }; Returns: number };
      rpc_gerar_despesas_recorrentes: { Args: never; Returns: number };
      rpc_gerar_parcelas_dia_fixo: {
        Args: {
          p_dia_fixo: number;
          p_num_parcelas: number;
          p_projeto_id: string;
        };
        Returns: number;
      };
      rpc_gerar_parcelas_projeto: {
        Args: {
          p_intervalo_dias?: number;
          p_num_parcelas?: number;
          p_projeto_id: string;
        };
        Returns: number;
      };
      rpc_grupo_parcela_criar: {
        Args: {
          p_cartao_id?: string;
          p_categoria_id?: string;
          p_centro_custo_id?: string;
          p_conta_id?: string;
          p_contraparte_id?: string;
          p_descricao: string;
          p_forma_pagamento?: string;
          p_num_parcelas: number;
          p_observacao?: string;
          p_periodicidade?: string;
          p_primeira_data: string;
          p_projeto_id?: string;
          p_tags?: string[];
          p_tipo_lancamento: string;
          p_total: number;
        };
        Returns: string;
      };
      rpc_grupo_parcela_editar_em_aberto: {
        Args: {
          p_grupo_id: string;
          p_nova_categoria_id?: string;
          p_nova_conta_id?: string;
          p_nova_observacao?: string;
          p_novo_centro_custo_id?: string;
          p_novo_valor_parcela?: number;
        };
        Returns: number;
      };
      rpc_grupo_parcela_quitar_antecipado: {
        Args: {
          p_data_pagamento?: string;
          p_desconto_total?: number;
          p_grupo_id: string;
          p_quantidade?: number;
        };
        Returns: number;
      };
      rpc_grupo_parcela_renegociar: {
        Args: {
          p_grupo_id: string;
          p_nova_primeira_data: string;
          p_novo_num_parcelas: number;
          p_novo_total: number;
          p_observacao?: string;
        };
        Returns: string;
      };
      rpc_lancamento_set_rateio: {
        Args: {
          p_lancamento_id: string;
          p_rateios: Json;
          p_tipo_lancamento: string;
        };
        Returns: number;
      };
      rpc_projeto_rentabilidade: {
        Args: { p_projeto_id: string };
        Returns: Json;
      };
      rpc_sync_metas: { Args: never; Returns: number };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      start_impersonation: {
        Args: { p_ip?: string; p_target_role: string; p_user_agent?: string };
        Returns: string;
      };
      stop_impersonation: { Args: never; Returns: undefined };
      update_company_features: {
        Args: { p_features: Json };
        Returns: undefined;
      };
      update_projeto_completo:
        | {
            Args: {
              p_area_m2?: number;
              p_cliente_id: string;
              p_codigo: string;
              p_data_final?: string;
              p_data_inicio?: string;
              p_data_previsao?: string;
              p_disciplinas?: Json;
              p_localizacao?: string;
              p_nome: string;
              p_observacao?: string;
              p_parcelas?: string;
              p_prioridade?: string;
              p_projeto_id: string;
              p_status?: string;
              p_valor_contrato?: number;
            };
            Returns: undefined;
          }
        | {
            Args: {
              p_area_m2: number;
              p_cliente_id: string;
              p_codigo: string;
              p_data_final: string;
              p_data_inicio: string;
              p_data_previsao: string;
              p_disciplinas: Json;
              p_localizacao: string;
              p_nome: string;
              p_observacao: string;
              p_parcelas: string;
              p_projeto_id: string;
              p_status: string;
              p_valor_contrato: number;
            };
            Returns: boolean;
          };
      update_user_access: {
        Args: { p_features?: Json; p_role: string; p_user_id: string };
        Returns: undefined;
      };
      user_has_feature: {
        Args: { p_feature: string; p_min_level?: string };
        Returns: boolean;
      };
    };
    Enums: {
      status_empresa: "active" | "suspended" | "cancelled";
      status_financeiro: "Pendente" | "Pago" | "Recebido" | "Atrasado" | "Cancelado";
      status_projeto:
        | "Planejamento"
        | "Execução"
        | "Paralisado"
        | "Concluído"
        | "Cancelado"
        | "Em andamento"
        | "Revisão";
      tipo_categoria: "Receita" | "Despesa";
      user_role: "user" | "admin" | "ultra_admin";
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
      status_financeiro: ["Pendente", "Pago", "Recebido", "Atrasado", "Cancelado"],
      status_projeto: ["Planejamento", "Execução", "Paralisado", "Concluído", "Cancelado", "Em andamento", "Revisão"],
      tipo_categoria: ["Receita", "Despesa"],
      user_role: ["user", "admin", "ultra_admin"],
    },
  },
} as const;
