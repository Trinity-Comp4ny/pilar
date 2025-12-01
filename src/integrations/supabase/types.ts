export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          contato: string | null
          cpf: string | null
          created_at: string | null
          endereco: string | null
          id: string
          nome: string
          tipo_nf: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contato?: string | null
          cpf?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome: string
          tipo_nf?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contato?: string | null
          cpf?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          tipo_nf?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_pagamento: string
          descricao: string
          forma_pagamento: string | null
          fornecedor: string | null
          id: string
          nota_fiscal: string | null
          parcelas: number | null
          projeto_id: string | null
          responsavel: string | null
          updated_at: string | null
          user_id: string
          valor_total: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_pagamento: string
          descricao: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          nota_fiscal?: string | null
          parcelas?: number | null
          projeto_id?: string | null
          responsavel?: string | null
          updated_at?: string | null
          user_id: string
          valor_total: number
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_pagamento?: string
          descricao?: string
          forma_pagamento?: string | null
          fornecedor?: string | null
          id?: string
          nota_fiscal?: string | null
          parcelas?: number | null
          projeto_id?: string | null
          responsavel?: string | null
          updated_at?: string | null
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_responsavel_fkey"
            columns: ["responsavel"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          admissao: string | null
          cargo: string | null
          celular: string | null
          cpf: string | null
          created_at: string | null
          demissao: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          salario_fixo: number | null
          updated_at: string | null
          user_id: string
          valor_m2: number | null
        }
        Insert: {
          admissao?: string | null
          cargo?: string | null
          celular?: string | null
          cpf?: string | null
          created_at?: string | null
          demissao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          salario_fixo?: number | null
          updated_at?: string | null
          user_id: string
          valor_m2?: number | null
        }
        Update: {
          admissao?: string | null
          cargo?: string | null
          celular?: string | null
          cpf?: string | null
          created_at?: string | null
          demissao?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          salario_fixo?: number | null
          updated_at?: string | null
          user_id?: string
          valor_m2?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projetos: {
        Row: {
          arquiteto: string | null
          briefing: string | null
          cliente_id: string | null
          contrato: string | null
          created_at: string | null
          data_final: string | null
          data_inicio: string | null
          data_previsao: string | null
          id: string
          localizacao: string | null
          m2: number | null
          pacote: string | null
          parcelas: number | null
          placa: string | null
          post: string | null
          projeto_id: string
          responsavel_detalhamento: string | null
          responsavel_eletrico: string | null
          responsavel_hidraulico: string | null
          responsavel_modelagem: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
          user_id: string
          valor_total: number | null
        }
        Insert: {
          arquiteto?: string | null
          briefing?: string | null
          cliente_id?: string | null
          contrato?: string | null
          created_at?: string | null
          data_final?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          id?: string
          localizacao?: string | null
          m2?: number | null
          pacote?: string | null
          parcelas?: number | null
          placa?: string | null
          post?: string | null
          projeto_id: string
          responsavel_detalhamento?: string | null
          responsavel_eletrico?: string | null
          responsavel_hidraulico?: string | null
          responsavel_modelagem?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          user_id: string
          valor_total?: number | null
        }
        Update: {
          arquiteto?: string | null
          briefing?: string | null
          cliente_id?: string | null
          contrato?: string | null
          created_at?: string | null
          data_final?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          id?: string
          localizacao?: string | null
          m2?: number | null
          pacote?: string | null
          parcelas?: number | null
          placa?: string | null
          post?: string | null
          projeto_id?: string
          responsavel_detalhamento?: string | null
          responsavel_eletrico?: string | null
          responsavel_hidraulico?: string | null
          responsavel_modelagem?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
          user_id?: string
          valor_total?: number | null
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
            foreignKeyName: "projetos_responsavel_detalhamento_fkey"
            columns: ["responsavel_detalhamento"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_responsavel_eletrico_fkey"
            columns: ["responsavel_eletrico"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_responsavel_hidraulico_fkey"
            columns: ["responsavel_hidraulico"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_responsavel_modelagem_fkey"
            columns: ["responsavel_modelagem"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      receitas: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_recebimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          nota_fiscal: string | null
          projeto_id: string | null
          updated_at: string | null
          user_id: string
          valor_total: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_recebimento: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          nota_fiscal?: string | null
          projeto_id?: string | null
          updated_at?: string | null
          user_id: string
          valor_total: number
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_recebimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          nota_fiscal?: string | null
          projeto_id?: string | null
          updated_at?: string | null
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "receitas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
