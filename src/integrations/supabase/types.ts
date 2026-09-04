export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          actor_role: string
          category: string
          created_at: string
          empresa_id: string | null
          id: string
          ip_address: string | null
          metadata: Json
          target_id: string | null
          target_name: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email: string
          actor_id?: string | null
          actor_role: string
          category: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          actor_role?: string
          category?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_name?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      agent_actions: {
        Row: {
          args: Json | null
          created_at: string
          id: number
          result: Json | null
          run_id: string
          tool_name: string
        }
        Insert: {
          args?: Json | null
          created_at?: string
          id?: never
          result?: Json | null
          run_id: string
          tool_name: string
        }
        Update: {
          args?: Json | null
          created_at?: string
          id?: never
          result?: Json | null
          run_id?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_type: string
          confidence: number | null
          created_at: string
          created_by: string | null
          empresa_id: string
          entity_id: string | null
          entity_type: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          input: Json | null
          model: string | null
          result: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["agent_run_status"]
          tokens_input: number
          tokens_output: number
          updated_at: string
          version: number
        }
        Insert: {
          agent_type: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          input?: Json | null
          model?: string | null
          result?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          tokens_input?: number
          tokens_output?: number
          updated_at?: string
          version?: number
        }
        Update: {
          agent_type?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          input?: Json | null
          model?: string | null
          result?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["agent_run_status"]
          tokens_input?: number
          tokens_output?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_precos: {
        Row: {
          created_at: string
          modelo: string
          moeda: string
          preco_input_por_milhao: number
          preco_output_por_milhao: number
          vigente_desde: string
        }
        Insert: {
          created_at?: string
          modelo: string
          moeda?: string
          preco_input_por_milhao: number
          preco_output_por_milhao: number
          vigente_desde: string
        }
        Update: {
          created_at?: string
          modelo?: string
          moeda?: string
          preco_input_por_milhao?: number
          preco_output_por_milhao?: number
          vigente_desde?: string
        }
        Relationships: []
      }
      ai_token_ledger: {
        Row: {
          agent_key: string
          agent_run_id: string | null
          created_at: string
          custo_estimado: number | null
          empresa_id: string
          id: string
          idempotency_key: string | null
          model: string | null
          reference_id: string | null
          source: string
          tokens_delta: number
          tokens_input: number
          tokens_output: number
          user_id: string | null
        }
        Insert: {
          agent_key: string
          agent_run_id?: string | null
          created_at?: string
          custo_estimado?: number | null
          empresa_id: string
          id?: string
          idempotency_key?: string | null
          model?: string | null
          reference_id?: string | null
          source: string
          tokens_delta: number
          tokens_input?: number
          tokens_output?: number
          user_id?: string | null
        }
        Update: {
          agent_key?: string
          agent_run_id?: string | null
          created_at?: string
          custo_estimado?: number | null
          empresa_id?: string
          id?: string
          idempotency_key?: string | null
          model?: string | null
          reference_id?: string | null
          source?: string
          tokens_delta?: number
          tokens_input?: number
          tokens_output?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_ledger_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_token_ledger_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_limite_usuario: {
        Row: {
          created_at: string
          criado_por: string | null
          empresa_id: string
          limite_mensal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          empresa_id: string
          limite_mensal: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          empresa_id?: string
          limite_mensal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_limite_usuario_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_saldo: {
        Row: {
          empresa_id: string
          saldo_comprado: number
          saldo_plano: number
          updated_at: string
        }
        Insert: {
          empresa_id: string
          saldo_comprado?: number
          saldo_plano?: number
          updated_at?: string
        }
        Update: {
          empresa_id?: string
          saldo_comprado?: number
          saldo_plano?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_saldo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_solicitacao: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          limite_sugerido: number | null
          mensagem: string | null
          novo_limite: number | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          limite_sugerido?: number | null
          mensagem?: string | null
          novo_limite?: number | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          limite_sugerido?: number | null
          mensagem?: string | null
          novo_limite?: number | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_solicitacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          ano: number
          created_at: string | null
          custo_estimado_total: number | null
          empresa_id: string
          id: string
          limite_requests: number | null
          mes: number
          total_requests: number | null
          total_tokens_entrada: number | null
          total_tokens_saida: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          custo_estimado_total?: number | null
          empresa_id: string
          id?: string
          limite_requests?: number | null
          mes: number
          total_requests?: number | null
          total_tokens_entrada?: number | null
          total_tokens_saida?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          custo_estimado_total?: number | null
          empresa_id?: string
          id?: string
          limite_requests?: number | null
          mes?: number
          total_requests?: number | null
          total_tokens_entrada?: number | null
          total_tokens_saida?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string | null
          empresa_id: string
          feature_key: string
          id: string
          model: string | null
          tokens_input: number
          tokens_output: number
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          feature_key: string
          id?: string
          model?: string | null
          tokens_input?: number
          tokens_output?: number
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          feature_key?: string
          id?: string
          model?: string | null
          tokens_input?: number
          tokens_output?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas: {
        Row: {
          created_at: string | null
          empresa_id: string
          expires_at: string | null
          id: string
          lido: boolean | null
          lido_em: string | null
          lido_por: string | null
          mensagem: string
          referencia_id: string | null
          referencia_tipo: string | null
          severidade: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          empresa_id: string
          expires_at?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          lido_por?: string | null
          mensagem: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          expires_at?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          lido_por?: string | null
          mensagem?: string
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      aprovacoes: {
        Row: {
          aprovador_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          justificativa: string | null
          referencia_id: string
          referencia_tipo: string
          resposta: string | null
          solicitante_id: string | null
          status: string
          tipo: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          aprovador_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          justificativa?: string | null
          referencia_id: string
          referencia_tipo: string
          resposta?: string | null
          solicitante_id?: string | null
          status?: string
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          aprovador_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          justificativa?: string | null
          referencia_id?: string
          referencia_tipo?: string
          resposta?: string | null
          solicitante_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_config: {
        Row: {
          ambiente: string
          api_key: string | null
          api_key_secret_id: string | null
          created_at: string
          empresa_id: string
          id: string
          updated_at: string
        }
        Insert: {
          ambiente?: string
          api_key?: string | null
          api_key_secret_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          api_key?: string | null
          api_key_secret_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_logs: {
        Row: {
          empresa_id: string | null
          event: string
          id: string
          payload: Json | null
          payment_id: string | null
          processed_at: string | null
          receita_id: string | null
        }
        Insert: {
          empresa_id?: string | null
          event: string
          id?: string
          payload?: Json | null
          payment_id?: string | null
          processed_at?: string | null
          receita_id?: string | null
        }
        Update: {
          empresa_id?: string | null
          event?: string
          id?: string
          payload?: Json | null
          payment_id?: string | null
          processed_at?: string | null
          receita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_webhook_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_webhook_logs_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          diff: Json | null
          empresa_id: string | null
          id: string
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          empresa_id?: string | null
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          empresa_id?: string | null
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      audit_logs_archive: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          archived_at: string
          created_at: string
          diff: Json | null
          empresa_id: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          archived_at?: string
          created_at: string
          diff?: Json | null
          empresa_id?: string | null
          id: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          archived_at?: string
          created_at?: string
          diff?: Json | null
          empresa_id?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      campo_accounts: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          email: string | null
          empresa_id: string
          id: string
          must_change_senha: boolean
          nome: string
          obra_id: string
          senha_hash: string | null
          token_expira_em: string | null
          token_sessao: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          must_change_senha?: boolean
          nome: string
          obra_id: string
          senha_hash?: string | null
          token_expira_em?: string | null
          token_sessao?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          must_change_senha?: boolean
          nome?: string
          obra_id?: string
          senha_hash?: string | null
          token_expira_em?: string | null
          token_sessao?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campo_accounts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campo_accounts_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes: {
        Row: {
          conta_pagamento_id: string | null
          cor: string | null
          created_at: string | null
          deleted_at: string | null
          dia_fechamento: number | null
          dia_vencimento: number | null
          empresa_id: string
          id: string
          limite: number
          nome: string
          tipo: string
          updated_at: string | null
          usado: number | null
        }
        Insert: {
          conta_pagamento_id?: string | null
          cor?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          empresa_id: string
          id?: string
          limite: number
          nome: string
          tipo?: string
          updated_at?: string | null
          usado?: number | null
        }
        Update: {
          conta_pagamento_id?: string | null
          cor?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          empresa_id?: string
          id?: string
          limite?: number
          nome?: string
          tipo?: string
          updated_at?: string | null
          usado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "cartoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_categoria"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["tipo_categoria"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meta: Json
          role: string
          session_id: string
          tokens_input: number
          tokens_output: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meta?: Json
          role: string
          session_id: string
          tokens_input?: number
          tokens_output?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta?: Json
          role?: string
          session_id?: string
          tokens_input?: number
          tokens_output?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_portal_accounts: {
        Row: {
          ativo: boolean | null
          cliente_id: string
          created_at: string | null
          created_by: string | null
          email: string | null
          empresa_id: string
          id: string
          must_change_password: boolean
          nome: string
          senha_hash: string | null
          token_expira_em: string | null
          token_sessao: string | null
          ultimo_acesso: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cliente_id: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          must_change_password?: boolean
          nome: string
          senha_hash?: string | null
          token_expira_em?: string | null
          token_sessao?: string | null
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cliente_id?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          must_change_password?: boolean
          nome?: string
          senha_hash?: string | null
          token_expira_em?: string | null
          token_sessao?: string | null
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_portal_accounts_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_portal_accounts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          asaas_customer_id: string | null
          chaves_pix: Json | null
          contas_bancarias: Json | null
          contato: string | null
          cpf_cnpj: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          origem: string | null
          sobrenome: string | null
          tipo_nf: string | null
          tipo_pessoa: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          chaves_pix?: Json | null
          contas_bancarias?: Json | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          origem?: string | null
          sobrenome?: string | null
          tipo_nf?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          chaves_pix?: Json | null
          contas_bancarias?: Json | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          origem?: string | null
          sobrenome?: string | null
          tipo_nf?: string | null
          tipo_pessoa?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          banco: string
          chave_pix: string | null
          cor: string | null
          created_at: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          saldo_atual: number | null
          saldo_inicial: number | null
          tipo_chave_pix: string | null
          updated_at: string | null
        }
        Insert: {
          banco: string
          chave_pix?: string | null
          cor?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo_chave_pix?: string | null
          updated_at?: string | null
        }
        Update: {
          banco?: string
          chave_pix?: string | null
          cor?: string | null
          created_at?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          saldo_atual?: number | null
          saldo_inicial?: number | null
          tipo_chave_pix?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          cargo: Database["public"]["Enums"]["user_role"]
          created_at: string
          criado_por: string | null
          email: string
          empresa_id: string
          expira_em: string
          id: string
          nome: string | null
          token: string | null
          token_hash: string | null
          usado_em: string | null
        }
        Insert: {
          cargo?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          criado_por?: string | null
          email: string
          empresa_id: string
          expira_em?: string
          id?: string
          nome?: string | null
          token?: string | null
          token_hash?: string | null
          usado_em?: string | null
        }
        Update: {
          cargo?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          criado_por?: string | null
          email?: string
          empresa_id?: string
          expira_em?: string
          id?: string
          nome?: string | null
          token?: string | null
          token_hash?: string | null
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          analytics: boolean
          created_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          analytics: boolean
          created_at?: string
          id?: string
          source: string
          user_id: string
        }
        Update: {
          analytics?: boolean
          created_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      critical_alerts: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          alert_type: string
          created_at: string
          empresa_id: string | null
          id: string
          message: string
          metadata: Json | null
          notified: boolean | null
          severity: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          alert_type: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notified?: boolean | null
          severity: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          alert_type?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notified?: boolean | null
          severity?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "critical_alerts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          empresa_id: string | null
          id: string
          motivo: string | null
          notes: string | null
          notified_at: string | null
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          notes?: string | null
          notified_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          notes?: string | null
          notified_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_deletion_requests_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          download_url: string | null
          empresa_id: string | null
          expires_at: string | null
          id: string
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          empresa_id?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          empresa_id?: string | null
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          cartao_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          conta_id: string | null
          created_at: string | null
          created_by: string | null
          data_competencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          deleted_at: string | null
          descricao: string
          despesa_pai_id: string | null
          empresa_id: string
          fatura_id: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          grupo_parcela: string | null
          id: string
          import_batch_id: string | null
          import_line_hash: string | null
          is_fatura_payment: boolean
          nota_fiscal: string | null
          observacao: string | null
          parcela_numero: number | null
          parcela_total: number | null
          periodicidade: string | null
          projeto_id: string | null
          recorrente: boolean | null
          status: Database["public"]["Enums"]["status_financeiro"] | null
          tags: string[] | null
          updated_at: string | null
          updated_by: string | null
          valor: number
        }
        Insert: {
          cartao_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          descricao: string
          despesa_pai_id?: string | null
          empresa_id: string
          fatura_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          grupo_parcela?: string | null
          id?: string
          import_batch_id?: string | null
          import_line_hash?: string | null
          is_fatura_payment?: boolean
          nota_fiscal?: string | null
          observacao?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          periodicidade?: string | null
          projeto_id?: string | null
          recorrente?: boolean | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          valor: number
        }
        Update: {
          cartao_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          descricao?: string
          despesa_pai_id?: string | null
          empresa_id?: string
          fatura_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          grupo_parcela?: string | null
          id?: string
          import_batch_id?: string | null
          import_line_hash?: string | null
          is_fatura_payment?: boolean
          nota_fiscal?: string | null
          observacao?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          periodicidade?: string | null
          projeto_id?: string | null
          recorrente?: boolean | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "view_cartao_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "despesas_despesa_pai_id_fkey"
            columns: ["despesa_pai_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinas: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_envios: {
        Row: {
          assunto: string
          classe: string
          created_at: string
          destinatario: string
          empresa_id: string | null
          erro: string | null
          id: string
          idempotency_key: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          resend_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          assunto: string
          classe: string
          created_at?: string
          destinatario: string
          empresa_id?: string | null
          erro?: string | null
          id?: string
          idempotency_key?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          resend_id?: string | null
          status: string
          tipo: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          classe?: string
          created_at?: string
          destinatario?: string
          empresa_id?: string | null
          erro?: string | null
          id?: string
          idempotency_key?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          resend_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_envios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_supressoes: {
        Row: {
          created_at: string
          detalhe: string | null
          email: string
          motivo: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          email: string
          motivo: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          email?: string
          motivo?: string
        }
        Relationships: []
      }
      empresa_owners_pending: {
        Row: {
          company_name: string
          created_at: string
          criado_por: string | null
          email: string
          expira_em: string
          id: string
          nome: string | null
          token: string | null
          token_hash: string | null
          usado_em: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          criado_por?: string | null
          email: string
          expira_em?: string
          id?: string
          nome?: string | null
          token?: string | null
          token_hash?: string | null
          usado_em?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          criado_por?: string | null
          email?: string
          expira_em?: string
          id?: string
          nome?: string | null
          token?: string | null
          token_hash?: string | null
          usado_em?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj: string | null
          contato: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          features: Json
          id: string
          logo_url: string | null
          max_projetos_override: number | null
          max_usuarios_override: number | null
          nome: string
          onboarding_completed: boolean | null
          owner_id: string | null
          pix_chave: string | null
          pix_instrucoes: string | null
          status: Database["public"]["Enums"]["status_empresa"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          features?: Json
          id?: string
          logo_url?: string | null
          max_projetos_override?: number | null
          max_usuarios_override?: number | null
          nome: string
          onboarding_completed?: boolean | null
          owner_id?: string | null
          pix_chave?: string | null
          pix_instrucoes?: string | null
          status?: Database["public"]["Enums"]["status_empresa"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          features?: Json
          id?: string
          logo_url?: string | null
          max_projetos_override?: number | null
          max_usuarios_override?: number | null
          nome?: string
          onboarding_completed?: boolean | null
          owner_id?: string | null
          pix_chave?: string | null
          pix_instrucoes?: string | null
          status?: Database["public"]["Enums"]["status_empresa"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      escopo_historico: {
        Row: {
          acao: string
          created_at: string | null
          detalhes: Json | null
          escopo_id: string
          id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          detalhes?: Json | null
          escopo_id: string
          id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          detalhes?: Json | null
          escopo_id?: string
          id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escopo_historico_escopo_id_fkey"
            columns: ["escopo_id"]
            isOneToOne: false
            referencedRelation: "escopos"
            referencedColumns: ["id"]
          },
        ]
      }
      escopo_itens: {
        Row: {
          created_at: string | null
          custo: number | null
          descricao: string
          disciplina: string | null
          escopo_id: string
          horas: number | null
          id: string
        }
        Insert: {
          created_at?: string | null
          custo?: number | null
          descricao: string
          disciplina?: string | null
          escopo_id: string
          horas?: number | null
          id?: string
        }
        Update: {
          created_at?: string | null
          custo?: number | null
          descricao?: string
          disciplina?: string | null
          escopo_id?: string
          horas?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escopo_itens_escopo_id_fkey"
            columns: ["escopo_id"]
            isOneToOne: false
            referencedRelation: "escopos"
            referencedColumns: ["id"]
          },
        ]
      }
      escopos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          created_by: string | null
          custo_estimado: number | null
          deleted_at: string | null
          descricao: string
          empresa_id: string
          horas_estimadas: number | null
          id: string
          impacto_prazo_dias: number | null
          justificativa: string | null
          projeto_id: string
          status: string | null
          tipo: string
          updated_at: string | null
          updated_by: string | null
          valor_aditivo: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          deleted_at?: string | null
          descricao: string
          empresa_id: string
          horas_estimadas?: number | null
          id?: string
          impacto_prazo_dias?: number | null
          justificativa?: string | null
          projeto_id: string
          status?: string | null
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
          valor_aditivo?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string
          horas_estimadas?: number | null
          id?: string
          impacto_prazo_dias?: number | null
          justificativa?: string | null
          projeto_id?: string
          status?: string | null
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
          valor_aditivo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "escopos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escopos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escopos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas: {
        Row: {
          ano_referencia: number
          cartao_id: string
          conta_pagamento_id: string | null
          created_at: string | null
          created_by: string | null
          data_fim: string
          data_inicio: string
          data_pagamento: string | null
          data_vencimento: string
          deleted_at: string | null
          empresa_id: string
          id: string
          idempotency_key: string | null
          mes_referencia: number
          status: string
          updated_at: string | null
          updated_by: string | null
          valor_pago: number
          valor_total: number
        }
        Insert: {
          ano_referencia: number
          cartao_id: string
          conta_pagamento_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim: string
          data_inicio: string
          data_pagamento?: string | null
          data_vencimento: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          idempotency_key?: string | null
          mes_referencia: number
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          valor_pago?: number
          valor_total?: number
        }
        Update: {
          ano_referencia?: number
          cartao_id?: string
          conta_pagamento_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          data_pagamento?: string | null
          data_vencimento?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          idempotency_key?: string | null
          mes_referencia?: number
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          valor_pago?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "view_cartao_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "faturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled_for_all: boolean
          enabled_for_empresas: string[]
          key: string
          percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_for_all?: boolean
          enabled_for_empresas?: string[]
          key: string
          percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_for_all?: boolean
          enabled_for_empresas?: string[]
          key?: string
          percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      feature_suggestions: {
        Row: {
          created_at: string
          created_by: string
          descricao: string
          id: string
          status_interno: string
          titulo: string
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao: string
          id?: string
          status_interno?: string
          titulo: string
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string
          id?: string
          status_interno?: string
          titulo?: string
        }
        Relationships: []
      }
      fluxos_disciplinas: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          etapas: Json
          id: string
          nome: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          etapas?: Json
          id?: string
          nome: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          etapas?: Json
          id?: string
          nome?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fluxos_disciplinas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento: {
        Row: {
          adicional_variavel: number | null
          ano: number
          created_at: string
          data_pagamento: string | null
          detalhe_projetos: Json
          empresa_id: string
          id: string
          mes: number
          pessoa_id: string
          salario_fixo: number | null
          status: string | null
          total_area_projetada: number | null
          total_receber: number | null
          updated_at: string
          valor_m2: number | null
        }
        Insert: {
          adicional_variavel?: number | null
          ano: number
          created_at?: string
          data_pagamento?: string | null
          detalhe_projetos?: Json
          empresa_id: string
          id?: string
          mes: number
          pessoa_id: string
          salario_fixo?: number | null
          status?: string | null
          total_area_projetada?: number | null
          total_receber?: number | null
          updated_at?: string
          valor_m2?: number | null
        }
        Update: {
          adicional_variavel?: number | null
          ano?: number
          created_at?: string
          data_pagamento?: string | null
          detalhe_projetos?: Json
          empresa_id?: string
          id?: string
          mes?: number
          pessoa_id?: string
          salario_fixo?: number | null
          status?: string | null
          total_area_projetada?: number | null
          total_receber?: number | null
          updated_at?: string
          valor_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_parcela: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          contraparte_id: string | null
          contraparte_tipo: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          dia_vencimento: number | null
          empresa_id: string
          id: string
          num_parcelas: number | null
          observacao: string | null
          periodicidade: string | null
          projeto_id: string | null
          renegociado_de: string | null
          status_agregado: string
          tipo_grupo: string
          tipo_lancamento: string
          total_original: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          contraparte_id?: string | null
          contraparte_tipo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          dia_vencimento?: number | null
          empresa_id: string
          id?: string
          num_parcelas?: number | null
          observacao?: string | null
          periodicidade?: string | null
          projeto_id?: string | null
          renegociado_de?: string | null
          status_agregado?: string
          tipo_grupo?: string
          tipo_lancamento: string
          total_original?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          contraparte_id?: string | null
          contraparte_tipo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          dia_vencimento?: number | null
          empresa_id?: string
          id?: string
          num_parcelas?: number | null
          observacao?: string | null
          periodicidade?: string | null
          projeto_id?: string | null
          renegociado_de?: string | null
          status_agregado?: string
          tipo_grupo?: string
          tipo_lancamento?: string
          total_original?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grupos_parcela_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_parcela_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_parcela_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_parcela_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_parcela_renegociado_de_fkey"
            columns: ["renegociado_de"]
            isOneToOne: false
            referencedRelation: "grupos_parcela"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_id: string
          admin_role: string
          ended_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          started_at: string
          target_role: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          admin_role: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          started_at?: string
          target_role: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          admin_role?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          started_at?: string
          target_role?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          error: string | null
          id: string
          input: Json
          max_attempts: number
          progress: number
          result: Json | null
          stage: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          tipo: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          error?: string | null
          id?: string
          input?: Json
          max_attempts?: number
          progress?: number
          result?: Json | null
          stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tipo: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          error?: string | null
          id?: string
          input?: Json
          max_attempts?: number
          progress?: number
          result?: Json | null
          stage?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamento_rateios: {
        Row: {
          centro_custo_id: string
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          lancamento_id: string
          observacao: string | null
          percentual: number
          tipo_lancamento: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          centro_custo_id: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          lancamento_id: string
          observacao?: string | null
          percentual: number
          tipo_lancamento: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          centro_custo_id?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          lancamento_id?: string
          observacao?: string | null
          percentual?: number
          tipo_lancamento?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamento_rateios_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamento_rateios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          cliente_id: string | null
          cnpj: string | null
          contato: string | null
          convertido_em: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string
          empresa_lead: string | null
          id: string
          motivo_perda: string | null
          nome: string
          notas: string | null
          origem: string | null
          previsao_fechamento: string | null
          responsavel_id: string | null
          sobrenome: string | null
          status: string | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          cliente_id?: string | null
          cnpj?: string | null
          contato?: string | null
          convertido_em?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id: string
          empresa_lead?: string | null
          id?: string
          motivo_perda?: string | null
          nome: string
          notas?: string | null
          origem?: string | null
          previsao_fechamento?: string | null
          responsavel_id?: string | null
          sobrenome?: string | null
          status?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          cliente_id?: string | null
          cnpj?: string | null
          contato?: string | null
          convertido_em?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string
          empresa_lead?: string | null
          id?: string
          motivo_perda?: string | null
          nome?: string
          notas?: string | null
          origem?: string | null
          previsao_fechamento?: string | null
          responsavel_id?: string | null
          sobrenome?: string | null
          status?: string | null
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      marcos_faturamento: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_faturada: string | null
          data_prevista: string | null
          deleted_at: string | null
          disciplina: string | null
          empresa_id: string
          id: string
          nome: string
          percentual: number | null
          projeto_id: string
          receita_id: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
          valor: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_faturada?: string | null
          data_prevista?: string | null
          deleted_at?: string | null
          disciplina?: string | null
          empresa_id: string
          id?: string
          nome: string
          percentual?: number | null
          projeto_id: string
          receita_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_faturada?: string | null
          data_prevista?: string | null
          deleted_at?: string | null
          disciplina?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          percentual?: number | null
          projeto_id?: string
          receita_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "marcos_faturamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcos_faturamento_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcos_faturamento_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marcos_faturamento_receita_id_fkey"
            columns: ["receita_id"]
            isOneToOne: false
            referencedRelation: "receitas"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          alvo: number
          atual: number
          auto_sync: boolean | null
          categoria: string | null
          created_at: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          pessoa_id: string | null
          prazo: string | null
          projeto_id: string | null
          sync_filtro: Json | null
          sync_fonte: string | null
          tipo: string
          unidade: string
        }
        Insert: {
          alvo: number
          atual?: number
          auto_sync?: boolean | null
          categoria?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          pessoa_id?: string | null
          prazo?: string | null
          projeto_id?: string | null
          sync_filtro?: Json | null
          sync_fonte?: string | null
          tipo?: string
          unidade?: string
        }
        Update: {
          alvo?: number
          atual?: number
          auto_sync?: boolean | null
          categoria?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          pessoa_id?: string | null
          prazo?: string | null
          projeto_id?: string | null
          sync_filtro?: Json | null
          sync_fonte?: string | null
          tipo?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "metas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notificacao_preferencias: {
        Row: {
          categoria: string
          created_at: string
          email: boolean | null
          empresa_id: string
          id: string
          in_app: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          email?: boolean | null
          empresa_id: string
          id?: string
          in_app?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          email?: boolean | null
          empresa_id?: string
          id?: string
          in_app?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_preferencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_preferencias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacao_preferencias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_uso_tokens_usuario_ciclo"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          arquivada_em: string | null
          categoria: string
          created_at: string
          destinatario_id: string
          email_enviado_em: string | null
          empresa_id: string
          expires_at: string | null
          id: string
          lido_em: string | null
          link: string | null
          mensagem: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          severidade: string
          tipo: string
          titulo: string
        }
        Insert: {
          arquivada_em?: string | null
          categoria: string
          created_at?: string
          destinatario_id: string
          email_enviado_em?: string | null
          empresa_id: string
          expires_at?: string | null
          id?: string
          lido_em?: string | null
          link?: string | null
          mensagem?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: string
          tipo: string
          titulo: string
        }
        Update: {
          arquivada_em?: string | null
          categoria?: string
          created_at?: string
          destinatario_id?: string
          email_enviado_em?: string | null
          empresa_id?: string
          expires_at?: string | null
          id?: string
          lido_em?: string | null
          link?: string | null
          mensagem?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          severidade?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "v_uso_tokens_usuario_ciclo"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_conta_lancamento: {
        Row: {
          comprovante_url: string | null
          confirmada_portal: boolean
          created_at: string
          created_by: string
          data: string
          deleted_at: string | null
          descricao: string
          empresa_id: string
          fornecedor_id: string | null
          id: string
          obra_frente_id: string | null
          obra_id: string
          pago_por: string | null
          tipo: string
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          confirmada_portal?: boolean
          created_at?: string
          created_by?: string
          data: string
          deleted_at?: string | null
          descricao: string
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          obra_frente_id?: string | null
          obra_id: string
          pago_por?: string | null
          tipo: string
          updated_at?: string
          updated_by?: string | null
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          confirmada_portal?: boolean
          created_at?: string
          created_by?: string
          data?: string
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          obra_frente_id?: string | null
          obra_id?: string
          pago_por?: string | null
          tipo?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_conta_lancamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_conta_lancamento_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_conta_lancamento_obra_frente_id_fkey"
            columns: ["obra_frente_id"]
            isOneToOne: false
            referencedRelation: "obra_frente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_conta_lancamento_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_cotacao: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          descricao: string
          empresa_id: string
          id: string
          obra_frente_id: string | null
          obra_id: string
          observacoes: string | null
          prazo_necessidade: string | null
          proposta_vencedora_id: string | null
          quantidade: number | null
          status: string
          tipo: string
          unidade: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          descricao: string
          empresa_id: string
          id?: string
          obra_frente_id?: string | null
          obra_id: string
          observacoes?: string | null
          prazo_necessidade?: string | null
          proposta_vencedora_id?: string | null
          quantidade?: number | null
          status?: string
          tipo?: string
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
          obra_frente_id?: string | null
          obra_id?: string
          observacoes?: string | null
          prazo_necessidade?: string | null
          proposta_vencedora_id?: string | null
          quantidade?: number | null
          status?: string
          tipo?: string
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_cotacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_cotacao_obra_frente_id_fkey"
            columns: ["obra_frente_id"]
            isOneToOne: false
            referencedRelation: "obra_frente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_cotacao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_cotacao_vencedora_fk"
            columns: ["proposta_vencedora_id"]
            isOneToOne: false
            referencedRelation: "obra_cotacao_proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_cotacao_proposta: {
        Row: {
          condicao_pagamento: string | null
          cotacao_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          empresa_id: string
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          link_orcamento: string | null
          observacoes: string | null
          prazo_entrega_dias: number | null
          quantidade: number | null
          unidade: string | null
          updated_at: string
          updated_by: string | null
          valor: number
          valor_parcelado: number | null
        }
        Insert: {
          condicao_pagamento?: string | null
          cotacao_id: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          link_orcamento?: string | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          quantidade?: number | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          valor: number
          valor_parcelado?: number | null
        }
        Update: {
          condicao_pagamento?: string | null
          cotacao_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          link_orcamento?: string | null
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          quantidade?: number | null
          unidade?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number
          valor_parcelado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_cotacao_proposta_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "obra_cotacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_cotacao_proposta_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_cotacao_proposta_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_cotacao_proposta_item: {
        Row: {
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          ordem: number
          preco_unitario: number | null
          proposta_id: string
          quantidade: number | null
          unidade: string | null
          updated_at: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          ordem?: number
          preco_unitario?: number | null
          proposta_id: string
          quantidade?: number | null
          unidade?: string | null
          updated_at?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          ordem?: number
          preco_unitario?: number | null
          proposta_id?: string
          quantidade?: number | null
          unidade?: string | null
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_cotacao_proposta_item_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_cotacao_proposta_item_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "obra_cotacao_proposta"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_frente: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string
          id: string
          nome: string
          obra_id: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: string
          id?: string
          nome: string
          obra_id: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          obra_id?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_frente_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_frente_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_material: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          empresa_id: string
          id: string
          nome: string
          obra_id: string
          unidade: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          nome: string
          obra_id: string
          unidade: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          obra_id?: string
          unidade?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_material_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_material_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_material_mov: {
        Row: {
          created_at: string
          created_by: string
          data: string
          deleted_at: string | null
          empresa_id: string
          id: string
          obra_conta_lancamento_id: string | null
          obra_frente_id: string | null
          obra_id: string
          obra_material_id: string
          obra_rdo_id: string | null
          observacoes: string | null
          quantidade: number
          tipo: string
          updated_at: string
          updated_by: string | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          data: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          obra_conta_lancamento_id?: string | null
          obra_frente_id?: string | null
          obra_id: string
          obra_material_id: string
          obra_rdo_id?: string | null
          observacoes?: string | null
          quantidade: number
          tipo: string
          updated_at?: string
          updated_by?: string | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          obra_conta_lancamento_id?: string | null
          obra_frente_id?: string | null
          obra_id?: string
          obra_material_id?: string
          obra_rdo_id?: string | null
          observacoes?: string | null
          quantidade?: number
          tipo?: string
          updated_at?: string
          updated_by?: string | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_material_mov_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_material_mov_obra_conta_lancamento_id_fkey"
            columns: ["obra_conta_lancamento_id"]
            isOneToOne: false
            referencedRelation: "obra_conta_lancamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_material_mov_obra_frente_id_fkey"
            columns: ["obra_frente_id"]
            isOneToOne: false
            referencedRelation: "obra_frente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_material_mov_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_material_mov_obra_material_id_fkey"
            columns: ["obra_material_id"]
            isOneToOne: false
            referencedRelation: "obra_material"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_material_mov_obra_rdo_id_fkey"
            columns: ["obra_rdo_id"]
            isOneToOne: false
            referencedRelation: "obra_rdo"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_orcamento_etapa: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          obra_frente_id: string
          obra_id: string
          updated_at: string
          valor_previsto: number
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          obra_frente_id: string
          obra_id: string
          updated_at?: string
          valor_previsto?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          obra_frente_id?: string
          obra_id?: string
          updated_at?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_orcamento_etapa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_orcamento_etapa_obra_frente_id_fkey"
            columns: ["obra_frente_id"]
            isOneToOne: false
            referencedRelation: "obra_frente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_orcamento_etapa_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rdo: {
        Row: {
          atividades: string | null
          autor_id: string | null
          campo_account_id: string | null
          clima: string | null
          condicao_trabalho: string | null
          created_at: string
          created_by: string | null
          data: string
          efetivo: number | null
          empresa_id: string
          id: string
          obra_id: string
          ocorrencias: string | null
          pendencias: string | null
          updated_at: string
        }
        Insert: {
          atividades?: string | null
          autor_id?: string | null
          campo_account_id?: string | null
          clima?: string | null
          condicao_trabalho?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          efetivo?: number | null
          empresa_id: string
          id?: string
          obra_id: string
          ocorrencias?: string | null
          pendencias?: string | null
          updated_at?: string
        }
        Update: {
          atividades?: string | null
          autor_id?: string | null
          campo_account_id?: string | null
          clima?: string | null
          condicao_trabalho?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          efetivo?: number | null
          empresa_id?: string
          id?: string
          obra_id?: string
          ocorrencias?: string | null
          pendencias?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rdo_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "obra_rdo_campo_account_id_fkey"
            columns: ["campo_account_id"]
            isOneToOne: false
            referencedRelation: "campo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rdo_efetivo: {
        Row: {
          campo_account_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          quantidade: number
          rdo_id: string
        }
        Insert: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          quantidade: number
          rdo_id: string
        }
        Update: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          quantidade?: number
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rdo_efetivo_campo_account_id_fkey"
            columns: ["campo_account_id"]
            isOneToOne: false
            referencedRelation: "campo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_efetivo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_efetivo_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_efetivo_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "obra_rdo"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rdo_foto: {
        Row: {
          campo_account_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          obra_id: string
          path: string
          rdo_id: string
        }
        Insert: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          obra_id: string
          path: string
          rdo_id: string
        }
        Update: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          obra_id?: string
          path?: string
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rdo_foto_campo_account_id_fkey"
            columns: ["campo_account_id"]
            isOneToOne: false
            referencedRelation: "campo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_foto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_foto_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_foto_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "obra_rdo"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rdo_impedimento: {
        Row: {
          campo_account_id: string | null
          created_at: string
          created_by: string | null
          descricao: string
          empresa_id: string
          id: string
          rdo_id: string
          tipo: string
        }
        Insert: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao: string
          empresa_id: string
          id?: string
          rdo_id: string
          tipo: string
        }
        Update: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string
          empresa_id?: string
          id?: string
          rdo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rdo_impedimento_campo_account_id_fkey"
            columns: ["campo_account_id"]
            isOneToOne: false
            referencedRelation: "campo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_impedimento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_impedimento_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "obra_rdo"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rdo_medicao: {
        Row: {
          campo_account_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          item: string
          obra_id: string
          quantidade: number
          rdo_id: string
          unidade: string
        }
        Insert: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          item: string
          obra_id: string
          quantidade: number
          rdo_id: string
          unidade: string
        }
        Update: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          item?: string
          obra_id?: string
          quantidade?: number
          rdo_id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rdo_medicao_campo_account_id_fkey"
            columns: ["campo_account_id"]
            isOneToOne: false
            referencedRelation: "campo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_medicao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_medicao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_medicao_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "obra_rdo"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rdo_tarefa: {
        Row: {
          campo_account_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          observacao: string | null
          rdo_id: string
          resultado: string
          tarefa_id: string
        }
        Insert: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          observacao?: string | null
          rdo_id: string
          resultado: string
          tarefa_id: string
        }
        Update: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          observacao?: string | null
          rdo_id?: string
          resultado?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rdo_tarefa_campo_account_id_fkey"
            columns: ["campo_account_id"]
            isOneToOne: false
            referencedRelation: "campo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_tarefa_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_tarefa_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "obra_rdo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_tarefa_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_rdo_visita: {
        Row: {
          campo_account_id: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          observacao: string | null
          rdo_id: string
        }
        Insert: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          observacao?: string | null
          rdo_id: string
        }
        Update: {
          campo_account_id?: string | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          observacao?: string | null
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_rdo_visita_campo_account_id_fkey"
            columns: ["campo_account_id"]
            isOneToOne: false
            referencedRelation: "campo_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_visita_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_visita_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_rdo_visita_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "obra_rdo"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cep: string | null
          cidade: string | null
          cliente_id: string | null
          created_at: string
          created_by: string
          data_fim_prevista: string | null
          data_fim_real: string | null
          data_inicio_prevista: string | null
          data_inicio_real: string | null
          deleted_at: string | null
          empresa_id: string
          id: string
          latitude: number | null
          localizacao: string | null
          longitude: number | null
          modelo_cobranca: string
          nome: string
          observacoes: string | null
          projeto_id: string | null
          responsavel_id: string | null
          status: string
          taxa_administracao_pct: number
          updated_at: string
          updated_by: string | null
          visivel_portal: boolean
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          deleted_at?: string | null
          empresa_id: string
          id?: string
          latitude?: number | null
          localizacao?: string | null
          longitude?: number | null
          modelo_cobranca?: string
          nome: string
          observacoes?: string | null
          projeto_id?: string | null
          responsavel_id?: string | null
          status?: string
          taxa_administracao_pct?: number
          updated_at?: string
          updated_by?: string | null
          visivel_portal?: boolean
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          latitude?: number | null
          localizacao?: string | null
          longitude?: number | null
          modelo_cobranca?: string
          nome?: string
          observacoes?: string | null
          projeto_id?: string | null
          responsavel_id?: string | null
          status?: string
          taxa_administracao_pct?: number
          updated_at?: string
          updated_by?: string | null
          visivel_portal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      orcamento_versoes: {
        Row: {
          created_at: string | null
          criado_por: string | null
          dados: Json
          empresa_id: string
          id: string
          motivo: string | null
          projeto_id: string
          versao: number
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          dados: Json
          empresa_id: string
          id?: string
          motivo?: string | null
          projeto_id: string
          versao?: number
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          dados?: Json
          empresa_id?: string
          id?: string
          motivo?: string | null
          projeto_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_versoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_versoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_versoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          cargo: string | null
          chaves_pix: Json | null
          cnpj: string | null
          contas_bancarias: Json | null
          cpf: string | null
          created_at: string | null
          created_by: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string
          empresa_id: string
          endereco: string | null
          horas_semanais: number | null
          id: string
          nome: string
          pis_nit: string | null
          primeiro_nome: string
          profile_id: string | null
          razao_social: string | null
          rg: string | null
          salario_fixo: number | null
          sobrenome: string
          status: string
          telefone: string | null
          tipo_contrato: string | null
          updated_at: string | null
          updated_by: string | null
          valor_m2: number | null
        }
        Insert: {
          cargo?: string | null
          chaves_pix?: Json | null
          cnpj?: string | null
          contas_bancarias?: Json | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email: string
          empresa_id: string
          endereco?: string | null
          horas_semanais?: number | null
          id?: string
          nome: string
          pis_nit?: string | null
          primeiro_nome: string
          profile_id?: string | null
          razao_social?: string | null
          rg?: string | null
          salario_fixo?: number | null
          sobrenome: string
          status?: string
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_m2?: number | null
        }
        Update: {
          cargo?: string | null
          chaves_pix?: Json | null
          cnpj?: string | null
          contas_bancarias?: Json | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string
          empresa_id?: string
          endereco?: string | null
          horas_semanais?: number | null
          id?: string
          nome?: string
          pis_nit?: string | null
          primeiro_nome?: string
          profile_id?: string | null
          razao_social?: string | null
          rg?: string | null
          salario_fixo?: number | null
          sobrenome?: string
          status?: string
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_m2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_uso_tokens_usuario_ciclo"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pilar_checkout_webhook_logs: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          error: string | null
          event: string
          id: string
          payload: Json | null
          pending_signup_id: string | null
          processed: boolean
          subscription_id: string | null
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          error?: string | null
          event: string
          id?: string
          payload?: Json | null
          pending_signup_id?: string | null
          processed?: boolean
          subscription_id?: string | null
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json | null
          pending_signup_id?: string | null
          processed?: boolean
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilar_checkout_webhook_logs_pending_signup_id_fkey"
            columns: ["pending_signup_id"]
            isOneToOne: false
            referencedRelation: "pilar_pending_signups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilar_checkout_webhook_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "pilar_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pilar_pending_signups: {
        Row: {
          activated_at: string | null
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string
          billing_type: string
          checkout_session_token: string
          company_name: string
          cpf_cnpj: string
          created_at: string
          email: string
          empresa_owner_pending_id: string | null
          id: string
          invite_dispatched_at: string | null
          nome: string
          paid_at: string | null
          payment_metadata: Json | null
          payment_status: string
          plan_id: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          billing_type: string
          checkout_session_token?: string
          company_name: string
          cpf_cnpj: string
          created_at?: string
          email: string
          empresa_owner_pending_id?: string | null
          id?: string
          invite_dispatched_at?: string | null
          nome: string
          paid_at?: string | null
          payment_metadata?: Json | null
          payment_status?: string
          plan_id: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          billing_type?: string
          checkout_session_token?: string
          company_name?: string
          cpf_cnpj?: string
          created_at?: string
          email?: string
          empresa_owner_pending_id?: string | null
          id?: string
          invite_dispatched_at?: string | null
          nome?: string
          paid_at?: string | null
          payment_metadata?: Json | null
          payment_status?: string
          plan_id?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilar_pending_signups_empresa_owner_pending_id_fkey"
            columns: ["empresa_owner_pending_id"]
            isOneToOne: false
            referencedRelation: "empresa_owners_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilar_pending_signups_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pilar_subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pilar_subscription_plans: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          destaque: boolean
          features: Json
          id: string
          max_projetos: number | null
          max_usuarios: number | null
          nome: string
          ordem: number
          preco_anual: number | null
          preco_mensal: number
          slug: string
          tokens_mensais: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          features?: Json
          id?: string
          max_projetos?: number | null
          max_usuarios?: number | null
          nome: string
          ordem?: number
          preco_anual?: number | null
          preco_mensal: number
          slug: string
          tokens_mensais?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          features?: Json
          id?: string
          max_projetos?: number | null
          max_usuarios?: number | null
          nome?: string
          ordem?: number
          preco_anual?: number | null
          preco_mensal?: number
          slug?: string
          tokens_mensais?: number | null
        }
        Relationships: []
      }
      pilar_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string | null
          billing_type: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          empresa_id: string
          id: string
          pending_signup_id: string | null
          plan_id: string
          status: string
          trial_ends_at: string | null
          trial_warning_1d_sent_at: string | null
          trial_warning_3d_sent_at: string | null
          trial_warning_7d_sent_at: string | null
          updated_at: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          billing_type?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id: string
          id?: string
          pending_signup_id?: string | null
          plan_id: string
          status?: string
          trial_ends_at?: string | null
          trial_warning_1d_sent_at?: string | null
          trial_warning_3d_sent_at?: string | null
          trial_warning_7d_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          billing_type?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          empresa_id?: string
          id?: string
          pending_signup_id?: string | null
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          trial_warning_1d_sent_at?: string | null
          trial_warning_3d_sent_at?: string | null
          trial_warning_7d_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pilar_subscriptions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilar_subscriptions_pending_signup_id_fkey"
            columns: ["pending_signup_id"]
            isOneToOne: false
            referencedRelation: "pilar_pending_signups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilar_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pilar_subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pilar_token_pack_purchases: {
        Row: {
          asaas_payment_id: string | null
          billing_type: string
          created_at: string
          empresa_id: string
          id: string
          paid_at: string | null
          payment_metadata: Json | null
          quantidade_pacotes: number
          status: string
          tier_id: string | null
          tokens_pacote: number
          user_id: string | null
          valor_centavos: number
        }
        Insert: {
          asaas_payment_id?: string | null
          billing_type: string
          created_at?: string
          empresa_id: string
          id?: string
          paid_at?: string | null
          payment_metadata?: Json | null
          quantidade_pacotes: number
          status?: string
          tier_id?: string | null
          tokens_pacote?: number
          user_id?: string | null
          valor_centavos: number
        }
        Update: {
          asaas_payment_id?: string | null
          billing_type?: string
          created_at?: string
          empresa_id?: string
          id?: string
          paid_at?: string | null
          payment_metadata?: Json | null
          quantidade_pacotes?: number
          status?: string
          tier_id?: string | null
          tokens_pacote?: number
          user_id?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "pilar_token_pack_purchases_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_download_logs: {
        Row: {
          arquivo_path: string | null
          cliente_id: string | null
          created_at: string
          empresa_id: string
          entrega_id: string | null
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          arquivo_path?: string | null
          cliente_id?: string | null
          created_at?: string
          empresa_id: string
          entrega_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          arquivo_path?: string | null
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string
          entrega_id?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_download_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_download_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_entregas: {
        Row: {
          aprovado_ip: unknown
          aprovado_user_agent: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          drive_url: string | null
          empresa_id: string
          id: string
          projeto_disciplina_id: string | null
          projeto_id: string
          respondido_em: string | null
          resposta_cliente: string | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          aprovado_ip?: unknown
          aprovado_user_agent?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          drive_url?: string | null
          empresa_id: string
          id?: string
          projeto_disciplina_id?: string | null
          projeto_id: string
          respondido_em?: string | null
          resposta_cliente?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          aprovado_ip?: unknown
          aprovado_user_agent?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          drive_url?: string | null
          empresa_id?: string
          id?: string
          projeto_disciplina_id?: string | null
          projeto_id?: string
          respondido_em?: string | null
          resposta_cliente?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_entregas_projeto_disciplina_id_fkey"
            columns: ["projeto_disciplina_id"]
            isOneToOne: false
            referencedRelation: "projeto_disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_entregas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_entregas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          contato: string | null
          created_at: string | null
          created_by: string | null
          email: string
          empresa_id: string
          equipe_delegado: boolean
          financeiro_delegado: boolean
          first_name: string
          id: string
          last_name: string
          metas_delegado: boolean
          nome: string | null
          onboarding_completed: boolean | null
          onboarding_state: Json
          painel_layout: Json
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          contato?: string | null
          created_at?: string | null
          created_by?: string | null
          email: string
          empresa_id: string
          equipe_delegado?: boolean
          financeiro_delegado?: boolean
          first_name?: string
          id: string
          last_name?: string
          metas_delegado?: boolean
          nome?: string | null
          onboarding_completed?: boolean | null
          onboarding_state?: Json
          painel_layout?: Json
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          contato?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          empresa_id?: string
          equipe_delegado?: boolean
          financeiro_delegado?: boolean
          first_name?: string
          id?: string
          last_name?: string
          metas_delegado?: boolean
          nome?: string | null
          onboarding_completed?: boolean | null
          onboarding_state?: Json
          painel_layout?: Json
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_disciplina_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          duracao_dias_uteis: number | null
          horas_estimadas: number | null
          id: string
          ordem: number
          projeto_disciplina_id: string
          texto: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          duracao_dias_uteis?: number | null
          horas_estimadas?: number | null
          id?: string
          ordem?: number
          projeto_disciplina_id: string
          texto: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          duracao_dias_uteis?: number | null
          horas_estimadas?: number | null
          id?: string
          ordem?: number
          projeto_disciplina_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_disciplina_checklist_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_checklist_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_checklist_concluido_por_fkey"
            columns: ["concluido_por"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "projeto_disciplina_checklist_projeto_disciplina_id_fkey"
            columns: ["projeto_disciplina_id"]
            isOneToOne: false
            referencedRelation: "projeto_disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_disciplina_checklist_responsaveis: {
        Row: {
          checklist_item_id: string
          created_at: string
          id: string
          pessoa_id: string
        }
        Insert: {
          checklist_item_id: string
          created_at?: string
          id?: string
          pessoa_id: string
        }
        Update: {
          checklist_item_id?: string
          created_at?: string
          id?: string
          pessoa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_disciplina_checklist_responsavei_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "projeto_disciplina_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_checklist_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_checklist_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_checklist_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      projeto_disciplina_pausas: {
        Row: {
          created_at: string
          id: string
          motivo: string
          pausado_em: string
          pausado_por: string | null
          projeto_disciplina_id: string
          retomado_em: string | null
          retomado_por: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          motivo: string
          pausado_em?: string
          pausado_por?: string | null
          projeto_disciplina_id: string
          retomado_em?: string | null
          retomado_por?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string
          pausado_em?: string
          pausado_por?: string | null
          projeto_disciplina_id?: string
          retomado_em?: string | null
          retomado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_disciplina_pausas_pausado_por_fkey"
            columns: ["pausado_por"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_pausas_pausado_por_fkey"
            columns: ["pausado_por"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_pausas_pausado_por_fkey"
            columns: ["pausado_por"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "projeto_disciplina_pausas_projeto_disciplina_id_fkey"
            columns: ["projeto_disciplina_id"]
            isOneToOne: false
            referencedRelation: "projeto_disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_pausas_retomado_por_fkey"
            columns: ["retomado_por"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_pausas_retomado_por_fkey"
            columns: ["retomado_por"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_pausas_retomado_por_fkey"
            columns: ["retomado_por"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      projeto_disciplina_responsaveis: {
        Row: {
          id: string
          pessoa_id: string
          projeto_disciplina_id: string
        }
        Insert: {
          id?: string
          pessoa_id: string
          projeto_disciplina_id: string
        }
        Update: {
          id?: string
          pessoa_id?: string
          projeto_disciplina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_disciplina_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "projeto_disciplina_responsaveis_projeto_disciplina_id_fkey"
            columns: ["projeto_disciplina_id"]
            isOneToOne: false
            referencedRelation: "projeto_disciplinas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_disciplina_revisoes: {
        Row: {
          concluida_em: string | null
          concluida_por: string | null
          created_at: string
          id: string
          motivo: string
          projeto_disciplina_id: string
          registrada_por: string | null
          solicitada_em: string
        }
        Insert: {
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          id?: string
          motivo: string
          projeto_disciplina_id: string
          registrada_por?: string | null
          solicitada_em?: string
        }
        Update: {
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          id?: string
          motivo?: string
          projeto_disciplina_id?: string
          registrada_por?: string | null
          solicitada_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_disciplina_revisoes_concluida_por_fkey"
            columns: ["concluida_por"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_revisoes_concluida_por_fkey"
            columns: ["concluida_por"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_revisoes_concluida_por_fkey"
            columns: ["concluida_por"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "projeto_disciplina_revisoes_projeto_disciplina_id_fkey"
            columns: ["projeto_disciplina_id"]
            isOneToOne: false
            referencedRelation: "projeto_disciplinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_revisoes_registrada_por_fkey"
            columns: ["registrada_por"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_revisoes_registrada_por_fkey"
            columns: ["registrada_por"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplina_revisoes_registrada_por_fkey"
            columns: ["registrada_por"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      projeto_disciplinas: {
        Row: {
          codigo: string | null
          comentarios: Json
          created_at: string | null
          custo_hora: number | null
          data_fim: string | null
          data_fim_real: string | null
          data_inicio: string | null
          descricao: string | null
          horas_estimadas: number | null
          horas_realizadas: number
          id: string
          justificativa_atraso: string | null
          labels: string[]
          links: Json
          nome: string
          observacoes: string | null
          ordem_etapa: number | null
          prioridade: string | null
          projeto_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          codigo?: string | null
          comentarios?: Json
          created_at?: string | null
          custo_hora?: number | null
          data_fim?: string | null
          data_fim_real?: string | null
          data_inicio?: string | null
          descricao?: string | null
          horas_estimadas?: number | null
          horas_realizadas?: number
          id?: string
          justificativa_atraso?: string | null
          labels?: string[]
          links?: Json
          nome: string
          observacoes?: string | null
          ordem_etapa?: number | null
          prioridade?: string | null
          projeto_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string | null
          comentarios?: Json
          created_at?: string | null
          custo_hora?: number | null
          data_fim?: string | null
          data_fim_real?: string | null
          data_inicio?: string | null
          descricao?: string | null
          horas_estimadas?: number | null
          horas_realizadas?: number
          id?: string
          justificativa_atraso?: string | null
          labels?: string[]
          links?: Json
          nome?: string
          observacoes?: string | null
          ordem_etapa?: number | null
          prioridade?: string | null
          projeto_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_disciplinas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_disciplinas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_etapas: {
        Row: {
          bucket: Database["public"]["Enums"]["status_projeto"]
          cor: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          bucket?: Database["public"]["Enums"]["status_projeto"]
          cor?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          bucket?: Database["public"]["Enums"]["status_projeto"]
          cor?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_orcamento_fases: {
        Row: {
          created_at: string | null
          created_by: string | null
          custo_estimado: number | null
          custo_hora: number | null
          deleted_at: string | null
          disciplina: string
          empresa_id: string
          horas_estimadas: number | null
          id: string
          margem_alvo_pct: number | null
          observacao: string | null
          projeto_id: string
          updated_at: string | null
          updated_by: string | null
          valor_venda: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          custo_hora?: number | null
          deleted_at?: string | null
          disciplina: string
          empresa_id: string
          horas_estimadas?: number | null
          id?: string
          margem_alvo_pct?: number | null
          observacao?: string | null
          projeto_id: string
          updated_at?: string | null
          updated_by?: string | null
          valor_venda?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          custo_hora?: number | null
          deleted_at?: string | null
          disciplina?: string
          empresa_id?: string
          horas_estimadas?: number | null
          id?: string
          margem_alvo_pct?: number | null
          observacao?: string | null
          projeto_id?: string
          updated_at?: string | null
          updated_by?: string | null
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_orcamento_fases_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_orcamento_fases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_orcamento_fases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          area_m2: number | null
          cliente_id: string | null
          codigo_projeto: string | null
          comentarios: Json
          created_at: string | null
          created_by: string | null
          custo_indireto_pct: number | null
          data_final: string | null
          data_inicio: string | null
          data_previsao: string | null
          deleted_at: string | null
          disciplinas: Json | null
          empresa_id: string
          etapa_id: string | null
          id: string
          latitude: number | null
          links: Json
          localizacao: string | null
          longitude: number | null
          nome: string
          observacao: string | null
          parcelas: string | null
          prioridade: string
          status: Database["public"]["Enums"]["status_projeto"] | null
          status_data: string | null
          updated_at: string | null
          updated_by: string | null
          valor_contrato: number | null
        }
        Insert: {
          area_m2?: number | null
          cliente_id?: string | null
          codigo_projeto?: string | null
          comentarios?: Json
          created_at?: string | null
          created_by?: string | null
          custo_indireto_pct?: number | null
          data_final?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          deleted_at?: string | null
          disciplinas?: Json | null
          empresa_id: string
          etapa_id?: string | null
          id?: string
          latitude?: number | null
          links?: Json
          localizacao?: string | null
          longitude?: number | null
          nome: string
          observacao?: string | null
          parcelas?: string | null
          prioridade?: string
          status?: Database["public"]["Enums"]["status_projeto"] | null
          status_data?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_contrato?: number | null
        }
        Update: {
          area_m2?: number | null
          cliente_id?: string | null
          codigo_projeto?: string | null
          comentarios?: Json
          created_at?: string | null
          created_by?: string | null
          custo_indireto_pct?: number | null
          data_final?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          deleted_at?: string | null
          disciplinas?: Json | null
          empresa_id?: string
          etapa_id?: string | null
          id?: string
          latitude?: number | null
          links?: Json
          localizacao?: string | null
          longitude?: number | null
          nome?: string
          observacao?: string | null
          parcelas?: string | null
          prioridade?: string
          status?: Database["public"]["Enums"]["status_projeto"] | null
          status_data?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "projeto_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_disciplinas: {
        Row: {
          created_at: string | null
          custo_hora: number | null
          disciplina: string
          empresa_id: string
          horas_estimadas: number | null
          id: string
          proposta_id: string
          valor_venda: number | null
        }
        Insert: {
          created_at?: string | null
          custo_hora?: number | null
          disciplina: string
          empresa_id: string
          horas_estimadas?: number | null
          id?: string
          proposta_id: string
          valor_venda?: number | null
        }
        Update: {
          created_at?: string | null
          custo_hora?: number | null
          disciplina?: string
          empresa_id?: string
          horas_estimadas?: number | null
          id?: string
          proposta_id?: string
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_disciplinas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_disciplinas_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_templates: {
        Row: {
          arquivo_path: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          tipo: string
          updated_at: string | null
          variaveis: string[] | null
        }
        Insert: {
          arquivo_path: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          tipo?: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Update: {
          arquivo_path?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          area_m2: number | null
          campos_extras: Json | null
          cliente_id: string | null
          codigo: string | null
          conteudo: Json | null
          contrato_assinado: boolean
          contrato_enviado: boolean
          contrato_recusado: boolean
          created_at: string | null
          created_by: string | null
          custo_estimado: number | null
          dados_simulacao: Json | null
          deleted_at: string | null
          documento_path: string | null
          empresa_id: string
          id: string
          lead_id: string | null
          localizacao: string | null
          margem_estimada_pct: number | null
          observacao: string | null
          prazo_estimado_dias: number | null
          projeto_id: string | null
          status: string | null
          template_id: string | null
          titulo: string
          updated_at: string | null
          updated_by: string | null
          validade: string | null
          valor_proposto: number | null
        }
        Insert: {
          area_m2?: number | null
          campos_extras?: Json | null
          cliente_id?: string | null
          codigo?: string | null
          conteudo?: Json | null
          contrato_assinado?: boolean
          contrato_enviado?: boolean
          contrato_recusado?: boolean
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          dados_simulacao?: Json | null
          deleted_at?: string | null
          documento_path?: string | null
          empresa_id: string
          id?: string
          lead_id?: string | null
          localizacao?: string | null
          margem_estimada_pct?: number | null
          observacao?: string | null
          prazo_estimado_dias?: number | null
          projeto_id?: string | null
          status?: string | null
          template_id?: string | null
          titulo: string
          updated_at?: string | null
          updated_by?: string | null
          validade?: string | null
          valor_proposto?: number | null
        }
        Update: {
          area_m2?: number | null
          campos_extras?: Json | null
          cliente_id?: string | null
          codigo?: string | null
          conteudo?: Json | null
          contrato_assinado?: boolean
          contrato_enviado?: boolean
          contrato_recusado?: boolean
          created_at?: string | null
          created_by?: string | null
          custo_estimado?: number | null
          dados_simulacao?: Json | null
          deleted_at?: string | null
          documento_path?: string | null
          empresa_id?: string
          id?: string
          lead_id?: string | null
          localizacao?: string | null
          margem_estimada_pct?: number | null
          observacao?: string | null
          prazo_estimado_dias?: number | null
          projeto_id?: string | null
          status?: string | null
          template_id?: string | null
          titulo?: string
          updated_at?: string | null
          updated_by?: string | null
          validade?: string | null
          valor_proposto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposta_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_attempts: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      receitas: {
        Row: {
          asaas_billing_type: string | null
          asaas_payment_id: string | null
          asaas_payment_status: string | null
          asaas_payment_url: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          conta_id: string | null
          created_at: string | null
          created_by: string | null
          data_competencia: string | null
          data_recebimento: string | null
          data_vencimento: string | null
          deleted_at: string | null
          descricao: string
          empresa_id: string
          forma_pagamento: string | null
          grupo_parcela: string | null
          id: string
          import_batch_id: string | null
          import_line_hash: string | null
          nota_fiscal: string | null
          obra_lancamento_origem_id: string | null
          observacao: string | null
          parcela_numero: number | null
          parcela_total: number | null
          projeto_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"] | null
          tags: string[] | null
          updated_at: string | null
          updated_by: string | null
          valor: number
        }
        Insert: {
          asaas_billing_type?: string | null
          asaas_payment_id?: string | null
          asaas_payment_status?: string | null
          asaas_payment_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_competencia?: string | null
          data_recebimento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          descricao: string
          empresa_id: string
          forma_pagamento?: string | null
          grupo_parcela?: string | null
          id?: string
          import_batch_id?: string | null
          import_line_hash?: string | null
          nota_fiscal?: string | null
          obra_lancamento_origem_id?: string | null
          observacao?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          valor: number
        }
        Update: {
          asaas_billing_type?: string | null
          asaas_payment_id?: string | null
          asaas_payment_status?: string | null
          asaas_payment_url?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_competencia?: string | null
          data_recebimento?: string | null
          data_vencimento?: string | null
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string
          forma_pagamento?: string | null
          grupo_parcela?: string | null
          id?: string
          import_batch_id?: string | null
          import_line_hash?: string | null
          nota_fiscal?: string | null
          obra_lancamento_origem_id?: string | null
          observacao?: string | null
          parcela_numero?: number | null
          parcela_total?: number | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "receitas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_obra_lancamento_origem_id_fkey"
            columns: ["obra_lancamento_origem_id"]
            isOneToOne: false
            referencedRelation: "obra_conta_lancamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receitas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      status_components: {
        Row: {
          id: string
          nome_exibicao: string
          ordem: number
          slug: string
        }
        Insert: {
          id?: string
          nome_exibicao: string
          ordem?: number
          slug: string
        }
        Update: {
          id?: string
          nome_exibicao?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      status_incident_components: {
        Row: {
          component_id: string
          incident_id: string
        }
        Insert: {
          component_id: string
          incident_id: string
        }
        Update: {
          component_id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_incident_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "status_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_incident_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "status_current"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_incident_components_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "status_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      status_incident_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          incident_id: string
          mensagem: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id: string
          mensagem: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          incident_id?: string
          mensagem?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "status_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      status_incidents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          resolved_at: string | null
          severidade: string
          status: string
          titulo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          severidade: string
          status?: string
          titulo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          severidade?: string
          status?: string
          titulo?: string
        }
        Relationships: []
      }
      tarefa_contadores: {
        Row: {
          empresa_id: string
          ultimo: number
        }
        Insert: {
          empresa_id: string
          ultimo?: number
        }
        Update: {
          empresa_id?: string
          ultimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_contadores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_etapas: {
        Row: {
          bucket: string | null
          cor: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          bucket?: string | null
          cor?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          bucket?: string | null
          cor?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_etapas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_responsaveis: {
        Row: {
          created_at: string
          empresa_id: string
          pessoa_id: string
          tarefa_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          pessoa_id: string
          tarefa_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          pessoa_id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_responsaveis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_responsaveis_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "tarefa_responsaveis_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          comentarios: Json
          created_at: string
          created_by: string | null
          data_inicio: string | null
          descricao: string | null
          empresa_id: string
          etapa_id: string | null
          horas_estimadas: number | null
          horas_reais: number | null
          id: string
          labels: string[]
          links: Json
          numero: number
          obra_frente_id: string | null
          obra_id: string | null
          prazo: string | null
          prioridade: string
          projeto_id: string | null
          responsavel_id: string | null
          sensivel_clima: string | null
          sinalizada: boolean
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          comentarios?: Json
          created_at?: string
          created_by?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id: string
          etapa_id?: string | null
          horas_estimadas?: number | null
          horas_reais?: number | null
          id?: string
          labels?: string[]
          links?: Json
          numero?: number
          obra_frente_id?: string | null
          obra_id?: string | null
          prazo?: string | null
          prioridade?: string
          projeto_id?: string | null
          responsavel_id?: string | null
          sensivel_clima?: string | null
          sinalizada?: boolean
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          comentarios?: Json
          created_at?: string
          created_by?: string | null
          data_inicio?: string | null
          descricao?: string | null
          empresa_id?: string
          etapa_id?: string | null
          horas_estimadas?: number | null
          horas_reais?: number | null
          id?: string
          labels?: string[]
          links?: Json
          numero?: number
          obra_frente_id?: string | null
          obra_id?: string | null
          prazo?: string | null
          prioridade?: string
          projeto_id?: string | null
          responsavel_id?: string | null
          sensivel_clima?: string | null
          sinalizada?: boolean
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "tarefa_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_obra_frente_id_fkey"
            columns: ["obra_frente_id"]
            isOneToOne: false
            referencedRelation: "obra_frente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "pessoas_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "view_folha_pagamento"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      templates_projeto: {
        Row: {
          ativo: boolean | null
          checklist: Json | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          fases: Json
          id: string
          nome: string
          tipo_servico: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          fases?: Json
          id?: string
          nome: string
          tipo_servico: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean | null
          checklist?: Json | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          fases?: Json
          id?: string
          nome?: string
          tipo_servico?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_projeto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          empresa_id: string | null
          id: string
          privacy_version: string
          source: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          empresa_id?: string | null
          id?: string
          privacy_version: string
          source: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          empresa_id?: string | null
          id?: string
          privacy_version?: string
          source?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_lancamentos: {
        Row: {
          aprovado_por: string | null
          created_at: string | null
          data: string
          descricao: string
          empresa_id: string
          fase_id: string | null
          horas: number
          id: string
          projeto_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string | null
          data?: string
          descricao: string
          empresa_id: string
          fase_id?: string | null
          horas: number
          id?: string
          projeto_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string | null
          data?: string
          descricao?: string
          empresa_id?: string
          fase_id?: string | null
          horas?: number
          id?: string
          projeto_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_lancamentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "v_uso_tokens_usuario_ciclo"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "projeto_orcamento_fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "v_budget_vs_actual"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_lancamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_uso_tokens_usuario_ciclo"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transferencias: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          created_by: string | null
          data_transferencia: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          observacao: string | null
          status: string
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string
          created_by?: string | null
          data_transferencia: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor: number
        }
        Update: {
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string
          created_by?: string | null
          data_transferencia?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "transferencias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_conta_origem_id_fkey"
            columns: ["conta_origem_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "transferencias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ultra_admin_modes: {
        Row: {
          scoped: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          scoped?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          scoped?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      lancamentos: {
        Row: {
          asaas_billing_type: string | null
          asaas_payment_id: string | null
          asaas_payment_status: string | null
          asaas_payment_url: string | null
          cartao_id: string | null
          categoria_id: string | null
          categoria_nome: string | null
          centro_custo_id: string | null
          conta_id: string | null
          conta_nome: string | null
          contraparte_id: string | null
          contraparte_nome: string | null
          contraparte_tipo: string | null
          created_at: string | null
          created_by: string | null
          data_competencia: string | null
          data_efetivacao: string | null
          data_vencimento: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string | null
          fatura_id: string | null
          forma_pagamento: string | null
          grupo_parcela: string | null
          grupo_status: string | null
          grupo_tipo: string | null
          grupo_total_original: number | null
          id: string | null
          is_fatura_payment: boolean | null
          nota_fiscal: string | null
          observacao: string | null
          parcela_numero: number | null
          parcela_total: number | null
          periodicidade: string | null
          projeto_codigo: string | null
          projeto_id: string | null
          recorrente: boolean | null
          status: string | null
          tags: string[] | null
          tipo: string | null
          transferencia_par_id: string | null
          updated_at: string | null
          updated_by: string | null
          valor: number | null
        }
        Relationships: []
      }
      leads_safe: {
        Row: {
          cliente_id: string | null
          cnpj: string | null
          contato: string | null
          convertido_em: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string | null
          empresa_lead: string | null
          id: string | null
          motivo_perda: string | null
          nome: string | null
          notas: string | null
          origem: string | null
          pode_ver_valor: boolean | null
          previsao_fechamento: string | null
          responsavel_id: string | null
          sobrenome: string | null
          status: string | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          cliente_id?: string | null
          cnpj?: string | null
          contato?: string | null
          convertido_em?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          empresa_lead?: string | null
          id?: string | null
          motivo_perda?: string | null
          nome?: string | null
          notas?: string | null
          origem?: string | null
          pode_ver_valor?: never
          previsao_fechamento?: string | null
          responsavel_id?: string | null
          sobrenome?: string | null
          status?: string | null
          updated_at?: string | null
          valor_estimado?: never
        }
        Update: {
          cliente_id?: string | null
          cnpj?: string | null
          contato?: string | null
          convertido_em?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          empresa_lead?: string | null
          id?: string | null
          motivo_perda?: string | null
          nome?: string | null
          notas?: string | null
          origem?: string | null
          pode_ver_valor?: never
          previsao_fechamento?: string | null
          responsavel_id?: string | null
          sobrenome?: string | null
          status?: string | null
          updated_at?: string | null
          valor_estimado?: never
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_safe: {
        Row: {
          cargo: string | null
          chaves_pix: Json | null
          cnpj: string | null
          contas_bancarias: Json | null
          cpf: string | null
          created_at: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          horas_semanais: number | null
          id: string | null
          nome: string | null
          pis_nit: string | null
          pode_ver_sensivel: boolean | null
          primeiro_nome: string | null
          profile_id: string | null
          razao_social: string | null
          rg: string | null
          salario_fixo: number | null
          sobrenome: string | null
          status: string | null
          telefone: string | null
          tipo_contrato: string | null
          updated_at: string | null
          valor_m2: number | null
        }
        Insert: {
          cargo?: string | null
          chaves_pix?: never
          cnpj?: string | null
          contas_bancarias?: never
          cpf?: never
          created_at?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          horas_semanais?: number | null
          id?: string | null
          nome?: string | null
          pis_nit?: string | null
          pode_ver_sensivel?: never
          primeiro_nome?: string | null
          profile_id?: string | null
          razao_social?: string | null
          rg?: string | null
          salario_fixo?: never
          sobrenome?: string | null
          status?: string | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
          valor_m2?: never
        }
        Update: {
          cargo?: string | null
          chaves_pix?: never
          cnpj?: string | null
          contas_bancarias?: never
          cpf?: never
          created_at?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          horas_semanais?: number | null
          id?: string | null
          nome?: string | null
          pis_nit?: string | null
          pode_ver_sensivel?: never
          primeiro_nome?: string | null
          profile_id?: string | null
          razao_social?: string | null
          rg?: string | null
          salario_fixo?: never
          sobrenome?: string | null
          status?: string | null
          telefone?: string | null
          tipo_contrato?: string | null
          updated_at?: string | null
          valor_m2?: never
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_uso_tokens_usuario_ciclo"
            referencedColumns: ["user_id"]
          },
        ]
      }
      projetos_safe: {
        Row: {
          area_m2: number | null
          cliente_id: string | null
          codigo_projeto: string | null
          comentarios: Json | null
          created_at: string | null
          created_by: string | null
          custo_indireto_pct: number | null
          data_final: string | null
          data_inicio: string | null
          data_previsao: string | null
          deleted_at: string | null
          disciplinas: Json | null
          empresa_id: string | null
          etapa_id: string | null
          id: string | null
          latitude: number | null
          links: Json | null
          localizacao: string | null
          longitude: number | null
          nome: string | null
          observacao: string | null
          parcelas: string | null
          pode_ver_valor: boolean | null
          prioridade: string | null
          status: Database["public"]["Enums"]["status_projeto"] | null
          status_data: string | null
          updated_at: string | null
          updated_by: string | null
          valor_contrato: number | null
        }
        Insert: {
          area_m2?: number | null
          cliente_id?: string | null
          codigo_projeto?: string | null
          comentarios?: Json | null
          created_at?: string | null
          created_by?: string | null
          custo_indireto_pct?: never
          data_final?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          deleted_at?: string | null
          disciplinas?: Json | null
          empresa_id?: string | null
          etapa_id?: string | null
          id?: string | null
          latitude?: number | null
          links?: Json | null
          localizacao?: string | null
          longitude?: number | null
          nome?: string | null
          observacao?: string | null
          parcelas?: string | null
          pode_ver_valor?: never
          prioridade?: string | null
          status?: Database["public"]["Enums"]["status_projeto"] | null
          status_data?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_contrato?: never
        }
        Update: {
          area_m2?: number | null
          cliente_id?: string | null
          codigo_projeto?: string | null
          comentarios?: Json | null
          created_at?: string | null
          created_by?: string | null
          custo_indireto_pct?: never
          data_final?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          deleted_at?: string | null
          disciplinas?: Json | null
          empresa_id?: string | null
          etapa_id?: string | null
          id?: string | null
          latitude?: number | null
          links?: Json | null
          localizacao?: string | null
          longitude?: number | null
          nome?: string | null
          observacao?: string | null
          parcelas?: string | null
          pode_ver_valor?: never
          prioridade?: string | null
          status?: Database["public"]["Enums"]["status_projeto"] | null
          status_data?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_contrato?: never
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "projeto_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      status_current: {
        Row: {
          id: string | null
          nome_exibicao: string | null
          ordem: number | null
          slug: string | null
          status_efetivo: string | null
        }
        Insert: {
          id?: string | null
          nome_exibicao?: string | null
          ordem?: number | null
          slug?: string | null
          status_efetivo?: never
        }
        Update: {
          id?: string | null
          nome_exibicao?: string | null
          ordem?: number | null
          slug?: string | null
          status_efetivo?: never
        }
        Relationships: []
      }
      v_budget_vs_actual: {
        Row: {
          custo_orcado: number | null
          custo_real: number | null
          disciplina: string | null
          empresa_id: string | null
          horas_orcadas: number | null
          horas_reais: number | null
          id: string | null
          pct_consumido: number | null
          projeto_id: string | null
          status_orcamento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_orcamento_fases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_orcamento_fases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_extrato_tokens: {
        Row: {
          agent_key: string | null
          created_at: string | null
          custo_estimado: number | null
          empresa_id: string | null
          id: string | null
          model: string | null
          source: string | null
          tokens_input: number | null
          tokens_output: number | null
          tokens_total: number | null
          user_id: string | null
          user_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_ledger_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_uso_tokens_anomalia_diaria: {
        Row: {
          anomalia: boolean | null
          dias_com_uso_anteriores: number | null
          empresa_id: string | null
          media_dias_anteriores: number | null
          tokens_hoje: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_ledger_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_uso_tokens_por_agente: {
        Row: {
          agent_key: string | null
          custo_estimado: number | null
          empresa_id: string | null
          eventos: number | null
          mes: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_ledger_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_uso_tokens_por_empresa: {
        Row: {
          custo_estimado: number | null
          empresa_id: string | null
          eventos: number | null
          mes: string | null
          tokens_input: number | null
          tokens_output: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_ledger_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_uso_tokens_por_usuario: {
        Row: {
          agent_key: string | null
          custo_estimado: number | null
          empresa_id: string | null
          eventos: number | null
          mes: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_token_ledger_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_uso_tokens_usuario_ciclo: {
        Row: {
          empresa_id: string | null
          limite_mensal: number | null
          role: Database["public"]["Enums"]["user_role"] | null
          solicitacao_pendente: boolean | null
          tokens_ciclo: number | null
          user_id: string | null
          user_nome: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_cartao_resumo: {
        Row: {
          conta_pagamento_id: string | null
          cor: string | null
          dia_fechamento: number | null
          dia_vencimento: number | null
          disponivel: number | null
          empresa_id: string | null
          id: string | null
          limite: number | null
          nome: string | null
          tipo: string | null
          usado: number | null
        }
        Insert: {
          conta_pagamento_id?: string | null
          cor?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          disponivel?: never
          empresa_id?: string | null
          id?: string | null
          limite?: number | null
          nome?: string | null
          tipo?: string | null
          usado?: never
        }
        Update: {
          conta_pagamento_id?: string | null
          cor?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          disponivel?: never
          empresa_id?: string | null
          id?: string | null
          limite?: number | null
          nome?: string | null
          tipo?: string | null
          usado?: never
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "cartoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_fatura_resumo: {
        Row: {
          ano_referencia: number | null
          cartao_cor: string | null
          cartao_id: string | null
          cartao_nome: string | null
          conta_pagamento_id: string | null
          conta_pagamento_nome: string | null
          data_fim: string | null
          data_inicio: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          empresa_id: string | null
          id: string | null
          mes_referencia: number | null
          qtd_despesas: number | null
          status: string | null
          valor_pago: number | null
          valor_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "view_cartao_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_conta_pagamento_id_fkey"
            columns: ["conta_pagamento_id"]
            isOneToOne: false
            referencedRelation: "view_financas_resumo"
            referencedColumns: ["conta_id"]
          },
          {
            foreignKeyName: "faturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_financas_resumo: {
        Row: {
          banco: string | null
          conta_id: string | null
          conta_nome: string | null
          cor: string | null
          empresa_id: string | null
          saldo_atual: number | null
          saldo_inicial: number | null
          total_entradas: number | null
          total_saidas: number | null
        }
        Insert: {
          banco?: string | null
          conta_id?: string | null
          conta_nome?: string | null
          cor?: string | null
          empresa_id?: string | null
          saldo_atual?: never
          saldo_inicial?: number | null
          total_entradas?: never
          total_saidas?: never
        }
        Update: {
          banco?: string | null
          conta_id?: string | null
          conta_nome?: string | null
          cor?: string | null
          empresa_id?: string | null
          saldo_atual?: never
          saldo_inicial?: number | null
          total_entradas?: never
          total_saidas?: never
        }
        Relationships: [
          {
            foreignKeyName: "contas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      view_folha_pagamento: {
        Row: {
          cargo: string | null
          empresa_id: string | null
          pessoa_id: string | null
          pessoa_nome: string | null
          qtd_projetos: number | null
          salario_fixo: number | null
          total_area_m2: number | null
          total_comissao: number | null
          total_receber: number | null
          valor_m2: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _campo_create_account: {
        Args: {
          p_created_by: string
          p_email: string
          p_empresa_id: string
          p_nome: string
          p_obra_id: string
          p_senha: string
        }
        Returns: string
      }
      _campo_registrar_foto: {
        Args: { p_path: string; p_rdo_id: string; p_token: string }
        Returns: Json
      }
      _feature_catalog: { Args: never; Returns: string[] }
      _finance_display_date: {
        Args: { p_efetivacao: string; p_status: string; p_vencimento: string }
        Returns: string
      }
      _notif_gestao: { Args: { p_empresa: string }; Returns: string[] }
      _notif_gestao_operacional: {
        Args: { p_empresa: string }
        Returns: string[]
      }
      _notif_resp_disciplina: {
        Args: { p_disciplina: string }
        Returns: string[]
      }
      _notif_resp_projeto: { Args: { p_projeto: string }; Returns: string[] }
      _notif_resp_tarefa: { Args: { p_tarefa: string }; Returns: string[] }
      _notif_ve_financeiro: { Args: { p_empresa: string }; Returns: string[] }
      _portal_create_account: {
        Args: {
          p_cliente_id: string
          p_created_by: string
          p_email: string
          p_empresa_id: string
          p_nome: string
          p_senha: string
        }
        Returns: undefined
      }
      _portal_reset_password: {
        Args: { p_account_id: string; p_nova_senha: string }
        Returns: undefined
      }
      _soft_delete_feature: { Args: { p_tabela: string }; Returns: string }
      _soft_delete_guard: { Args: { p_tabela: string }; Returns: string }
      _universal_features: { Args: never; Returns: string[] }
      admin_create_company_owner: {
        Args: { p_company_name?: string; p_email: string; p_nome: string }
        Returns: Json
      }
      admin_create_convite: {
        Args: {
          p_cargo: string
          p_email: string
          p_empresa_id: string
          p_nome?: string
        }
        Returns: string
      }
      aprovar_orcamento_agente: { Args: { p_run_id: string }; Returns: Json }
      audit_log_cleanup: { Args: never; Returns: number }
      audit_log_cleanup_monitored: { Args: never; Returns: undefined }
      audit_logs_archive_old: { Args: never; Returns: number }
      campo_criar_tarefa: {
        Args: { p_titulo: string; p_token: string }
        Returns: Json
      }
      campo_listar_fornecedores: { Args: { p_token: string }; Returns: Json }
      campo_listar_rdos: {
        Args: { p_limite?: number; p_token: string }
        Returns: Json
      }
      campo_listar_tarefas: { Args: { p_token: string }; Returns: Json }
      campo_login: { Args: { p_email: string; p_senha: string }; Returns: Json }
      campo_registrar_efetivo: {
        Args: {
          p_fornecedor_id: string
          p_fornecedor_nome: string
          p_quantidade: number
          p_rdo_id: string
          p_token: string
        }
        Returns: Json
      }
      campo_registrar_impedimento: {
        Args: {
          p_descricao: string
          p_rdo_id: string
          p_tipo: string
          p_token: string
        }
        Returns: Json
      }
      campo_registrar_medicao: {
        Args: {
          p_item: string
          p_quantidade: number
          p_rdo_id: string
          p_token: string
          p_unidade: string
        }
        Returns: Json
      }
      campo_registrar_tarefa_rdo: {
        Args: {
          p_observacao: string
          p_rdo_id: string
          p_resultado: string
          p_tarefa_id: string
          p_token: string
        }
        Returns: Json
      }
      campo_registrar_visita: {
        Args: {
          p_fornecedor_id: string
          p_fornecedor_nome: string
          p_observacao: string
          p_rdo_id: string
          p_token: string
        }
        Returns: Json
      }
      campo_salvar_rdo: {
        Args: {
          p_atividades: string
          p_clima: string
          p_condicao: string
          p_data: string
          p_efetivo: number
          p_ocorrencias: string
          p_pendencias: string
          p_token: string
        }
        Returns: Json
      }
      campo_trocar_senha: {
        Args: { p_nova_senha: string; p_token: string }
        Returns: Json
      }
      campo_verify_session: { Args: { p_token: string }; Returns: Json }
      can_manage_equipe: { Args: never; Returns: boolean }
      can_view_financeiro: { Args: never; Returns: boolean }
      can_view_folha: { Args: never; Returns: boolean }
      check_convite_rate_limit: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          p_bucket: string
          p_key: string
          p_max: number
          p_window: number
        }
        Returns: boolean
      }
      claim_next_job: {
        Args: { p_tipos?: string[] }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          empresa_id: string
          error: string | null
          id: string
          input: Json
          max_attempts: number
          progress: number
          result: Json | null
          stage: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          tipo: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cleanup_expired_pending_signups: { Args: never; Returns: number }
      cleanup_expired_pending_signups_monitored: {
        Args: never
        Returns: undefined
      }
      cleanup_pending_signups: { Args: never; Returns: number }
      create_convite: {
        Args: { p_cargo: string; p_email: string; p_nome?: string }
        Returns: string
      }
      create_portal_token: {
        Args: {
          p_cliente_id: string
          p_dias_validade?: number
          p_email_cliente?: string
          p_projeto_id: string
        }
        Returns: string
      }
      create_projeto_completo:
        | {
            Args: {
              p_area_m2?: number
              p_cliente_id: string
              p_codigo: string
              p_data_final?: string
              p_data_inicio?: string
              p_data_previsao?: string
              p_disciplinas?: Json
              p_localizacao?: string
              p_nome: string
              p_observacao?: string
              p_parcelas?: string
              p_prioridade?: string
              p_valor_contrato?: number
            }
            Returns: string
          }
        | {
            Args: {
              p_area_m2: number
              p_cliente_id: string
              p_codigo: string
              p_data_final: string
              p_data_inicio: string
              p_data_previsao: string
              p_disciplinas: Json
              p_localizacao: string
              p_nome: string
              p_observacao: string
              p_parcelas: string
              p_valor_contrato: number
            }
            Returns: string
          }
        | {
            Args: {
              p_cliente_id: string
              p_codigo: string
              p_data_final: string
              p_data_inicio: string
              p_data_previsao: string
              p_localizacao: string
              p_nome: string
              p_observacao: string
              p_parcelas: string
              p_responsaveis: Json
              p_valor_contrato: number
            }
            Returns: string
          }
      criar_aditivo_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_cartao_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_categoria_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_centro_custo_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_cliente_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_conta_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_despesa_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_disciplina_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_fornecedor_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_lead_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_marco_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_pessoa_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_projeto_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_proposta_agente: { Args: { p_run_id: string }; Returns: Json }
      criar_receita_agente: { Args: { p_run_id: string }; Returns: Json }
      current_effective_role: { Args: never; Returns: string }
      current_impersonation: {
        Args: never
        Returns: {
          admin_id: string
          admin_role: string
          ended_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          started_at: string
          target_role: string
          user_agent: string | null
        }
        SetofOptions: {
          from: "*"
          to: "impersonation_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_pessoa_id: { Args: never; Returns: string }
      debitar_tokens: {
        Args: {
          p_agent_key: string
          p_agent_run_id: string
          p_empresa_id: string
          p_idempotency_key: string
          p_model: string
          p_tokens_input: number
          p_tokens_output: number
          p_user_id: string
        }
        Returns: {
          custo_estimado: number
          saldo_comprado: number
          saldo_plano: number
        }[]
      }
      executar_acao_agente: { Args: { p_run_id: string }; Returns: Json }
      fechar_folha_agente: { Args: { p_run_id: string }; Returns: Json }
      find_or_create_fatura: {
        Args: { p_cartao_id: string; p_data_compra: string }
        Returns: string
      }
      gate_tokens: {
        Args: { p_empresa_id: string; p_user_id?: string }
        Returns: {
          bloqueado_motivo: string
          cota_ciclo: number
          saldo_comprado: number
          saldo_plano: number
        }[]
      }
      gerar_alertas_ambient: { Args: never; Returns: number }
      gerar_fatura: {
        Args: { p_ano: number; p_cartao_id: string; p_mes: number }
        Returns: string
      }
      gerar_notificacoes_ambient: { Args: never; Returns: number }
      gerar_notificacoes_ambient_monitored: { Args: never; Returns: undefined }
      get_asaas_api_key: { Args: { p_empresa_id: string }; Returns: string }
      get_cliente_obra_detail: {
        Args: { p_obra_id: string; p_token: string }
        Returns: Json
      }
      get_cliente_obras: { Args: { p_token: string }; Returns: Json }
      get_cliente_projeto_detail:
        | { Args: { p_projeto_id: string }; Returns: Json }
        | { Args: { p_projeto_id: string; p_token?: string }; Returns: Json }
      get_cliente_projetos:
        | { Args: never; Returns: Json[] }
        | { Args: { p_token?: string }; Returns: Json[] }
      get_finance_categorias: {
        Args: { p_data_fim?: string; p_data_inicio?: string; p_tipo: string }
        Returns: {
          categoria_nome: string
          count: number
          valor: number
        }[]
      }
      get_finance_chart_mensal: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: {
          despesas: number
          mes: string
          receitas: number
          sort_key: string
        }[]
      }
      get_finance_chart_periodo: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: {
          bucket_label: string
          despesas: number
          receitas: number
          sort_key: string
        }[]
      }
      get_finance_stats: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: Json
      }
      get_financial_chart_data: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_empresa_id: string
        }
        Returns: Json
      }
      get_folha_pessoas_pii: {
        Args: { p_ids: string[] }
        Returns: {
          chaves_pix: Json
          cpf: string
          pessoa_id: string
        }[]
      }
      get_folha_preview: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          cargo: string
          detalhe_projetos: Json
          nome: string
          pessoa_id: string
          projetos_nomes: string[]
          salario_fixo: number
          total_area: number
          total_receber: number
          total_variavel: number
          valor_m2: number
        }[]
      }
      get_grupos_parcela_resumo: {
        Args: { p_grupo_ids: string[] }
        Returns: {
          grupo_parcela: string
          pagas: number
          proxima_valor: number
          proxima_venc: string
          saldo: number
          status: string
          total_original: number
          total_pago: number
          total_parcelas: number
        }[]
      }
      get_lancamentos_kpis: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      get_lancamentos_pagina: {
        Args: {
          p_categorias?: string[]
          p_clientes?: string[]
          p_formas?: string[]
          p_fornecedores?: string[]
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_projetos?: string[]
          p_search?: string
          p_sort_dir?: string
          p_sort_key?: string
          p_status?: string
          p_tipo?: string
          p_to?: string
          p_valor_max?: number
          p_valor_min?: number
        }
        Returns: {
          asaas_billing_type: string | null
          asaas_payment_id: string | null
          asaas_payment_status: string | null
          asaas_payment_url: string | null
          cartao_id: string | null
          categoria_id: string | null
          categoria_nome: string | null
          centro_custo_id: string | null
          conta_id: string | null
          conta_nome: string | null
          contraparte_id: string | null
          contraparte_nome: string | null
          contraparte_tipo: string | null
          created_at: string | null
          created_by: string | null
          data_competencia: string | null
          data_efetivacao: string | null
          data_vencimento: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string | null
          fatura_id: string | null
          forma_pagamento: string | null
          grupo_parcela: string | null
          grupo_status: string | null
          grupo_tipo: string | null
          grupo_total_original: number | null
          id: string | null
          is_fatura_payment: boolean | null
          nota_fiscal: string | null
          observacao: string | null
          parcela_numero: number | null
          parcela_total: number | null
          periodicidade: string | null
          projeto_codigo: string | null
          projeto_id: string | null
          recorrente: boolean | null
          status: string | null
          tags: string[] | null
          tipo: string | null
          transferencia_par_id: string | null
          updated_at: string | null
          updated_by: string | null
          valor: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "lancamentos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_lancamentos_resumo: {
        Args: {
          p_categorias?: string[]
          p_clientes?: string[]
          p_formas?: string[]
          p_fornecedores?: string[]
          p_from?: string
          p_projetos?: string[]
          p_search?: string
          p_status?: string
          p_tipo?: string
          p_to?: string
          p_valor_max?: number
          p_valor_min?: number
        }
        Returns: Json
      }
      get_minhas_disciplinas: {
        Args: { p_pessoa_id?: string }
        Returns: {
          id: string
          labels: string[]
          links: Json
          prazo: string
          prioridade: string
          projeto_id: string
          projeto_nome: string
          responsavel_id: string
          responsavel_nome: string
          status_bucket: string
          status_raw: string
          titulo: string
        }[]
      }
      get_painel_extra: { Args: never; Returns: Json }
      get_painel_gestao: { Args: never; Returns: Json }
      get_projeto_rentabilidade_detalhe: {
        Args: { p_projeto_id: string }
        Returns: Json
      }
      get_user_empresa_id: { Args: never; Returns: string }
      get_user_empresa_id_text: { Args: never; Returns: string }
      get_user_role: { Args: never; Returns: string }
      guard_login_attempt: { Args: { p_email: string }; Returns: boolean }
      has_aal2: { Args: never; Returns: boolean }
      has_role: {
        Args: { allowed_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      impersonation_sessions_cleanup: { Args: never; Returns: number }
      increment_ai_usage: {
        Args: {
          p_calls: number
          p_empresa_id: string
          p_tokens_input: number
          p_tokens_output: number
        }
        Returns: undefined
      }
      insert_audit_log: {
        Args: {
          p_action: string
          p_actor_email?: string
          p_actor_id?: string
          p_diff?: Json
          p_metadata?: Json
          p_target_id?: string
          p_target_table?: string
        }
        Returns: undefined
      }
      is_company_admin: { Args: never; Returns: boolean }
      is_feature_flag_enabled: { Args: { p_key: string }; Returns: boolean }
      is_impersonating: { Args: never; Returns: boolean }
      is_ultra_admin: { Args: never; Returns: boolean }
      is_ultra_admin_scoped: { Args: never; Returns: boolean }
      listar_clientes_paginado: {
        Args: {
          p_com_projeto?: boolean
          p_limit?: number
          p_offset?: number
          p_origem?: string
          p_search?: string
          p_sort_dir?: string
          p_sort_field?: string
          p_tem_portal?: boolean
          p_tipo_pessoa?: string
        }
        Returns: {
          chaves_pix: Json
          contas_bancarias: Json
          contato: string
          cpf_cnpj: string
          created_at: string
          email: string
          endereco: string
          id: string
          nome: string
          origem: string
          sobrenome: string
          tipo_nf: string
          tipo_pessoa: string
          total_count: number
        }[]
      }
      listar_origens_clientes: {
        Args: never
        Returns: {
          origem: string
        }[]
      }
      mfa_backup_codes_remaining: { Args: never; Returns: number }
      mfa_consume_backup_code: { Args: { p_code: string }; Returns: boolean }
      mfa_generate_backup_codes: { Args: never; Returns: string[] }
      my_empresa_id: { Args: never; Returns: string }
      notificacao_email_padrao: {
        Args: { p_categoria: string }
        Returns: boolean
      }
      notificacoes_email_disparar: {
        Args: { p_modo: string }
        Returns: undefined
      }
      notificacoes_email_imediato_monitored: { Args: never; Returns: undefined }
      notificacoes_email_semanal_monitored: { Args: never; Returns: undefined }
      notificacoes_pendentes_email: {
        Args: { p_modo: string }
        Returns: {
          categoria: string
          created_at: string
          destinatario_id: string
          email: string
          empresa_id: string
          link: string
          mensagem: string
          nome: string
          notificacao_id: string
          severidade: string
          titulo: string
        }[]
      }
      notificar: {
        Args: {
          p_categoria: string
          p_destinatarios: string[]
          p_empresa_id: string
          p_expires_at?: string
          p_link?: string
          p_mensagem?: string
          p_ref_id?: string
          p_ref_tipo?: string
          p_severidade: string
          p_tipo: string
          p_titulo: string
        }
        Returns: number
      }
      pagar_fatura: {
        Args: {
          p_conta_id: string
          p_data_pagamento?: string
          p_fatura_id: string
          p_idempotency_key?: string
          p_valor_pago?: number
        }
        Returns: undefined
      }
      pilar_disciplina_status_canonico: {
        Args: { p_bucket: string }
        Returns: string
      }
      pilar_set_ultra_admin_scope: {
        Args: { p_scoped: boolean }
        Returns: boolean
      }
      pilar_status_bucket: { Args: { p_status: string }; Returns: string }
      portal_aprovar_entrega: {
        Args: { p_entrega_id: string; p_token: string }
        Returns: undefined
      }
      portal_aprovar_proposta_atomica: {
        Args: { p_projeto_id: string; p_proposta_id: string }
        Returns: undefined
      }
      portal_change_password: {
        Args: { p_nova_senha: string; p_senha_atual: string; p_token: string }
        Returns: Json
      }
      portal_get_projeto_disciplinas: {
        Args: { p_projeto_id: string; p_token: string }
        Returns: Json
      }
      portal_get_projeto_full: {
        Args: { p_projeto_id: string; p_token: string }
        Returns: Json
      }
      portal_listar_entregas: {
        Args: { p_projeto_id: string; p_token: string }
        Returns: {
          aprovado_ip: unknown
          aprovado_user_agent: string
          created_at: string
          created_by: string
          descricao: string
          disciplina_nome: string
          drive_url: string
          empresa_id: string
          id: string
          projeto_disciplina_id: string
          projeto_id: string
          respondido_em: string
          resposta_cliente: string
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }[]
      }
      portal_login: {
        Args: { p_email: string; p_senha: string }
        Returns: Json
      }
      portal_solicitar_revisao_entrega: {
        Args: { p_entrega_id: string; p_resposta: string; p_token: string }
        Returns: undefined
      }
      portal_verify_session: { Args: { p_token: string }; Returns: Json }
      portal_verify_session_readonly: {
        Args: { p_token: string }
        Returns: Json
      }
      projetos_com_escopo_estourado: {
        Args: never
        Returns: {
          custo_orcado: number
          despesas_diretas: number
          empresa_id: string
          nome: string
          projeto_id: string
        }[]
      }
      rate_limit_cleanup: { Args: never; Returns: undefined }
      rate_limit_cleanup_monitored: { Args: never; Returns: undefined }
      recalc_disciplina_status_por_checklist: {
        Args: { p_disciplina_id: string }
        Returns: undefined
      }
      recalc_grupo_parcela_status: {
        Args: { p_grupo_id: string }
        Returns: undefined
      }
      regenerate_convite_token: {
        Args: { p_convite_id: string }
        Returns: string
      }
      request_data_deletion: { Args: { p_motivo?: string }; Returns: string }
      request_data_export: { Args: never; Returns: Json }
      resolver_solicitacao_tokens: {
        Args: {
          p_aprovar: boolean
          p_novo_limite?: number
          p_solicitacao_id: string
        }
        Returns: undefined
      }
      rpc_atualizar_status_atrasados: { Args: never; Returns: Json }
      rpc_calcular_wip: {
        Args: { p_ano: number; p_mes: number }
        Returns: number
      }
      rpc_concluir_revisao: {
        Args: { p_concluida_em?: string; p_revisao_id: string }
        Returns: undefined
      }
      rpc_converter_lead_cliente: {
        Args: { p_lead_id: string; p_omit_cnpj?: boolean }
        Returns: string
      }
      rpc_converter_proposta_projeto: {
        Args: { p_proposta_id: string }
        Returns: string
      }
      rpc_criar_transferencia: {
        Args: {
          p_conta_destino_id: string
          p_conta_origem_id: string
          p_data: string
          p_descricao?: string
          p_observacao?: string
          p_status?: string
          p_valor: number
        }
        Returns: string
      }
      rpc_custo_real_projeto: { Args: { p_projeto_id: string }; Returns: Json }
      rpc_daily_maintenance: { Args: never; Returns: Json }
      rpc_dashboard_rentabilidade: { Args: never; Returns: Json }
      rpc_editar_transferencia: {
        Args: {
          p_conta_destino_id: string
          p_conta_origem_id: string
          p_data: string
          p_descricao?: string
          p_id: string
          p_observacao?: string
          p_status?: string
          p_valor: number
        }
        Returns: undefined
      }
      rpc_excluir_projeto: { Args: { p_id: string }; Returns: undefined }
      rpc_excluir_transferencia: { Args: { p_id: string }; Returns: undefined }
      rpc_faturar_marco: { Args: { p_marco_id: string }; Returns: string }
      rpc_gerar_alertas: { Args: never; Returns: number }
      rpc_gerar_despesas_recorrentes: { Args: never; Returns: number }
      rpc_gerar_parcelas_dia_fixo: {
        Args: {
          p_dia_fixo: number
          p_num_parcelas: number
          p_projeto_id: string
        }
        Returns: number
      }
      rpc_gerar_parcelas_projeto: {
        Args: {
          p_intervalo_dias?: number
          p_num_parcelas?: number
          p_projeto_id: string
        }
        Returns: number
      }
      rpc_grupo_parcela_criar: {
        Args: {
          p_cartao_id?: string
          p_categoria_id?: string
          p_centro_custo_id?: string
          p_conta_id?: string
          p_contraparte_id?: string
          p_descricao: string
          p_forma_pagamento?: string
          p_num_parcelas: number
          p_observacao?: string
          p_periodicidade?: string
          p_primeira_data: string
          p_projeto_id?: string
          p_tags?: string[]
          p_tipo_lancamento: string
          p_total: number
        }
        Returns: string
      }
      rpc_grupo_parcela_editar_em_aberto: {
        Args: {
          p_grupo_id: string
          p_nova_categoria_id?: string
          p_nova_conta_id?: string
          p_nova_observacao?: string
          p_novo_centro_custo_id?: string
          p_novo_valor_parcela?: number
        }
        Returns: number
      }
      rpc_grupo_parcela_quitar_antecipado: {
        Args: {
          p_data_pagamento?: string
          p_desconto_total?: number
          p_grupo_id: string
          p_quantidade?: number
        }
        Returns: number
      }
      rpc_grupo_parcela_renegociar: {
        Args: {
          p_grupo_id: string
          p_nova_primeira_data: string
          p_novo_num_parcelas: number
          p_novo_total: number
          p_observacao?: string
        }
        Returns: string
      }
      rpc_lancamento_set_rateio: {
        Args: {
          p_lancamento_id: string
          p_rateios: Json
          p_tipo_lancamento: string
        }
        Returns: number
      }
      rpc_notificar_mencao: {
        Args: {
          p_entidade_id: string
          p_entidade_tipo: string
          p_mencionados: string[]
          p_preview: string
        }
        Returns: number
      }
      rpc_notificar_proxima_etapa: {
        Args: { p_disciplina_id: string }
        Returns: number
      }
      rpc_obra_despesa_excluir: { Args: { p_id: string }; Returns: undefined }
      rpc_obra_despesa_salvar: {
        Args: {
          p_comprovante_url?: string
          p_confirmada_portal?: boolean
          p_data: string
          p_descricao: string
          p_fornecedor_id?: string
          p_id?: string
          p_obra_frente_id?: string
          p_obra_id: string
          p_pago_por?: string
          p_valor: number
        }
        Returns: {
          comprovante_url: string | null
          confirmada_portal: boolean
          created_at: string
          created_by: string
          data: string
          deleted_at: string | null
          descricao: string
          empresa_id: string
          fornecedor_id: string | null
          id: string
          obra_frente_id: string | null
          obra_id: string
          pago_por: string | null
          tipo: string
          updated_at: string
          updated_by: string | null
          valor: number
        }
        SetofOptions: {
          from: "*"
          to: "obra_conta_lancamento"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_pausar_disciplina: {
        Args: { p_disciplina_id: string; p_motivo: string }
        Returns: string
      }
      rpc_projeto_rentabilidade: {
        Args: { p_projeto_id: string }
        Returns: Json
      }
      rpc_registrar_revisao: {
        Args: {
          p_disciplina_id: string
          p_motivo: string
          p_solicitada_em?: string
        }
        Returns: string
      }
      rpc_restaurar: {
        Args: { p_id: string; p_tabela: string }
        Returns: undefined
      }
      rpc_restaurar_projeto: { Args: { p_id: string }; Returns: undefined }
      rpc_retomar_disciplina: {
        Args: { p_disciplina_id: string }
        Returns: undefined
      }
      rpc_salvar_proposta_disciplinas: {
        Args: { p_disciplinas: Json; p_proposta_id: string }
        Returns: undefined
      }
      rpc_soft_delete: {
        Args: { p_id: string; p_tabela: string }
        Returns: undefined
      }
      rpc_soft_delete_grupo: {
        Args: { p_grupo: string; p_tabela: string }
        Returns: number
      }
      rpc_sync_metas: { Args: never; Returns: number }
      sentry_cron_checkin: {
        Args: {
          p_check_in_id?: string
          p_monitor_slug: string
          p_status: string
        }
        Returns: string
      }
      set_access_profile: {
        Args: { p_perfil: string; p_user_id: string }
        Returns: undefined
      }
      set_asaas_api_key: {
        Args: { p_api_key: string; p_empresa_id: string }
        Returns: undefined
      }
      set_disciplina_status: {
        Args: { p_bucket: string; p_disciplina_id: string }
        Returns: undefined
      }
      set_equipe_delegado: {
        Args: { p_delegado: boolean; p_user_id: string }
        Returns: undefined
      }
      set_financeiro_delegado: {
        Args: { p_delegado: boolean; p_user_id: string }
        Returns: undefined
      }
      set_metas_delegado: {
        Args: { p_delegado: boolean; p_user_id: string }
        Returns: undefined
      }
      set_onboarding_state: { Args: { patch: Json }; Returns: Json }
      set_painel_layout: { Args: { p_layout: Json }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      solicitar_mais_tokens: {
        Args: { p_limite_sugerido?: number; p_mensagem?: string }
        Returns: string
      }
      start_impersonation: {
        Args: { p_ip?: string; p_target_role: string; p_user_agent?: string }
        Returns: string
      }
      stop_impersonation: { Args: never; Returns: undefined }
      sync_disciplina_responsaveis: {
        Args: { p_disciplina_id: string; p_pessoa_ids: string[] }
        Returns: undefined
      }
      update_company_features: {
        Args: { p_features: Json }
        Returns: undefined
      }
      update_projeto_completo: {
        Args: {
          p_area_m2?: number
          p_cliente_id: string
          p_codigo: string
          p_data_final?: string
          p_data_inicio?: string
          p_data_previsao?: string
          p_disciplinas?: Json
          p_localizacao?: string
          p_nome: string
          p_observacao?: string
          p_parcelas?: string
          p_prioridade?: string
          p_projeto_id: string
          p_status?: string
          p_valor_contrato?: number
        }
        Returns: undefined
      }
      update_user_access: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      user_has_feature: {
        Args: { p_feature: string; p_min_level?: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_run_status:
        | "queued"
        | "running"
        | "pending_review"
        | "approved"
        | "executed"
        | "rejected"
        | "failed"
      job_status: "pending" | "running" | "completed" | "failed"
      status_empresa: "active" | "suspended" | "cancelled"
      status_financeiro:
        | "Pendente"
        | "Pago"
        | "Recebido"
        | "Atrasado"
        | "Cancelado"
      status_projeto:
        | "Planejamento"
        | "Execução"
        | "Paralisado"
        | "Concluído"
        | "Cancelado"
        | "Em andamento"
        | "Revisão"
      tipo_categoria: "Receita" | "Despesa"
      user_role:
        | "user"
        | "admin"
        | "ultra_admin"
        | "owner"
        | "coordenador"
        | "colaborador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_run_status: [
        "queued",
        "running",
        "pending_review",
        "approved",
        "executed",
        "rejected",
        "failed",
      ],
      job_status: ["pending", "running", "completed", "failed"],
      status_empresa: ["active", "suspended", "cancelled"],
      status_financeiro: [
        "Pendente",
        "Pago",
        "Recebido",
        "Atrasado",
        "Cancelado",
      ],
      status_projeto: [
        "Planejamento",
        "Execução",
        "Paralisado",
        "Concluído",
        "Cancelado",
        "Em andamento",
        "Revisão",
      ],
      tipo_categoria: ["Receita", "Despesa"],
      user_role: [
        "user",
        "admin",
        "ultra_admin",
        "owner",
        "coordenador",
        "colaborador",
      ],
    },
  },
} as const

