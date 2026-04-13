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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          created_at: string
          data_nascimento: string | null
          email: string | null
          foto_url: string | null
          frequencia_semanal: number | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_id: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          frequencia_semanal?: number | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          frequencia_semanal?: number | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      avaliacao_funcional: {
        Row: {
          avaliacao_id: string
          created_at: string
          flex_mmii_dir: number | null
          flex_mmii_esq: number | null
          flex_psoas_dir: number | null
          flex_psoas_esq: number | null
          flex_quadriceps_dir: number | null
          flex_quadriceps_esq: number | null
          id: string
          observacoes: string | null
          ombro_re_dir: number | null
          ombro_re_esq: number | null
          ombro_ri_dir: number | null
          ombro_ri_esq: number | null
          quadril_re_dir: number | null
          quadril_re_esq: number | null
          quadril_ri_dir: number | null
          quadril_ri_esq: number | null
          toracica_dir: number | null
          toracica_esq: number | null
          tornozelo_dir: number | null
          tornozelo_esq: number | null
        }
        Insert: {
          avaliacao_id: string
          created_at?: string
          flex_mmii_dir?: number | null
          flex_mmii_esq?: number | null
          flex_psoas_dir?: number | null
          flex_psoas_esq?: number | null
          flex_quadriceps_dir?: number | null
          flex_quadriceps_esq?: number | null
          id?: string
          observacoes?: string | null
          ombro_re_dir?: number | null
          ombro_re_esq?: number | null
          ombro_ri_dir?: number | null
          ombro_ri_esq?: number | null
          quadril_re_dir?: number | null
          quadril_re_esq?: number | null
          quadril_ri_dir?: number | null
          quadril_ri_esq?: number | null
          toracica_dir?: number | null
          toracica_esq?: number | null
          tornozelo_dir?: number | null
          tornozelo_esq?: number | null
        }
        Update: {
          avaliacao_id?: string
          created_at?: string
          flex_mmii_dir?: number | null
          flex_mmii_esq?: number | null
          flex_psoas_dir?: number | null
          flex_psoas_esq?: number | null
          flex_quadriceps_dir?: number | null
          flex_quadriceps_esq?: number | null
          id?: string
          observacoes?: string | null
          ombro_re_dir?: number | null
          ombro_re_esq?: number | null
          ombro_ri_dir?: number | null
          ombro_ri_esq?: number | null
          quadril_re_dir?: number | null
          quadril_re_esq?: number | null
          quadril_ri_dir?: number | null
          quadril_ri_esq?: number | null
          toracica_dir?: number | null
          toracica_esq?: number | null
          tornozelo_dir?: number | null
          tornozelo_esq?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_funcional_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: true
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          aluno_id: string
          arquivo_url: string | null
          avaliador_id: string
          created_at: string
          dados: Json | null
          data: string
          id: string
          observacoes: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          arquivo_url?: string | null
          avaliador_id: string
          created_at?: string
          dados?: Json | null
          data?: string
          id?: string
          observacoes?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          arquivo_url?: string | null
          avaliador_id?: string
          created_at?: string
          dados?: Json | null
          data?: string
          id?: string
          observacoes?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_profissional: {
        Row: {
          aluno_id: string
          autor_id: string
          categoria: string
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          aluno_id: string
          autor_id: string
          categoria: string
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          aluno_id?: string
          autor_id?: string
          categoria?: string
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_profissional_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          aluno_id: string
          ativo: boolean
          created_at: string
          data_inicio: string
          duracao_meses: number
          id: string
          servicos: string[] | null
          tipo: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          created_at?: string
          data_inicio: string
          duracao_meses?: number
          id?: string
          servicos?: string[] | null
          tipo: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          created_at?: string
          data_inicio?: string
          duracao_meses?: number
          id?: string
          servicos?: string[] | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          aluno_id: string | null
          automatica: boolean
          created_at: string
          criado_por_id: string
          data_limite: string | null
          descricao: string | null
          id: string
          prioridade: string
          responsavel_id: string
          status: string
          tipo_auto: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          automatica?: boolean
          created_at?: string
          criado_por_id: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          responsavel_id: string
          status?: string
          tipo_auto?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          automatica?: boolean
          created_at?: string
          criado_por_id?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string
          responsavel_id?: string
          status?: string
          tipo_auto?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinos: {
        Row: {
          aluno_id: string
          autor_id: string
          conteudo: Json | null
          created_at: string
          descricao: string
          id: string
          status: string
          updated_at: string
          versao: number
        }
        Insert: {
          aluno_id: string
          autor_id: string
          conteudo?: Json | null
          created_at?: string
          descricao: string
          id?: string
          status?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          aluno_id?: string
          autor_id?: string
          conteudo?: Json | null
          created_at?: string
          descricao?: string
          id?: string
          status?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "treinos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          aluno_id: string
          autor_id: string
          categoria: string | null
          created_at: string
          id: string
          nome_arquivo: string
          storage_path: string
          tipo: string
        }
        Insert: {
          aluno_id: string
          autor_id: string
          categoria?: string | null
          created_at?: string
          id?: string
          nome_arquivo: string
          storage_path: string
          tipo: string
        }
        Update: {
          aluno_id?: string
          autor_id?: string
          categoria?: string | null
          created_at?: string
          id?: string
          nome_arquivo?: string
          storage_path?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_coordinator_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador"
        | "professor"
        | "nutricionista"
        | "fisioterapeuta"
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
    Enums: {
      app_role: [
        "admin",
        "coordenador",
        "professor",
        "nutricionista",
        "fisioterapeuta",
      ],
    },
  },
} as const
