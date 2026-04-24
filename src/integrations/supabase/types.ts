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
      agenda_servicos: {
        Row: {
          aluno_id: string | null
          atividade: string
          created_at: string
          data_especifica: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id: string
          local: string
          observacoes: string | null
          profissional_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          atividade: string
          created_at?: string
          data_especifica?: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id?: string
          local: string
          observacoes?: string | null
          profissional_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          atividade?: string
          created_at?: string
          data_especifica?: string | null
          dia_semana?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          local?: string
          observacoes?: string | null
          profissional_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      alunos: {
        Row: {
          created_at: string
          current_pipeline_stage_id: string | null
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
          current_pipeline_stage_id?: string | null
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
          current_pipeline_stage_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "alunos_current_pipeline_stage_id_fkey"
            columns: ["current_pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
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
      banco_treinos_escolhas: {
        Row: {
          categoria: string
          created_at: string
          escolhido_por: string
          exercicio_id: string
          id: string
          ordem: number
          template_fase: string
          treino_nome: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          escolhido_por: string
          exercicio_id: string
          id?: string
          ordem: number
          template_fase: string
          treino_nome: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          escolhido_por?: string
          exercicio_id?: string
          id?: string
          ordem?: number
          template_fase?: string
          treino_nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banco_treinos_escolhas_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios_personalizados"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          limite_por_periodo: number | null
          nivel_minimo: Database["public"]["Enums"]["clube_nivel_membro"]
          parceiro_id: string
          periodicidade: Database["public"]["Enums"]["beneficio_periodicidade"]
          regra_uso: string | null
          tipo: Database["public"]["Enums"]["beneficio_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          limite_por_periodo?: number | null
          nivel_minimo?: Database["public"]["Enums"]["clube_nivel_membro"]
          parceiro_id: string
          periodicidade?: Database["public"]["Enums"]["beneficio_periodicidade"]
          regra_uso?: string | null
          tipo: Database["public"]["Enums"]["beneficio_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          limite_por_periodo?: number | null
          nivel_minimo?: Database["public"]["Enums"]["clube_nivel_membro"]
          parceiro_id?: string
          periodicidade?: Database["public"]["Enums"]["beneficio_periodicidade"]
          regra_uso?: string | null
          tipo?: Database["public"]["Enums"]["beneficio_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      clube_fortem_membros: {
        Row: {
          aluno_desde: string
          aluno_id: string
          cpf_hash: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          fortem_id: string
          foto_url: string | null
          id: string
          nivel_membro: Database["public"]["Enums"]["clube_nivel_membro"]
          qr_secret: string
          status_membro: Database["public"]["Enums"]["clube_status_membro"]
          ultimo_refresh_qr: string | null
          updated_at: string
        }
        Insert: {
          aluno_desde?: string
          aluno_id: string
          cpf_hash: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          fortem_id: string
          foto_url?: string | null
          id?: string
          nivel_membro?: Database["public"]["Enums"]["clube_nivel_membro"]
          qr_secret?: string
          status_membro?: Database["public"]["Enums"]["clube_status_membro"]
          ultimo_refresh_qr?: string | null
          updated_at?: string
        }
        Update: {
          aluno_desde?: string
          aluno_id?: string
          cpf_hash?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          fortem_id?: string
          foto_url?: string | null
          id?: string
          nivel_membro?: Database["public"]["Enums"]["clube_nivel_membro"]
          qr_secret?: string
          status_membro?: Database["public"]["Enums"]["clube_status_membro"]
          ultimo_refresh_qr?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clube_fortem_membros_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      consumo_servicos: {
        Row: {
          agenda_id: string | null
          aluno_id: string
          created_at: string
          data_consumo: string
          id: string
          observacoes: string | null
          plano_id: string
          quantidade: number
          registrado_por: string
          tipo_registro: string
          tipo_servico: string
          valor_unitario: number
        }
        Insert: {
          agenda_id?: string | null
          aluno_id: string
          created_at?: string
          data_consumo?: string
          id?: string
          observacoes?: string | null
          plano_id: string
          quantidade?: number
          registrado_por: string
          tipo_registro?: string
          tipo_servico: string
          valor_unitario?: number
        }
        Update: {
          agenda_id?: string | null
          aluno_id?: string
          created_at?: string
          data_consumo?: string
          id?: string
          observacoes?: string | null
          plano_id?: string
          quantidade?: number
          registrado_por?: string
          tipo_registro?: string
          tipo_servico?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "consumo_servicos_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agenda_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_servicos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_servicos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      exercicios_personalizados: {
        Row: {
          created_at: string
          criado_por: string
          grupos: Json
          id: string
          nome: string
          updated_at: string
          video_path: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          criado_por: string
          grupos?: Json
          id?: string
          nome: string
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string
          grupos?: Json
          id?: string
          nome?: string
          updated_at?: string
          video_path?: string | null
          video_url?: string | null
        }
        Relationships: []
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
      parceiros: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          data_fim_parceria: string | null
          data_inicio_parceria: string
          descricao: string | null
          email_login: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          modo_validacao: Database["public"]["Enums"]["parceiro_modo_validacao"]
          nome: string
          pontuacao_engajamento: number
          responsavel_contato: string | null
          responsavel_nome: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          data_fim_parceria?: string | null
          data_inicio_parceria?: string
          descricao?: string | null
          email_login?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          modo_validacao?: Database["public"]["Enums"]["parceiro_modo_validacao"]
          nome: string
          pontuacao_engajamento?: number
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          data_fim_parceria?: string | null
          data_inicio_parceria?: string
          descricao?: string | null
          email_login?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          modo_validacao?: Database["public"]["Enums"]["parceiro_modo_validacao"]
          nome?: string
          pontuacao_engajamento?: number
          responsavel_contato?: string | null
          responsavel_nome?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pipeline_metadata: {
        Row: {
          aluno_id: string
          created_at: string
          data_prevista_fechamento: string | null
          last_contact_at: string | null
          next_followup_at: string | null
          origem_lead: string | null
          probabilidade_fechamento: number | null
          responsavel_comercial_id: string | null
          temperatura_lead: string | null
          updated_at: string
          valor_estimado_plano: number | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          data_prevista_fechamento?: string | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          origem_lead?: string | null
          probabilidade_fechamento?: number | null
          responsavel_comercial_id?: string | null
          temperatura_lead?: string | null
          updated_at?: string
          valor_estimado_plano?: number | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data_prevista_fechamento?: string | null
          last_contact_at?: string | null
          next_followup_at?: string | null
          origem_lead?: string | null
          probabilidade_fechamento?: number | null
          responsavel_comercial_id?: string | null
          temperatura_lead?: string | null
          updated_at?: string
          valor_estimado_plano?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_metadata_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_movements: {
        Row: {
          aluno_id: string
          created_at: string
          from_stage_id: string | null
          id: string
          moved_at: string
          moved_by_user_id: string | null
          notes: string | null
          source: Database["public"]["Enums"]["pipeline_movement_source"]
          time_in_previous_stage: string | null
          to_stage_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          moved_at?: string
          moved_by_user_id?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["pipeline_movement_source"]
          time_in_previous_stage?: string | null
          to_stage_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          moved_at?: string
          moved_by_user_id?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["pipeline_movement_source"]
          time_in_previous_stage?: string | null
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_movements_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_movements_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_movements_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
        }
        Relationships: []
      }
      planos: {
        Row: {
          aluno_id: string
          ativo: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          duracao_meses: number
          id: string
          servicos: string[] | null
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          duracao_meses?: number
          id?: string
          servicos?: string[] | null
          tipo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          duracao_meses?: number
          id?: string
          servicos?: string[] | null
          tipo?: string
          updated_at?: string
          valor?: number | null
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
      regras_elegibilidade: {
        Row: {
          ativo: boolean
          beneficio_id: string
          created_at: string
          id: string
          tipo_regra: Database["public"]["Enums"]["regra_elegibilidade_tipo"]
          updated_at: string
          valor_regra: string
        }
        Insert: {
          ativo?: boolean
          beneficio_id: string
          created_at?: string
          id?: string
          tipo_regra: Database["public"]["Enums"]["regra_elegibilidade_tipo"]
          updated_at?: string
          valor_regra: string
        }
        Update: {
          ativo?: boolean
          beneficio_id?: string
          created_at?: string
          id?: string
          tipo_regra?: Database["public"]["Enums"]["regra_elegibilidade_tipo"]
          updated_at?: string
          valor_regra?: string
        }
        Relationships: [
          {
            foreignKeyName: "regras_elegibilidade_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
        ]
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
      uso_beneficios: {
        Row: {
          aluno_id: string
          beneficio_id: string
          cpf_hash: string
          created_at: string
          data_uso: string
          hora_uso: string
          id: string
          motivo_recusa: string | null
          origem_validacao: Database["public"]["Enums"]["uso_origem_validacao"]
          parceiro_id: string
          status_validacao: Database["public"]["Enums"]["uso_status_validacao"]
          token_validacao: string | null
          validado_por: string | null
        }
        Insert: {
          aluno_id: string
          beneficio_id: string
          cpf_hash: string
          created_at?: string
          data_uso?: string
          hora_uso?: string
          id?: string
          motivo_recusa?: string | null
          origem_validacao?: Database["public"]["Enums"]["uso_origem_validacao"]
          parceiro_id: string
          status_validacao: Database["public"]["Enums"]["uso_status_validacao"]
          token_validacao?: string | null
          validado_por?: string | null
        }
        Update: {
          aluno_id?: string
          beneficio_id?: string
          cpf_hash?: string
          created_at?: string
          data_uso?: string
          hora_uso?: string
          id?: string
          motivo_recusa?: string | null
          origem_validacao?: Database["public"]["Enums"]["uso_origem_validacao"]
          parceiro_id?: string
          status_validacao?: Database["public"]["Enums"]["uso_status_validacao"]
          token_validacao?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uso_beneficios_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uso_beneficios_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uso_beneficios_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_clube_dashboard: { Args: { _periodo_dias?: number }; Returns: Json }
      fn_clube_generate_qr_token: { Args: { _aluno_id: string }; Returns: Json }
      fn_clube_hash_cpf: { Args: { _cpf: string }; Returns: string }
      fn_clube_validar_token: {
        Args: { _beneficio_id: string; _token: string }
        Returns: Json
      }
      fn_detect_evasao: { Args: never; Returns: Json }
      fn_move_pipeline: {
        Args: {
          _aluno_id: string
          _moved_by?: string
          _notes?: string
          _source?: Database["public"]["Enums"]["pipeline_movement_source"]
          _to_stage_name: string
        }
        Returns: string
      }
      get_dashboard_data: { Args: { _professor_id?: string }; Returns: Json }
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
      beneficio_periodicidade: "dia" | "semana" | "mes" | "livre"
      beneficio_tipo:
        | "desconto_percentual"
        | "desconto_valor"
        | "gratuidade"
        | "vantagem_exclusiva"
        | "cashback_futuro"
      clube_nivel_membro: "start" | "start_plus" | "power" | "pro" | "max"
      clube_status_membro: "ativo" | "bloqueado" | "inadimplente" | "cancelado"
      parceiro_modo_validacao: "qr_scan" | "cpf_manual" | "lista_nome"
      pipeline_movement_source:
        | "manual"
        | "auto_avaliacao"
        | "auto_plano"
        | "auto_agenda"
        | "auto_evasao"
        | "auto_recuperacao"
      regra_elegibilidade_tipo:
        | "plano"
        | "frequencia_minima"
        | "status_financeiro"
        | "tempo_matricula"
      uso_origem_validacao: "scanner" | "cpf_manual" | "admin"
      uso_status_validacao: "valido" | "recusado" | "expirado" | "bloqueado"
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
      beneficio_periodicidade: ["dia", "semana", "mes", "livre"],
      beneficio_tipo: [
        "desconto_percentual",
        "desconto_valor",
        "gratuidade",
        "vantagem_exclusiva",
        "cashback_futuro",
      ],
      clube_nivel_membro: ["start", "start_plus", "power", "pro", "max"],
      clube_status_membro: ["ativo", "bloqueado", "inadimplente", "cancelado"],
      parceiro_modo_validacao: ["qr_scan", "cpf_manual", "lista_nome"],
      pipeline_movement_source: [
        "manual",
        "auto_avaliacao",
        "auto_plano",
        "auto_agenda",
        "auto_evasao",
        "auto_recuperacao",
      ],
      regra_elegibilidade_tipo: [
        "plano",
        "frequencia_minima",
        "status_financeiro",
        "tempo_matricula",
      ],
      uso_origem_validacao: ["scanner", "cpf_manual", "admin"],
      uso_status_validacao: ["valido", "recusado", "expirado", "bloqueado"],
    },
  },
} as const
