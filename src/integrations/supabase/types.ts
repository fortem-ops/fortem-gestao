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
      aluno_licencas: {
        Row: {
          aluno_id: string
          arquivo_url: string | null
          created_at: string
          criado_por: string
          data_fim: string
          data_inicio: string
          dias: number
          id: string
          motivo: string | null
          plano_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          arquivo_url?: string | null
          created_at?: string
          criado_por: string
          data_fim: string
          data_inicio: string
          dias: number
          id?: string
          motivo?: string | null
          plano_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          arquivo_url?: string | null
          created_at?: string
          criado_por?: string
          data_fim?: string
          data_inicio?: string
          dias?: number
          id?: string
          motivo?: string | null
          plano_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      alunos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          current_pipeline_stage_id: string | null
          data_nascimento: string | null
          email: string | null
          foto_url: string | null
          frequencia_semanal: number | null
          id: string
          logradouro: string | null
          motivo_perda: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          responsavel_id: string | null
          sexo: string | null
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          current_pipeline_stage_id?: string | null
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          frequencia_semanal?: number | null
          id?: string
          logradouro?: string | null
          motivo_perda?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          current_pipeline_stage_id?: string | null
          data_nascimento?: string | null
          email?: string | null
          foto_url?: string | null
          frequencia_semanal?: number | null
          id?: string
          logradouro?: string | null
          motivo_perda?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
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
          categoria_override: string | null
          created_at: string
          dias_override: string[] | null
          escolhido_por: string
          exercicio_id: string | null
          id: string
          ordem: number
          repeticoes_override: string | null
          series_override: number | null
          subcategoria_override: string | null
          template_fase: string
          treino_nome: string
          updated_at: string
        }
        Insert: {
          categoria: string
          categoria_override?: string | null
          created_at?: string
          dias_override?: string[] | null
          escolhido_por: string
          exercicio_id?: string | null
          id?: string
          ordem: number
          repeticoes_override?: string | null
          series_override?: number | null
          subcategoria_override?: string | null
          template_fase: string
          treino_nome: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          categoria_override?: string | null
          created_at?: string
          dias_override?: string[] | null
          escolhido_por?: string
          exercicio_id?: string | null
          id?: string
          ordem?: number
          repeticoes_override?: string | null
          series_override?: number | null
          subcategoria_override?: string | null
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
      banco_treinos_personalizados: {
        Row: {
          conteudo: Json
          created_at: string
          criado_por: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          criado_por: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          criado_por?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
          niveis_permitidos: Database["public"]["Enums"]["clube_nivel_membro"][]
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
          niveis_permitidos?: Database["public"]["Enums"]["clube_nivel_membro"][]
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
          niveis_permitidos?: Database["public"]["Enums"]["clube_nivel_membro"][]
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
      clube_alertas: {
        Row: {
          aluno_id: string | null
          created_at: string
          id: string
          lido: boolean
          lido_em: string | null
          lido_por: string | null
          mensagem: string
          payload: Json
          severidade: Database["public"]["Enums"]["clube_alerta_severidade"]
          tipo: Database["public"]["Enums"]["clube_alerta_tipo"]
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          id?: string
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          mensagem: string
          payload?: Json
          severidade?: Database["public"]["Enums"]["clube_alerta_severidade"]
          tipo: Database["public"]["Enums"]["clube_alerta_tipo"]
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          id?: string
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          mensagem?: string
          payload?: Json
          severidade?: Database["public"]["Enums"]["clube_alerta_severidade"]
          tipo?: Database["public"]["Enums"]["clube_alerta_tipo"]
        }
        Relationships: []
      }
      clube_fortem_membros: {
        Row: {
          aluno_desde: string
          aluno_id: string
          cpf_hash: string | null
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
          cpf_hash?: string | null
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
          cpf_hash?: string | null
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
      creditos_aluno: {
        Row: {
          aluno_id: string
          atividade: string
          ativo: boolean
          created_at: string
          data_validade: string | null
          id: string
          ilimitado: boolean
          origem_id: string | null
          origem_tipo: Database["public"]["Enums"]["venda_tipo"]
          quantidade_inicial: number
          quantidade_usada: number
          updated_at: string
        }
        Insert: {
          aluno_id: string
          atividade: string
          ativo?: boolean
          created_at?: string
          data_validade?: string | null
          id?: string
          ilimitado?: boolean
          origem_id?: string | null
          origem_tipo: Database["public"]["Enums"]["venda_tipo"]
          quantidade_inicial?: number
          quantidade_usada?: number
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          atividade?: string
          ativo?: boolean
          created_at?: string
          data_validade?: string | null
          id?: string
          ilimitado?: boolean
          origem_id?: string | null
          origem_tipo?: Database["public"]["Enums"]["venda_tipo"]
          quantidade_inicial?: number
          quantidade_usada?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creditos_aluno_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos_movimentos: {
        Row: {
          agenda_id: string | null
          credito_id: string
          data: string
          id: string
          observacao: string | null
          quantidade: number
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["credito_movimento_tipo"]
        }
        Insert: {
          agenda_id?: string | null
          credito_id: string
          data?: string
          id?: string
          observacao?: string | null
          quantidade: number
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["credito_movimento_tipo"]
        }
        Update: {
          agenda_id?: string | null
          credito_id?: string
          data?: string
          id?: string
          observacao?: string | null
          quantidade?: number
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["credito_movimento_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "creditos_movimentos_credito_id_fkey"
            columns: ["credito_id"]
            isOneToOne: false
            referencedRelation: "creditos_aluno"
            referencedColumns: ["id"]
          },
        ]
      }
      exercicio_categorias: {
        Row: {
          created_at: string
          grupo: string
          id: string
          ordem_grupo: number
          ordem_sub: number
          subcategoria: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grupo: string
          id?: string
          ordem_grupo?: number
          ordem_sub?: number
          subcategoria: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grupo?: string
          id?: string
          ordem_grupo?: number
          ordem_sub?: number
          subcategoria?: string
          updated_at?: string
        }
        Relationships: []
      }
      exercicios_personalizados: {
        Row: {
          created_at: string
          criado_por: string
          grupos: Json
          id: string
          nome: string
          ordem: number
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
          ordem?: number
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
          ordem?: number
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
          notificacao_id: string | null
        }
        Insert: {
          aluno_id: string
          autor_id: string
          categoria: string
          created_at?: string
          descricao: string
          id?: string
          notificacao_id?: string | null
        }
        Update: {
          aluno_id?: string
          autor_id?: string
          categoria?: string
          created_at?: string
          descricao?: string
          id?: string
          notificacao_id?: string | null
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
      lead_origens: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      legal_annexes: {
        Row: {
          aluno_id: string | null
          attachment_url: string | null
          cpf: string
          created_at: string
          data_nascimento: string | null
          document_type: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          image_usage: boolean
          ip_address: string | null
          medical_status: string
          nome: string
          signature_data: string | null
          signed_at: string
          telefone: string | null
          updated_at: string
          valid_until: string
        }
        Insert: {
          aluno_id?: string | null
          attachment_url?: string | null
          cpf: string
          created_at?: string
          data_nascimento?: string | null
          document_type?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          image_usage?: boolean
          ip_address?: string | null
          medical_status: string
          nome: string
          signature_data?: string | null
          signed_at?: string
          telefone?: string | null
          updated_at?: string
          valid_until?: string
        }
        Update: {
          aluno_id?: string | null
          attachment_url?: string | null
          cpf?: string
          created_at?: string
          data_nascimento?: string | null
          document_type?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          image_usage?: boolean
          ip_address?: string | null
          medical_status?: string
          nome?: string
          signature_data?: string | null
          signed_at?: string
          telefone?: string | null
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_annexes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_categorias_custom: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          criado_por: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          criado_por: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          criado_por?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      notificacao_comentarios: {
        Row: {
          anexo_nome: string | null
          anexo_tipo: string | null
          anexo_url: string | null
          comentario: string
          created_at: string
          id: string
          notificacao_id: string
          usuario_id: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_tipo?: string | null
          anexo_url?: string | null
          comentario: string
          created_at?: string
          id?: string
          notificacao_id: string
          usuario_id: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_tipo?: string | null
          anexo_url?: string | null
          comentario?: string
          created_at?: string
          id?: string
          notificacao_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_comentarios_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_destinatarios: {
        Row: {
          assinatura_digital: string | null
          created_at: string
          id: string
          notificacao_id: string
          status: Database["public"]["Enums"]["notif_dest_status"]
          usuario_id: string
          visualizado_em: string | null
        }
        Insert: {
          assinatura_digital?: string | null
          created_at?: string
          id?: string
          notificacao_id: string
          status?: Database["public"]["Enums"]["notif_dest_status"]
          usuario_id: string
          visualizado_em?: string | null
        }
        Update: {
          assinatura_digital?: string | null
          created_at?: string
          id?: string
          notificacao_id?: string
          status?: Database["public"]["Enums"]["notif_dest_status"]
          usuario_id?: string
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_destinatarios_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_historico: {
        Row: {
          acao: Database["public"]["Enums"]["notif_acao"]
          created_at: string
          id: string
          notificacao_id: string
          payload: Json
          usuario_id: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["notif_acao"]
          created_at?: string
          id?: string
          notificacao_id: string
          payload?: Json
          usuario_id?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["notif_acao"]
          created_at?: string
          id?: string
          notificacao_id?: string
          payload?: Json
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_historico_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          agenda_id: string | null
          aluno_id: string | null
          categoria: Database["public"]["Enums"]["notif_categoria"]
          categoria_custom_id: string | null
          created_at: string
          criado_por: string
          descricao: string
          enviar_email: boolean
          enviar_whatsapp: boolean
          id: string
          prazo: string | null
          prioridade: Database["public"]["Enums"]["notif_prioridade"]
          requer_confirmacao_leitura: boolean
          reuniao_data: string | null
          reuniao_local: string | null
          status: Database["public"]["Enums"]["notif_status"]
          tipo: Database["public"]["Enums"]["notif_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          agenda_id?: string | null
          aluno_id?: string | null
          categoria?: Database["public"]["Enums"]["notif_categoria"]
          categoria_custom_id?: string | null
          created_at?: string
          criado_por: string
          descricao: string
          enviar_email?: boolean
          enviar_whatsapp?: boolean
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["notif_prioridade"]
          requer_confirmacao_leitura?: boolean
          reuniao_data?: string | null
          reuniao_local?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          tipo?: Database["public"]["Enums"]["notif_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          agenda_id?: string | null
          aluno_id?: string | null
          categoria?: Database["public"]["Enums"]["notif_categoria"]
          categoria_custom_id?: string | null
          created_at?: string
          criado_por?: string
          descricao?: string
          enviar_email?: boolean
          enviar_whatsapp?: boolean
          id?: string
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["notif_prioridade"]
          requer_confirmacao_leitura?: boolean
          reuniao_data?: string | null
          reuniao_local?: string | null
          status?: Database["public"]["Enums"]["notif_status"]
          tipo?: Database["public"]["Enums"]["notif_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
          endereco: string | null
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
          endereco?: string | null
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
          endereco?: string | null
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
          funnel: Database["public"]["Enums"]["pipeline_funnel"]
          id: string
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          funnel?: Database["public"]["Enums"]["pipeline_funnel"]
          id?: string
          is_active?: boolean
          name: string
          position: number
        }
        Update: {
          color?: string
          created_at?: string
          funnel?: Database["public"]["Enums"]["pipeline_funnel"]
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
      planos_catalogo: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          frequencia: Database["public"]["Enums"]["plano_frequencia"]
          id: string
          ilimitado: boolean
          nome: string
          periodo_meses: number
          quantidade_creditos: number | null
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          frequencia?: Database["public"]["Enums"]["plano_frequencia"]
          id?: string
          ilimitado?: boolean
          nome: string
          periodo_meses?: number
          quantidade_creditos?: number | null
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          frequencia?: Database["public"]["Enums"]["plano_frequencia"]
          id?: string
          ilimitado?: boolean
          nome?: string
          periodo_meses?: number
          quantidade_creditos?: number | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      ponto_ajustes_log: {
        Row: {
          campo: string
          created_at: string
          id: string
          jornada_id: string
          motivo: string
          responsavel_id: string
          usuario_alvo_id: string
          valor_antes: string | null
          valor_depois: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          jornada_id: string
          motivo: string
          responsavel_id: string
          usuario_alvo_id: string
          valor_antes?: string | null
          valor_depois?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          jornada_id?: string
          motivo?: string
          responsavel_id?: string
          usuario_alvo_id?: string
          valor_antes?: string | null
          valor_depois?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_ajustes_log_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "ponto_jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_banco_horas: {
        Row: {
          created_at: string
          data: string
          id: string
          minutos: number
          motivo: string
          referencia_jornada_id: string | null
          registrado_por: string
          tipo: Database["public"]["Enums"]["ponto_banco_tipo"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          minutos: number
          motivo: string
          referencia_jornada_id?: string | null
          registrado_por: string
          tipo?: Database["public"]["Enums"]["ponto_banco_tipo"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          minutos?: number
          motivo?: string
          referencia_jornada_id?: string | null
          registrado_por?: string
          tipo?: Database["public"]["Enums"]["ponto_banco_tipo"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      ponto_configuracoes: {
        Row: {
          carga_diaria_min: number
          created_at: string
          id: string
          intervalo_minimo_min: number
          intervalo_obrigatorio: boolean
          tolerancia_min: number
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          carga_diaria_min?: number
          created_at?: string
          id?: string
          intervalo_minimo_min?: number
          intervalo_obrigatorio?: boolean
          tolerancia_min?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          carga_diaria_min?: number
          created_at?: string
          id?: string
          intervalo_minimo_min?: number
          intervalo_obrigatorio?: boolean
          tolerancia_min?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      ponto_eventos: {
        Row: {
          created_at: string
          data_hora: string
          dispositivo: string | null
          id: string
          jornada_id: string | null
          latitude: number | null
          longitude: number | null
          observacao: string | null
          origem: Database["public"]["Enums"]["ponto_origem"]
          tipo: Database["public"]["Enums"]["ponto_evento_tipo"]
          usuario_id: string
        }
        Insert: {
          created_at?: string
          data_hora?: string
          dispositivo?: string | null
          id?: string
          jornada_id?: string | null
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          origem?: Database["public"]["Enums"]["ponto_origem"]
          tipo: Database["public"]["Enums"]["ponto_evento_tipo"]
          usuario_id: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          dispositivo?: string | null
          id?: string
          jornada_id?: string | null
          latitude?: number | null
          longitude?: number | null
          observacao?: string | null
          origem?: Database["public"]["Enums"]["ponto_origem"]
          tipo?: Database["public"]["Enums"]["ponto_evento_tipo"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_eventos_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "ponto_jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_fechamentos_mensais: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          dias_feriado: number
          dias_ferias: number
          id: string
          mes: string
          minutos_extras: number
          minutos_faltantes: number
          observacao: string | null
          pendencias_count: number
          status: Database["public"]["Enums"]["ponto_fechamento_status"]
          total_minutos: number
          updated_at: string
          usuario_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          dias_feriado?: number
          dias_ferias?: number
          id?: string
          mes: string
          minutos_extras?: number
          minutos_faltantes?: number
          observacao?: string | null
          pendencias_count?: number
          status?: Database["public"]["Enums"]["ponto_fechamento_status"]
          total_minutos?: number
          updated_at?: string
          usuario_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          dias_feriado?: number
          dias_ferias?: number
          id?: string
          mes?: string
          minutos_extras?: number
          minutos_faltantes?: number
          observacao?: string | null
          pendencias_count?: number
          status?: Database["public"]["Enums"]["ponto_fechamento_status"]
          total_minutos?: number
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      ponto_feriados: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          id: string
          tipo: Database["public"]["Enums"]["ponto_feriado_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          descricao: string
          id?: string
          tipo?: Database["public"]["Enums"]["ponto_feriado_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          tipo?: Database["public"]["Enums"]["ponto_feriado_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      ponto_ferias: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          id: string
          observacao: string | null
          tipo: Database["public"]["Enums"]["ponto_ferias_tipo"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["ponto_ferias_tipo"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["ponto_ferias_tipo"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      ponto_horarios_professor: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          frequencia_mensal: number | null
          horario_fim: string
          horario_inicio: string
          id: string
          intervalo_min: number
          updated_at: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          frequencia_mensal?: number | null
          horario_fim: string
          horario_inicio: string
          id?: string
          intervalo_min?: number
          updated_at?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          frequencia_mensal?: number | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_min?: number
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      ponto_jornadas: {
        Row: {
          created_at: string
          data: string
          entrada: string | null
          fechamento_id: string | null
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          minutos_intervalo: number | null
          minutos_trabalhados: number | null
          observacao: string | null
          saida: string | null
          status: Database["public"]["Enums"]["ponto_jornada_status"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          data: string
          entrada?: string | null
          fechamento_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          minutos_intervalo?: number | null
          minutos_trabalhados?: number | null
          observacao?: string | null
          saida?: string | null
          status?: Database["public"]["Enums"]["ponto_jornada_status"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          data?: string
          entrada?: string | null
          fechamento_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          minutos_intervalo?: number | null
          minutos_trabalhados?: number | null
          observacao?: string | null
          saida?: string | null
          status?: Database["public"]["Enums"]["ponto_jornada_status"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ponto_jornadas_fechamento_fk"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "ponto_fechamentos_mensais"
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
      prospect_anamnese: {
        Row: {
          aluno_id: string
          atividade_fisica: string | null
          created_at: string
          id: string
          limitacoes: string | null
          objetivo_treinamento: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          atividade_fisica?: string | null
          created_at?: string
          id?: string
          limitacoes?: string | null
          objetivo_treinamento?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          atividade_fisica?: string | null
          created_at?: string
          id?: string
          limitacoes?: string | null
          objetivo_treinamento?: string | null
          updated_at?: string
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
      servicos_catalogo: {
        Row: {
          atividade: string
          ativo: boolean
          created_at: string
          id: string
          nome: string
          quantidade_sessoes: number
          updated_at: string
          valor: number
        }
        Insert: {
          atividade: string
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          quantidade_sessoes?: number
          updated_at?: string
          valor?: number
        }
        Update: {
          atividade?: string
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          quantidade_sessoes?: number
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      student_workout_progress: {
        Row: {
          aluno_id: string
          concluido_em: string
          data: string
          id: string
          treino_id: string
        }
        Insert: {
          aluno_id: string
          concluido_em?: string
          data?: string
          id?: string
          treino_id: string
        }
        Update: {
          aluno_id?: string
          concluido_em?: string
          data?: string
          id?: string
          treino_id?: string
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
      vendas: {
        Row: {
          aluno_id: string
          catalogo_id: string
          created_at: string
          data_venda: string
          id: string
          nome_snapshot: string
          observacoes: string | null
          plano_id: string | null
          status_pagamento: Database["public"]["Enums"]["venda_status"]
          tipo: Database["public"]["Enums"]["venda_tipo"]
          updated_at: string
          valor: number
          vendedor_id: string | null
        }
        Insert: {
          aluno_id: string
          catalogo_id: string
          created_at?: string
          data_venda?: string
          id?: string
          nome_snapshot: string
          observacoes?: string | null
          plano_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["venda_status"]
          tipo: Database["public"]["Enums"]["venda_tipo"]
          updated_at?: string
          valor?: number
          vendedor_id?: string | null
        }
        Update: {
          aluno_id?: string
          catalogo_id?: string
          created_at?: string
          data_venda?: string
          id?: string
          nome_snapshot?: string
          observacoes?: string | null
          plano_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["venda_status"]
          tipo?: Database["public"]["Enums"]["venda_tipo"]
          updated_at?: string
          valor?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_clube_check_divergencias: { Args: never; Returns: Json }
      fn_clube_dashboard: { Args: { _periodo_dias?: number }; Returns: Json }
      fn_clube_generate_qr_token: { Args: { _aluno_id: string }; Returns: Json }
      fn_clube_hash_cpf: { Args: { _cpf: string }; Returns: string }
      fn_clube_marcar_alerta_lido: {
        Args: { _alerta_id: string }
        Returns: undefined
      }
      fn_clube_nivel_por_plano: { Args: { _aluno_id: string }; Returns: Json }
      fn_clube_resync_todos: { Args: never; Returns: Json }
      fn_clube_resync_todos_safe: { Args: never; Returns: Json }
      fn_clube_sync_membro: { Args: { _aluno_id: string }; Returns: undefined }
      fn_clube_validar_token: {
        Args: { _beneficio_id: string; _token: string }
        Returns: Json
      }
      fn_convert_lead_to_prospect: {
        Args: {
          _aluno_id: string
          _atividade_fisica?: string
          _data_nascimento?: string
          _email?: string
          _limitacoes?: string
          _objetivo_treinamento?: string
          _origem?: string
          _sexo?: string
        }
        Returns: undefined
      }
      fn_current_aluno_id: { Args: never; Returns: string }
      fn_detect_evasao: { Args: never; Returns: Json }
      fn_is_auto_renew_plan: { Args: { _tipo: string }; Returns: boolean }
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
      fn_notificar_criar_notificacao: {
        Args: {
          p_aluno_id?: string
          p_categoria: Database["public"]["Enums"]["notif_categoria"]
          p_descricao: string
          p_destinatarios?: string[]
          p_prazo?: string
          p_prioridade: Database["public"]["Enums"]["notif_prioridade"]
          p_reuniao_data?: string
          p_reuniao_local?: string
          p_tipo: Database["public"]["Enums"]["notif_tipo"]
          p_titulo: string
        }
        Returns: string
      }
      fn_ponto_ajustar_jornada: {
        Args: {
          _campo: string
          _jornada_id: string
          _motivo: string
          _novo_valor: string
        }
        Returns: Json
      }
      fn_ponto_aprovar_fechamento: {
        Args: { _fechamento_id: string }
        Returns: Json
      }
      fn_ponto_banco_resumo: {
        Args: { _mes: string; _user_id: string }
        Returns: Json
      }
      fn_ponto_banco_saldo: {
        Args: { _ate?: string; _user_id: string }
        Returns: number
      }
      fn_ponto_calcular_fechamento: {
        Args: { _mes: string; _user_id: string }
        Returns: Json
      }
      fn_ponto_dashboard_coordenador: {
        Args: { _data?: string }
        Returns: Json
      }
      fn_ponto_dia_ausencia: {
        Args: { _data: string; _user_id: string }
        Returns: string
      }
      fn_ponto_estado_atual: { Args: { _user_id?: string }; Returns: Json }
      fn_ponto_gerar_fechamentos_mes: { Args: { _mes: string }; Returns: Json }
      fn_ponto_registrar: {
        Args: {
          _dispositivo?: string
          _lat?: number
          _lng?: number
          _observacao?: string
          _tipo: Database["public"]["Enums"]["ponto_evento_tipo"]
        }
        Returns: Json
      }
      fn_portal_link_aluno: { Args: never; Returns: Json }
      fn_user_can_see_notificacao: {
        Args: { _notif_id: string; _user_id: string }
        Returns: boolean
      }
      fn_user_created_notificacao: {
        Args: { _notif_id: string; _user_id: string }
        Returns: boolean
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
      rename_exercicio_categoria: {
        Args: {
          p_new_grupo: string
          p_new_sub?: string
          p_old_grupo: string
          p_old_sub?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador"
        | "professor"
        | "nutricionista"
        | "fisioterapeuta"
        | "aluno"
      beneficio_periodicidade: "dia" | "semana" | "mes" | "livre"
      beneficio_tipo:
        | "desconto_percentual"
        | "desconto_valor"
        | "gratuidade"
        | "vantagem_exclusiva"
        | "cashback_futuro"
      clube_alerta_severidade: "info" | "aviso" | "critico"
      clube_alerta_tipo:
        | "cron_falha"
        | "divergencia_nivel"
        | "sincronizacao_parcial"
        | "manual"
      clube_nivel_membro:
        | "start"
        | "start_plus"
        | "power"
        | "pro"
        | "max"
        | "agregador"
      clube_status_membro: "ativo" | "bloqueado" | "inadimplente" | "cancelado"
      credito_movimento_tipo: "compra" | "consumo" | "estorno" | "ajuste"
      notif_acao:
        | "criada"
        | "editada"
        | "visualizada"
        | "respondida"
        | "status_alterado"
        | "arquivada"
        | "comentario"
        | "anexo"
      notif_categoria:
        | "pauta_tecnica"
        | "reuniao"
        | "manutencao"
        | "administrativo"
        | "aluno"
        | "financeiro"
        | "comercial"
        | "marketing"
        | "estrutura"
        | "equipamentos"
        | "emergencial"
        | "outro"
      notif_dest_status:
        | "nao_visualizada"
        | "visualizada"
        | "em_andamento"
        | "respondida"
        | "concluida"
        | "arquivada"
      notif_prioridade: "baixa" | "media" | "alta" | "urgente"
      notif_status:
        | "nao_visualizada"
        | "visualizada"
        | "em_andamento"
        | "respondida"
        | "concluida"
        | "arquivada"
      notif_tipo: "simples" | "solicitacao" | "reuniao" | "manutencao"
      parceiro_modo_validacao: "qr_scan" | "cpf_manual" | "lista_nome"
      pipeline_funnel: "prospects" | "aluno" | "inativo"
      pipeline_movement_source:
        | "manual"
        | "auto_avaliacao"
        | "auto_plano"
        | "auto_agenda"
        | "auto_evasao"
        | "auto_recuperacao"
      plano_frequencia: "1x" | "2x" | "3x" | "livre"
      ponto_banco_tipo:
        | "credito_manual"
        | "debito_manual"
        | "compensacao"
        | "ajuste_saldo"
      ponto_evento_tipo:
        | "entrada"
        | "intervalo_inicio"
        | "intervalo_fim"
        | "saida"
      ponto_fechamento_status: "aberto" | "em_revisao" | "aprovado"
      ponto_feriado_tipo:
        | "nacional"
        | "estadual"
        | "municipal"
        | "facultativo"
        | "recesso"
      ponto_ferias_tipo: "ferias" | "folga" | "atestado" | "licenca"
      ponto_jornada_status:
        | "em_andamento"
        | "em_intervalo"
        | "encerrada"
        | "bloqueada"
      ponto_origem: "web" | "mobile" | "ajuste_manual"
      regra_elegibilidade_tipo:
        | "plano"
        | "frequencia_minima"
        | "status_financeiro"
        | "tempo_matricula"
      uso_origem_validacao: "scanner" | "cpf_manual" | "admin"
      uso_status_validacao: "valido" | "recusado" | "expirado" | "bloqueado"
      venda_status: "pendente" | "pago" | "cancelado"
      venda_tipo: "plano" | "servico"
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
        "aluno",
      ],
      beneficio_periodicidade: ["dia", "semana", "mes", "livre"],
      beneficio_tipo: [
        "desconto_percentual",
        "desconto_valor",
        "gratuidade",
        "vantagem_exclusiva",
        "cashback_futuro",
      ],
      clube_alerta_severidade: ["info", "aviso", "critico"],
      clube_alerta_tipo: [
        "cron_falha",
        "divergencia_nivel",
        "sincronizacao_parcial",
        "manual",
      ],
      clube_nivel_membro: [
        "start",
        "start_plus",
        "power",
        "pro",
        "max",
        "agregador",
      ],
      clube_status_membro: ["ativo", "bloqueado", "inadimplente", "cancelado"],
      credito_movimento_tipo: ["compra", "consumo", "estorno", "ajuste"],
      notif_acao: [
        "criada",
        "editada",
        "visualizada",
        "respondida",
        "status_alterado",
        "arquivada",
        "comentario",
        "anexo",
      ],
      notif_categoria: [
        "pauta_tecnica",
        "reuniao",
        "manutencao",
        "administrativo",
        "aluno",
        "financeiro",
        "comercial",
        "marketing",
        "estrutura",
        "equipamentos",
        "emergencial",
        "outro",
      ],
      notif_dest_status: [
        "nao_visualizada",
        "visualizada",
        "em_andamento",
        "respondida",
        "concluida",
        "arquivada",
      ],
      notif_prioridade: ["baixa", "media", "alta", "urgente"],
      notif_status: [
        "nao_visualizada",
        "visualizada",
        "em_andamento",
        "respondida",
        "concluida",
        "arquivada",
      ],
      notif_tipo: ["simples", "solicitacao", "reuniao", "manutencao"],
      parceiro_modo_validacao: ["qr_scan", "cpf_manual", "lista_nome"],
      pipeline_funnel: ["prospects", "aluno", "inativo"],
      pipeline_movement_source: [
        "manual",
        "auto_avaliacao",
        "auto_plano",
        "auto_agenda",
        "auto_evasao",
        "auto_recuperacao",
      ],
      plano_frequencia: ["1x", "2x", "3x", "livre"],
      ponto_banco_tipo: [
        "credito_manual",
        "debito_manual",
        "compensacao",
        "ajuste_saldo",
      ],
      ponto_evento_tipo: [
        "entrada",
        "intervalo_inicio",
        "intervalo_fim",
        "saida",
      ],
      ponto_fechamento_status: ["aberto", "em_revisao", "aprovado"],
      ponto_feriado_tipo: [
        "nacional",
        "estadual",
        "municipal",
        "facultativo",
        "recesso",
      ],
      ponto_ferias_tipo: ["ferias", "folga", "atestado", "licenca"],
      ponto_jornada_status: [
        "em_andamento",
        "em_intervalo",
        "encerrada",
        "bloqueada",
      ],
      ponto_origem: ["web", "mobile", "ajuste_manual"],
      regra_elegibilidade_tipo: [
        "plano",
        "frequencia_minima",
        "status_financeiro",
        "tempo_matricula",
      ],
      uso_origem_validacao: ["scanner", "cpf_manual", "admin"],
      uso_status_validacao: ["valido", "recusado", "expirado", "bloqueado"],
      venda_status: ["pendente", "pago", "cancelado"],
      venda_tipo: ["plano", "servico"],
    },
  },
} as const
