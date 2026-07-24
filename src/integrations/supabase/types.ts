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
      adquirentes_config: {
        Row: {
          adquirente: string
          aluguel_mensal: number
          ativo: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adquirente?: string
          aluguel_mensal?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adquirente?: string
          aluguel_mensal?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      adquirentes_taxas: {
        Row: {
          adquirente: string
          ativo: boolean
          bandeira: Database["public"]["Enums"]["adquirente_bandeira"]
          created_at: string
          id: string
          modalidade: Database["public"]["Enums"]["adquirente_modalidade"]
          prazo_recebimento_dias: number | null
          taxa_percentual: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adquirente?: string
          ativo?: boolean
          bandeira: Database["public"]["Enums"]["adquirente_bandeira"]
          created_at?: string
          id?: string
          modalidade: Database["public"]["Enums"]["adquirente_modalidade"]
          prazo_recebimento_dias?: number | null
          taxa_percentual?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adquirente?: string
          ativo?: boolean
          bandeira?: Database["public"]["Enums"]["adquirente_bandeira"]
          created_at?: string
          id?: string
          modalidade?: Database["public"]["Enums"]["adquirente_modalidade"]
          prazo_recebimento_dias?: number | null
          taxa_percentual?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      agenda_diaria_log: {
        Row: {
          data: string
          enviado_em: string
          id: string
          profissional_id: string
          total_eventos: number
        }
        Insert: {
          data: string
          enviado_em?: string
          id?: string
          profissional_id: string
          total_eventos?: number
        }
        Update: {
          data?: string
          enviado_em?: string
          id?: string
          profissional_id?: string
          total_eventos?: number
        }
        Relationships: []
      }
      agenda_notificacoes_log: {
        Row: {
          agenda_id: string
          enviado_em: string
          evento: string
          id: string
          origem: string | null
        }
        Insert: {
          agenda_id: string
          enviado_em?: string
          evento: string
          id?: string
          origem?: string | null
        }
        Update: {
          agenda_id?: string
          enviado_em?: string
          evento?: string
          id?: string
          origem?: string | null
        }
        Relationships: []
      }
      agenda_presencas: {
        Row: {
          agenda_id: string
          comparecimento: boolean
          created_at: string
          data: string
          id: string
          marcado_por: string
          observacao: string | null
          updated_at: string
        }
        Insert: {
          agenda_id: string
          comparecimento: boolean
          created_at?: string
          data: string
          id?: string
          marcado_por: string
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          agenda_id?: string
          comparecimento?: boolean
          created_at?: string
          data?: string
          id?: string
          marcado_por?: string
          observacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_presencas_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agenda_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_presencas_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "v_servicos_agenda"
            referencedColumns: ["agenda_id"]
          },
        ]
      }
      agenda_servicos: {
        Row: {
          aluno_id: string | null
          atividade: string
          consultor_id: string | null
          created_at: string
          credito_origem: string | null
          data_especifica: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id: string
          local: string
          observacoes: string | null
          profissional_id: string
          protocolo: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          atividade: string
          consultor_id?: string | null
          created_at?: string
          credito_origem?: string | null
          data_especifica?: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id?: string
          local: string
          observacoes?: string | null
          profissional_id: string
          protocolo?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          atividade?: string
          consultor_id?: string | null
          created_at?: string
          credito_origem?: string | null
          data_especifica?: string | null
          dia_semana?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          local?: string
          observacoes?: string | null
          profissional_id?: string
          protocolo?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      agenda_servicos_excecoes: {
        Row: {
          agenda_id: string
          created_at: string
          created_by: string | null
          data_excecao: string
          id: string
        }
        Insert: {
          agenda_id: string
          created_at?: string
          created_by?: string | null
          data_excecao: string
          id?: string
        }
        Update: {
          agenda_id?: string
          created_at?: string
          created_by?: string | null
          data_excecao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_servicos_excecoes_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agenda_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_servicos_excecoes_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "v_servicos_agenda"
            referencedColumns: ["agenda_id"]
          },
        ]
      }
      aluno_calendar_tokens: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          token: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          token: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_calendar_tokens_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_calendar_tokens_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
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
          aluno_2025: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          cpf_hash: string | null
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
          rg: string | null
          sexo: string | null
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aluno_2025?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          cpf_hash?: string | null
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
          rg?: string | null
          sexo?: string | null
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aluno_2025?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          cpf_hash?: string | null
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
          rg?: string | null
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
      assistant_conversations: {
        Row: {
          aluno_id: string | null
          created_at: string
          escalou_em: string | null
          escalou_para_humano: boolean
          id: string
          messages: Json
          resolvido: boolean | null
          updated_at: string
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          escalou_em?: string | null
          escalou_para_humano?: boolean
          id?: string
          messages?: Json
          resolvido?: boolean | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          escalou_em?: string | null
          escalou_para_humano?: boolean
          id?: string
          messages?: Json
          resolvido?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_conversations_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_conversations_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      audit_log: {
        Row: {
          created_at: string
          dados_antes: Json | null
          dados_depois: Json | null
          id: string
          operacao: string
          registro_id: string | null
          tabela: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          operacao: string
          registro_id?: string | null
          tabela: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          id?: string
          operacao?: string
          registro_id?: string | null
          tabela?: string
          user_id?: string | null
        }
        Relationships: []
      }
      avaliacao_anexos: {
        Row: {
          avaliacao_id: string
          created_at: string
          id: string
          nome_arquivo: string
          storage_path: string
          tipo: string
          uploaded_by: string
        }
        Insert: {
          avaliacao_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          storage_path: string
          tipo?: string
          uploaded_by: string
        }
        Update: {
          avaliacao_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          storage_path?: string
          tipo?: string
          uploaded_by?: string
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
      avaliacao_pliometria: {
        Row: {
          assimetria: number | null
          avaliacao_id: string
          created_at: string
          id: string
          observacoes: string | null
          potencia: number | null
          rsi: number | null
          salto_horizontal: number | null
          salto_vertical: number | null
          stiffness: number | null
          tempo_contato: number | null
        }
        Insert: {
          assimetria?: number | null
          avaliacao_id: string
          created_at?: string
          id?: string
          observacoes?: string | null
          potencia?: number | null
          rsi?: number | null
          salto_horizontal?: number | null
          salto_vertical?: number | null
          stiffness?: number | null
          tempo_contato?: number | null
        }
        Update: {
          assimetria?: number | null
          avaliacao_id?: string
          created_at?: string
          id?: string
          observacoes?: string | null
          potencia?: number | null
          rsi?: number | null
          salto_horizontal?: number | null
          salto_vertical?: number | null
          stiffness?: number | null
          tempo_contato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_pliometria_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: true
            referencedRelation: "avaliacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_protocolos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          is_default: boolean
          nome: string
          ordem: number
          permite_upload: boolean
          schema: Json
          tipo_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          is_default?: boolean
          nome: string
          ordem?: number
          permite_upload?: boolean
          schema?: Json
          tipo_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          is_default?: boolean
          nome?: string
          ordem?: number
          permite_upload?: boolean
          schema?: Json
          tipo_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_protocolos_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_templates: {
        Row: {
          id: string
          schema: Json
          tipo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          schema?: Json
          tipo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          schema?: Json
          tipo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      avaliacao_tipos: {
        Row: {
          ativo: boolean
          created_at: string
          engine: string
          icone: string | null
          id: string
          is_sistema: boolean
          nome: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          engine?: string
          icone?: string | null
          id?: string
          is_sistema?: boolean
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          engine?: string
          icone?: string | null
          id?: string
          is_sistema?: boolean
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          origem: string
          protocolo_id: string | null
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
          origem?: string
          protocolo_id?: string | null
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
          origem?: string
          protocolo_id?: string | null
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
          {
            foreignKeyName: "avaliacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "avaliacoes_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "avaliacao_protocolos"
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
          {
            foreignKeyName: "beneficios_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      bodymap_region_overrides: {
        Row: {
          cx: number
          cy: number
          region_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cx: number
          cy: number
          region_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cx?: number
          cy?: number
          region_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cadastro_trabalhista: {
        Row: {
          art_62_clt: boolean
          banco_horas_ativo: boolean
          carga_horaria_semanal_min: number | null
          created_at: string
          elegivel_ponto: boolean
          id: string
          limite_diario_min: number | null
          observacoes: string | null
          tipo_vinculo: Database["public"]["Enums"]["tipo_vinculo_trabalhista"]
          updated_at: string
          usuario_id: string
          valor_hora_aula: number | null
        }
        Insert: {
          art_62_clt?: boolean
          banco_horas_ativo?: boolean
          carga_horaria_semanal_min?: number | null
          created_at?: string
          elegivel_ponto?: boolean
          id?: string
          limite_diario_min?: number | null
          observacoes?: string | null
          tipo_vinculo?: Database["public"]["Enums"]["tipo_vinculo_trabalhista"]
          updated_at?: string
          usuario_id: string
          valor_hora_aula?: number | null
        }
        Update: {
          art_62_clt?: boolean
          banco_horas_ativo?: boolean
          carga_horaria_semanal_min?: number | null
          created_at?: string
          elegivel_ponto?: boolean
          id?: string
          limite_diario_min?: number | null
          observacoes?: string | null
          tipo_vinculo?: Database["public"]["Enums"]["tipo_vinculo_trabalhista"]
          updated_at?: string
          usuario_id?: string
          valor_hora_aula?: number | null
        }
        Relationships: []
      }
      cancelamento_motivos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      cartoes_salvos: {
        Row: {
          aluno_id: string
          ativo: boolean
          brand: string
          created_at: string
          expiration_month: number
          expiration_year: number
          holder_name: string
          id: string
          is_default: boolean
          last4: string
          origem: string
          token_rede: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          brand: string
          created_at?: string
          expiration_month: number
          expiration_year: number
          holder_name: string
          id?: string
          is_default?: boolean
          last4: string
          origem?: string
          token_rede: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          brand?: string
          created_at?: string
          expiration_month?: number
          expiration_year?: number
          holder_name?: string
          id?: string
          is_default?: boolean
          last4?: string
          origem?: string
          token_rede?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_salvos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_salvos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      ciclos_credito: {
        Row: {
          cobranca_id: string | null
          contrato_id: string
          created_at: string
          creditos_liberados: number
          creditos_usados: number
          data_fim: string | null
          data_inicio: string
          id: string
          status: string
        }
        Insert: {
          cobranca_id?: string | null
          contrato_id: string
          created_at?: string
          creditos_liberados: number
          creditos_usados?: number
          data_fim?: string | null
          data_inicio: string
          id?: string
          status?: string
        }
        Update: {
          cobranca_id?: string | null
          contrato_id?: string
          created_at?: string
          creditos_liberados?: number
          creditos_usados?: number
          data_fim?: string | null
          data_inicio?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_credito_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclos_credito_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
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
      clube_aluno_badges: {
        Row: {
          aluno_id: string
          badge_id: string
          conquistado_em: string
          id: string
        }
        Insert: {
          aluno_id: string
          badge_id: string
          conquistado_em?: string
          id?: string
        }
        Update: {
          aluno_id?: string
          badge_id?: string
          conquistado_em?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clube_aluno_badges_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_aluno_badges_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "clube_aluno_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "clube_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      clube_badges: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          criterio: string
          descricao: string
          emoji: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          criterio: string
          descricao: string
          emoji?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          criterio?: string
          descricao?: string
          emoji?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      clube_clima_cache: {
        Row: {
          consultado_em: string
          data: string
          id: string
          motivo: string | null
          multiplicador_ativo: boolean
          precipitacao_mm: number | null
          temperatura_max: number | null
          temperatura_min: number | null
        }
        Insert: {
          consultado_em?: string
          data: string
          id?: string
          motivo?: string | null
          multiplicador_ativo?: boolean
          precipitacao_mm?: number | null
          temperatura_max?: number | null
          temperatura_min?: number | null
        }
        Update: {
          consultado_em?: string
          data?: string
          id?: string
          motivo?: string | null
          multiplicador_ativo?: boolean
          precipitacao_mm?: number | null
          temperatura_max?: number | null
          temperatura_min?: number | null
        }
        Relationships: []
      }
      clube_config: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string
          updated_by: string | null
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
          valor?: string
        }
        Relationships: []
      }
      clube_desafios: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          mensagem_recompensa: string | null
          meta_atingida: boolean
          meta_atingida_em: string | null
          pontos_recompensa: number | null
          progresso_atual: number
          recompensa_distribuida: boolean
          recompensa_distribuida_em: string | null
          status: string
          tipo_meta: string
          tipo_recompensa: string
          titulo: string
          updated_at: string
          valor_meta: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          mensagem_recompensa?: string | null
          meta_atingida?: boolean
          meta_atingida_em?: string | null
          pontos_recompensa?: number | null
          progresso_atual?: number
          recompensa_distribuida?: boolean
          recompensa_distribuida_em?: string | null
          status?: string
          tipo_meta: string
          tipo_recompensa?: string
          titulo: string
          updated_at?: string
          valor_meta: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          mensagem_recompensa?: string | null
          meta_atingida?: boolean
          meta_atingida_em?: string | null
          pontos_recompensa?: number | null
          progresso_atual?: number
          recompensa_distribuida?: boolean
          recompensa_distribuida_em?: string | null
          status?: string
          tipo_meta?: string
          tipo_recompensa?: string
          titulo?: string
          updated_at?: string
          valor_meta?: number
        }
        Relationships: []
      }
      clube_desafios_log: {
        Row: {
          aluno_id: string | null
          created_at: string
          desafio_id: string
          id: string
          pontos_recebidos: number | null
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          desafio_id: string
          id?: string
          pontos_recebidos?: number | null
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          desafio_id?: string
          id?: string
          pontos_recebidos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clube_desafios_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_desafios_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "clube_desafios_log_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "clube_desafios"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "clube_fortem_membros_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      clube_historico: {
        Row: {
          acao: string
          aluno_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string
          motivo_manual: string | null
          multiplicador: number
          multiplicador_clima: boolean
          pontos: number
          pontos_final: number
          referencia_id: string | null
          referencia_tipo: string | null
        }
        Insert: {
          acao: string
          aluno_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          motivo_manual?: string | null
          multiplicador?: number
          multiplicador_clima?: boolean
          pontos: number
          pontos_final: number
          referencia_id?: string | null
          referencia_tipo?: string | null
        }
        Update: {
          acao?: string
          aluno_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          motivo_manual?: string | null
          multiplicador?: number
          multiplicador_clima?: boolean
          pontos?: number
          pontos_final?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clube_historico_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_historico_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      clube_indicacoes: {
        Row: {
          codigo: string
          convertido_em: string | null
          created_at: string
          id: string
          indicado_id: string | null
          padrinho_id: string
          status: string
        }
        Insert: {
          codigo?: string
          convertido_em?: string | null
          created_at?: string
          id?: string
          indicado_id?: string | null
          padrinho_id: string
          status?: string
        }
        Update: {
          codigo?: string
          convertido_em?: string | null
          created_at?: string
          id?: string
          indicado_id?: string | null
          padrinho_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clube_indicacoes_indicado_id_fkey"
            columns: ["indicado_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_indicacoes_indicado_id_fkey"
            columns: ["indicado_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "clube_indicacoes_padrinho_id_fkey"
            columns: ["padrinho_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_indicacoes_padrinho_id_fkey"
            columns: ["padrinho_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      clube_pontos: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          nivel: string
          pontos_expiram_em: string | null
          ranking_publico: boolean
          saldo: number
          total_acumulado: number
          total_resgatado: number
          ultima_movimentacao: string | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          nivel?: string
          pontos_expiram_em?: string | null
          ranking_publico?: boolean
          saldo?: number
          total_acumulado?: number
          total_resgatado?: number
          ultima_movimentacao?: string | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          nivel?: string
          pontos_expiram_em?: string | null
          ranking_publico?: boolean
          saldo?: number
          total_acumulado?: number
          total_resgatado?: number
          ultima_movimentacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clube_pontos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_pontos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      clube_ranking_snapshots: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          periodo: string
          pontos_periodo: number
          posicao: number | null
          referencia: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          periodo: string
          pontos_periodo?: number
          posicao?: number | null
          referencia: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          periodo?: string
          pontos_periodo?: number
          posicao?: number | null
          referencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "clube_ranking_snapshots_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_ranking_snapshots_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      clube_recompensas: {
        Row: {
          ativo: boolean
          created_at: string
          custo_agregador: number | null
          custo_max: number | null
          custo_pontos: number
          custo_power: number | null
          custo_pro: number | null
          custo_start: number | null
          custo_start_plus: number | null
          descricao: string | null
          estoque: number | null
          icone: string | null
          id: string
          nome: string
          planos_elegiveis: string[] | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_agregador?: number | null
          custo_max?: number | null
          custo_pontos: number
          custo_power?: number | null
          custo_pro?: number | null
          custo_start?: number | null
          custo_start_plus?: number | null
          descricao?: string | null
          estoque?: number | null
          icone?: string | null
          id?: string
          nome: string
          planos_elegiveis?: string[] | null
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_agregador?: number | null
          custo_max?: number | null
          custo_pontos?: number
          custo_power?: number | null
          custo_pro?: number | null
          custo_start?: number | null
          custo_start_plus?: number | null
          descricao?: string | null
          estoque?: number | null
          icone?: string | null
          id?: string
          nome?: string
          planos_elegiveis?: string[] | null
          tipo?: string
        }
        Relationships: []
      }
      clube_regras_pontuacao: {
        Row: {
          acao: string
          ativo: boolean
          created_at: string
          id: string
          label: string
          pontos: number
          unica_vez: boolean
        }
        Insert: {
          acao: string
          ativo?: boolean
          created_at?: string
          id?: string
          label: string
          pontos?: number
          unica_vez?: boolean
        }
        Update: {
          acao?: string
          ativo?: boolean
          created_at?: string
          id?: string
          label?: string
          pontos?: number
          unica_vez?: boolean
        }
        Relationships: []
      }
      clube_resgates: {
        Row: {
          aluno_id: string
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          id: string
          observacoes: string | null
          pontos_utilizados: number
          recompensa_id: string
          status: string
        }
        Insert: {
          aluno_id: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          pontos_utilizados: number
          recompensa_id: string
          status?: string
        }
        Update: {
          aluno_id?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          pontos_utilizados?: number
          recompensa_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clube_resgates_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clube_resgates_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "clube_resgates_recompensa_id_fkey"
            columns: ["recompensa_id"]
            isOneToOne: false
            referencedRelation: "clube_recompensas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_tentativas: {
        Row: {
          canal: string
          created_at: string
          criado_por: string | null
          id: string
          observacao: string | null
          parcela_id: string
          resultado: string | null
        }
        Insert: {
          canal: string
          created_at?: string
          criado_por?: string | null
          id?: string
          observacao?: string | null
          parcela_id: string
          resultado?: string | null
        }
        Update: {
          canal?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          observacao?: string | null
          parcela_id?: string
          resultado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_tentativas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "pagamento_parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_tentativas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "v_financeiro_aberto"
            referencedColumns: ["parcela_id"]
          },
          {
            foreignKeyName: "cobranca_tentativas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "v_financeiro_recebimentos"
            referencedColumns: ["parcela_id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          aluno_id: string
          comprovante_url: string | null
          contrato_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string
          gateway: string | null
          id: string
          meio_registro: string
          numero_ciclo: number
          registrado_por: string | null
          status: string
          tid: string | null
          valor: number
        }
        Insert: {
          aluno_id: string
          comprovante_url?: string | null
          contrato_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento: string
          gateway?: string | null
          id?: string
          meio_registro?: string
          numero_ciclo: number
          registrado_por?: string | null
          status?: string
          tid?: string | null
          valor: number
        }
        Update: {
          aluno_id?: string
          comprovante_url?: string | null
          contrato_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string
          gateway?: string | null
          id?: string
          meio_registro?: string
          numero_ciclo?: number
          registrado_por?: string | null
          status?: string
          tid?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      comissionamento_config: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          meta_minima: number
          regras_json: Json
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          updated_at: string
          updated_by: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta_minima?: number
          regras_json?: Json
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta_minima?: number
          regras_json?: Json
          tipo?: Database["public"]["Enums"]["comissao_tipo"]
          updated_at?: string
          updated_by?: string | null
          valor?: number
        }
        Relationships: []
      }
      comissionamento_pendencias: {
        Row: {
          agenda_id: string | null
          aluno_id: string | null
          avaliacao_id: string | null
          comissionamento_id: string | null
          concluido: boolean
          concluido_em: string | null
          created_at: string
          descricao: string | null
          id: string
          profissional_id: string
          responsavel_id: string | null
          tipo_pendencia: Database["public"]["Enums"]["comissao_pendencia_tipo"]
          updated_at: string
        }
        Insert: {
          agenda_id?: string | null
          aluno_id?: string | null
          avaliacao_id?: string | null
          comissionamento_id?: string | null
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          profissional_id: string
          responsavel_id?: string | null
          tipo_pendencia: Database["public"]["Enums"]["comissao_pendencia_tipo"]
          updated_at?: string
        }
        Update: {
          agenda_id?: string | null
          aluno_id?: string | null
          avaliacao_id?: string | null
          comissionamento_id?: string | null
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          profissional_id?: string
          responsavel_id?: string | null
          tipo_pendencia?: Database["public"]["Enums"]["comissao_pendencia_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissionamento_pendencias_comissionamento_id_fkey"
            columns: ["comissionamento_id"]
            isOneToOne: false
            referencedRelation: "comissionamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      comissionamentos: {
        Row: {
          aluno_id: string | null
          aprovado_por: string | null
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          data_referencia: string
          descricao: string | null
          id: string
          observacoes: string | null
          origem_id: string | null
          origem_tabela: string | null
          profissional_id: string
          status: Database["public"]["Enums"]["comissao_status"]
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          updated_at: string
          valor: number
        }
        Insert: {
          aluno_id?: string | null
          aprovado_por?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_referencia?: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          origem_id?: string | null
          origem_tabela?: string | null
          profissional_id: string
          status?: Database["public"]["Enums"]["comissao_status"]
          tipo: Database["public"]["Enums"]["comissao_tipo"]
          updated_at?: string
          valor?: number
        }
        Update: {
          aluno_id?: string | null
          aprovado_por?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_referencia?: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          origem_id?: string | null
          origem_tabela?: string | null
          profissional_id?: string
          status?: Database["public"]["Enums"]["comissao_status"]
          tipo?: Database["public"]["Enums"]["comissao_tipo"]
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      consumo_servicos: {
        Row: {
          agenda_id: string | null
          aluno_id: string
          contrato_id: string | null
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
          contrato_id?: string | null
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
          contrato_id?: string | null
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
            foreignKeyName: "consumo_servicos_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "v_servicos_agenda"
            referencedColumns: ["agenda_id"]
          },
          {
            foreignKeyName: "consumo_servicos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_servicos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "consumo_servicos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_servicos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_servicos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "v_planos_base"
            referencedColumns: ["plano_id"]
          },
        ]
      }
      contrato_templates: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string
          criado_por: string | null
          forma_pagamento: string
          id: string
          nome: string
          plano_tipo: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          conteudo: string
          created_at?: string
          criado_por?: string | null
          forma_pagamento: string
          id?: string
          nome: string
          plano_tipo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          forma_pagamento?: string
          id?: string
          nome?: string
          plano_tipo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      contratos: {
        Row: {
          aluno_id: string
          cartao_token_id: string | null
          created_at: string
          creditos_total: number
          criado_por: string | null
          data_cancelamento: string | null
          data_fim: string | null
          data_inicio: string
          data_renovacao: string | null
          forma_pagamento: string
          frequencia_semanal: number
          id: string
          indice_reajuste: string | null
          motivo_cancelamento: string | null
          multa_percentual: number | null
          notificacao_30d_enviada: boolean
          observacoes: string | null
          parcelas: number
          percentual_reajuste: number | null
          plano_id: string | null
          plano_tipo: string
          servicos_inclusos: Json | null
          status: string
          taxa_recorrencia: number
          updated_at: string
          valor_base: number
          valor_cobrado: number
          vigencia_tipo: string
        }
        Insert: {
          aluno_id: string
          cartao_token_id?: string | null
          created_at?: string
          creditos_total: number
          criado_por?: string | null
          data_cancelamento?: string | null
          data_fim?: string | null
          data_inicio: string
          data_renovacao?: string | null
          forma_pagamento: string
          frequencia_semanal: number
          id?: string
          indice_reajuste?: string | null
          motivo_cancelamento?: string | null
          multa_percentual?: number | null
          notificacao_30d_enviada?: boolean
          observacoes?: string | null
          parcelas?: number
          percentual_reajuste?: number | null
          plano_id?: string | null
          plano_tipo: string
          servicos_inclusos?: Json | null
          status?: string
          taxa_recorrencia?: number
          updated_at?: string
          valor_base: number
          valor_cobrado: number
          vigencia_tipo: string
        }
        Update: {
          aluno_id?: string
          cartao_token_id?: string | null
          created_at?: string
          creditos_total?: number
          criado_por?: string | null
          data_cancelamento?: string | null
          data_fim?: string | null
          data_inicio?: string
          data_renovacao?: string | null
          forma_pagamento?: string
          frequencia_semanal?: number
          id?: string
          indice_reajuste?: string | null
          motivo_cancelamento?: string | null
          multa_percentual?: number | null
          notificacao_30d_enviada?: boolean
          observacoes?: string | null
          parcelas?: number
          percentual_reajuste?: number | null
          plano_id?: string | null
          plano_tipo?: string
          servicos_inclusos?: Json | null
          status?: string
          taxa_recorrencia?: number
          updated_at?: string
          valor_base?: number
          valor_cobrado?: number
          vigencia_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "contratos_cartao_token_id_fkey"
            columns: ["cartao_token_id"]
            isOneToOne: false
            referencedRelation: "cartoes_salvos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "v_planos_base"
            referencedColumns: ["plano_id"]
          },
        ]
      }
      contratos_documentos: {
        Row: {
          aceite: boolean
          aluno_id: string
          assinatura: string | null
          conteudo_gerado: string
          contrato_id: string
          created_at: string
          data_aceite: string | null
          formato_aceite: string | null
          id: string
          ip_aceite: string | null
          regulamento_versao: number
          template_id: string | null
          template_versao: number
          variaveis_utilizadas: Json
        }
        Insert: {
          aceite?: boolean
          aluno_id: string
          assinatura?: string | null
          conteudo_gerado: string
          contrato_id: string
          created_at?: string
          data_aceite?: string | null
          formato_aceite?: string | null
          id?: string
          ip_aceite?: string | null
          regulamento_versao: number
          template_id?: string | null
          template_versao: number
          variaveis_utilizadas?: Json
        }
        Update: {
          aceite?: boolean
          aluno_id?: string
          assinatura?: string | null
          conteudo_gerado?: string
          contrato_id?: string
          created_at?: string
          data_aceite?: string | null
          formato_aceite?: string | null
          id?: string
          ip_aceite?: string | null
          regulamento_versao?: number
          template_id?: string | null
          template_versao?: number
          variaveis_utilizadas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contratos_documentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_documentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "contratos_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_documentos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contrato_templates"
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
          {
            foreignKeyName: "creditos_aluno_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          permite_parcelamento: boolean
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          permite_parcelamento?: boolean
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          permite_parcelamento?: boolean
          slug?: string
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
          {
            foreignKeyName: "historico_profissional_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      inadimplencias: {
        Row: {
          aluno_id: string
          cobranca_id: string
          contrato_id: string
          created_at: string
          data_regularizacao: string | null
          data_vencimento: string
          id: string
          notificacoes: Json
          status: string
          valor: number
        }
        Insert: {
          aluno_id: string
          cobranca_id: string
          contrato_id: string
          created_at?: string
          data_regularizacao?: string | null
          data_vencimento: string
          id?: string
          notificacoes?: Json
          status?: string
          valor: number
        }
        Update: {
          aluno_id?: string
          cobranca_id?: string
          contrato_id?: string
          created_at?: string
          data_regularizacao?: string | null
          data_vencimento?: string
          id?: string
          notificacoes?: Json
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "inadimplencias_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inadimplencias_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "inadimplencias_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inadimplencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      inter_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          scope: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          scope?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          scope?: string | null
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          aliases: string[] | null
          ativo: boolean
          category_id: string
          created_at: string
          created_by: string | null
          id: string
          palavras_chave: string[] | null
          pergunta: string
          resposta: string
          updated_at: string
          updated_by: string | null
          util_nao: number
          util_sim: number
          visualizacoes: number
        }
        Insert: {
          aliases?: string[] | null
          ativo?: boolean
          category_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          palavras_chave?: string[] | null
          pergunta: string
          resposta: string
          updated_at?: string
          updated_by?: string | null
          util_nao?: number
          util_sim?: number
          visualizacoes?: number
        }
        Update: {
          aliases?: string[] | null
          ativo?: boolean
          category_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          palavras_chave?: string[] | null
          pergunta?: string
          resposta?: string
          updated_at?: string
          updated_by?: string | null
          util_nao?: number
          util_sim?: number
          visualizacoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_categories: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
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
          cpf_hash: string | null
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
          cpf_hash?: string | null
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
          cpf_hash?: string | null
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
          {
            foreignKeyName: "legal_annexes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
      notificacao_email_config: {
        Row: {
          agenda_diaria_horario: string
          atividades_monitoradas: string[]
          destinatarios_regra: string
          emails_extras: string[]
          enviar_agenda_diaria: boolean
          enviar_em_agendamento: boolean
          enviar_em_cancelamento: boolean
          enviar_notificacao_nova: boolean
          enviar_notificacao_resposta: boolean
          enviar_tarefa_automatica: boolean
          enviar_tarefa_criada: boolean
          exigir_aluno_vinculado: boolean
          id: number
          remetente_email: string
          remetente_nome: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agenda_diaria_horario?: string
          atividades_monitoradas?: string[]
          destinatarios_regra?: string
          emails_extras?: string[]
          enviar_agenda_diaria?: boolean
          enviar_em_agendamento?: boolean
          enviar_em_cancelamento?: boolean
          enviar_notificacao_nova?: boolean
          enviar_notificacao_resposta?: boolean
          enviar_tarefa_automatica?: boolean
          enviar_tarefa_criada?: boolean
          exigir_aluno_vinculado?: boolean
          id?: number
          remetente_email?: string
          remetente_nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agenda_diaria_horario?: string
          atividades_monitoradas?: string[]
          destinatarios_regra?: string
          emails_extras?: string[]
          enviar_agenda_diaria?: boolean
          enviar_em_agendamento?: boolean
          enviar_em_cancelamento?: boolean
          enviar_notificacao_nova?: boolean
          enviar_notificacao_resposta?: boolean
          enviar_tarefa_automatica?: boolean
          enviar_tarefa_criada?: boolean
          exigir_aluno_vinculado?: boolean
          id?: number
          remetente_email?: string
          remetente_nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notificacao_email_log: {
        Row: {
          enviado_em: string
          evento: string
          id: string
          notificacao_id: string
          usuario_id: string | null
        }
        Insert: {
          enviado_em?: string
          evento: string
          id?: string
          notificacao_id: string
          usuario_id?: string | null
        }
        Update: {
          enviado_em?: string
          evento?: string
          id?: string
          notificacao_id?: string
          usuario_id?: string | null
        }
        Relationships: []
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
      pagamento_parcelas: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          forma_pagamento: string | null
          id: string
          numero: number
          observacoes: string | null
          pagamento_id: string
          status: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          numero: number
          observacoes?: string | null
          pagamento_id: string
          status?: string
          updated_at?: string
          valor?: number
          vencimento: string
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          pagamento_id?: string
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_parcelas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          aluno_id: string
          created_at: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          parcelas_qtd: number
          plano_id: string | null
          status: string
          updated_at: string
          valor_total: number
          venda_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          parcelas_qtd?: number
          plano_id?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
          venda_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          parcelas_qtd?: number
          plano_id?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "pagamentos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "v_planos_base"
            referencedColumns: ["plano_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_cancelamentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_resumo"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_rede: {
        Row: {
          amount: number
          authorization_code: string | null
          created_at: string
          created_by: string | null
          id: string
          installments: number
          kind: string
          nsu: string | null
          raw_response: Json | null
          return_code: string | null
          return_message: string | null
          status: string
          tid: string | null
          venda_id: string
        }
        Insert: {
          amount: number
          authorization_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installments?: number
          kind?: string
          nsu?: string | null
          raw_response?: Json | null
          return_code?: string | null
          return_message?: string | null
          status?: string
          tid?: string | null
          venda_id: string
        }
        Update: {
          amount?: number
          authorization_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installments?: number
          kind?: string
          nsu?: string | null
          raw_response?: Json | null
          return_code?: string | null
          return_message?: string | null
          status?: string
          tid?: string | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_rede_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_cancelamentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_rede_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_resumo"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_rede_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
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
          senha_hash: string | null
          ultimo_acesso: string | null
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
          senha_hash?: string | null
          ultimo_acesso?: string | null
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
          senha_hash?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pipedrive_stage_mapping: {
        Row: {
          created_at: string
          fortem_stage_id: string
          pipedrive_stage_id: number
          pipedrive_stage_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fortem_stage_id: string
          pipedrive_stage_id: number
          pipedrive_stage_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fortem_stage_id?: string
          pipedrive_stage_id?: number
          pipedrive_stage_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_stage_mapping_fortem_stage_id_fkey"
            columns: ["fortem_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_metadata: {
        Row: {
          aluno_id: string
          created_at: string
          data_prevista_fechamento: string | null
          last_contact_at: string | null
          next_followup_at: string | null
          notas: string | null
          origem_lead: string | null
          pipedrive_deal_id: string | null
          pipedrive_imported_at: string | null
          pipedrive_person_id: string | null
          plano_interesse: string | null
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
          notas?: string | null
          origem_lead?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_imported_at?: string | null
          pipedrive_person_id?: string | null
          plano_interesse?: string | null
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
          notas?: string | null
          origem_lead?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_imported_at?: string | null
          pipedrive_person_id?: string | null
          plano_interesse?: string | null
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
          {
            foreignKeyName: "pipeline_metadata_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
            foreignKeyName: "pipeline_movements_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
          probabilidade: number | null
        }
        Insert: {
          color?: string
          created_at?: string
          funnel?: Database["public"]["Enums"]["pipeline_funnel"]
          id?: string
          is_active?: boolean
          name: string
          position: number
          probabilidade?: number | null
        }
        Update: {
          color?: string
          created_at?: string
          funnel?: Database["public"]["Enums"]["pipeline_funnel"]
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          probabilidade?: number | null
        }
        Relationships: []
      }
      pix_cobrancas: {
        Row: {
          aluno_id: string
          created_at: string
          data_vencimento: string
          descricao: string | null
          id: string
          id_rec: string
          liquidado_em: string | null
          motivo_rejeicao: string | null
          pagamento_id: string | null
          raw_response: Json | null
          status: string
          txid: string
          updated_at: string
          valor: number
        }
        Insert: {
          aluno_id: string
          created_at?: string
          data_vencimento: string
          descricao?: string | null
          id?: string
          id_rec: string
          liquidado_em?: string | null
          motivo_rejeicao?: string | null
          pagamento_id?: string | null
          raw_response?: Json | null
          status?: string
          txid: string
          updated_at?: string
          valor: number
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data_vencimento?: string
          descricao?: string | null
          id?: string
          id_rec?: string
          liquidado_em?: string | null
          motivo_rejeicao?: string | null
          pagamento_id?: string | null
          raw_response?: Json | null
          status?: string
          txid?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pix_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "pix_cobrancas_id_rec_fkey"
            columns: ["id_rec"]
            isOneToOne: false
            referencedRelation: "pix_recorrencias"
            referencedColumns: ["id_rec"]
          },
          {
            foreignKeyName: "pix_cobrancas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_recorrencias: {
        Row: {
          aluno_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          id_rec: string
          id_solic_rec: string | null
          motivo_cancelamento: string | null
          periodicidade: string
          politica_retentativa: string
          raw_response: Json | null
          status: string
          updated_at: string
          valor_minimo: number
        }
        Insert: {
          aluno_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          id?: string
          id_rec: string
          id_solic_rec?: string | null
          motivo_cancelamento?: string | null
          periodicidade?: string
          politica_retentativa?: string
          raw_response?: Json | null
          status?: string
          updated_at?: string
          valor_minimo: number
        }
        Update: {
          aluno_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          id_rec?: string
          id_solic_rec?: string | null
          motivo_cancelamento?: string | null
          periodicidade?: string
          politica_retentativa?: string
          raw_response?: Json | null
          status?: string
          updated_at?: string
          valor_minimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "pix_recorrencias_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recorrencias_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      planos: {
        Row: {
          aluno_id: string
          ativo: boolean
          cartao_token_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          desconto_recorrente: number
          duracao_meses: number
          forma_pagamento_padrao: string | null
          id: string
          observacoes: string | null
          parcelas_padrao: number
          proxima_renovacao: string | null
          renovacao_automatica: boolean
          servicos: string[] | null
          tipo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          cartao_token_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          desconto_recorrente?: number
          duracao_meses?: number
          forma_pagamento_padrao?: string | null
          id?: string
          observacoes?: string | null
          parcelas_padrao?: number
          proxima_renovacao?: string | null
          renovacao_automatica?: boolean
          servicos?: string[] | null
          tipo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          cartao_token_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          desconto_recorrente?: number
          duracao_meses?: number
          forma_pagamento_padrao?: string | null
          id?: string
          observacoes?: string | null
          parcelas_padrao?: number
          proxima_renovacao?: string | null
          renovacao_automatica?: boolean
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
          {
            foreignKeyName: "planos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "planos_cartao_token_id_fkey"
            columns: ["cartao_token_id"]
            isOneToOne: false
            referencedRelation: "cartoes_salvos"
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
      ponto_acordos_intervalo: {
        Row: {
          aceite_digital_em: string | null
          aceite_ip: string | null
          ativo: boolean
          created_at: string
          created_by: string | null
          documento_path: string | null
          documento_url: string | null
          id: string
          observacoes: string | null
          tipo: Database["public"]["Enums"]["tipo_acordo_intervalo"]
          updated_at: string
          usuario_id: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aceite_digital_em?: string | null
          aceite_ip?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          documento_path?: string | null
          documento_url?: string | null
          id?: string
          observacoes?: string | null
          tipo: Database["public"]["Enums"]["tipo_acordo_intervalo"]
          updated_at?: string
          usuario_id: string
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          aceite_digital_em?: string | null
          aceite_ip?: string | null
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          documento_path?: string | null
          documento_url?: string | null
          id?: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["tipo_acordo_intervalo"]
          updated_at?: string
          usuario_id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
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
      ponto_atividades_especiais: {
        Row: {
          created_at: string
          created_by: string
          data: string
          descricao: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          local: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data: string
          descricao?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          local?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: string
          descricao?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          local?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      ponto_atividades_participantes: {
        Row: {
          atividade_id: string
          created_at: string
          forma_pagamento: Database["public"]["Enums"]["ponto_atv_forma_pgto"]
          id: string
          observacoes: string | null
          qtd_horas: number
          usuario_id: string
          valor_hora: number
        }
        Insert: {
          atividade_id: string
          created_at?: string
          forma_pagamento?: Database["public"]["Enums"]["ponto_atv_forma_pgto"]
          id?: string
          observacoes?: string | null
          qtd_horas: number
          usuario_id: string
          valor_hora?: number
        }
        Update: {
          atividade_id?: string
          created_at?: string
          forma_pagamento?: Database["public"]["Enums"]["ponto_atv_forma_pgto"]
          id?: string
          observacoes?: string | null
          qtd_horas?: number
          usuario_id?: string
          valor_hora?: number
        }
        Relationships: [
          {
            foreignKeyName: "ponto_atividades_participantes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "ponto_atividades_especiais"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_banco_horas: {
        Row: {
          auditoria: Json
          competencia: string | null
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
          vencimento: string | null
        }
        Insert: {
          auditoria?: Json
          competencia?: string | null
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
          vencimento?: string | null
        }
        Update: {
          auditoria?: Json
          competencia?: string | null
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
          vencimento?: string | null
        }
        Relationships: []
      }
      ponto_configuracoes: {
        Row: {
          banco_horas_validade_meses: number | null
          carga_diaria_min: number
          created_at: string
          id: string
          intervalo_minimo_min: number
          intervalo_obrigatorio: boolean
          tolerancia_diaria_min: number
          tolerancia_marcacao_min: number
          tolerancia_min: number
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          banco_horas_validade_meses?: number | null
          carga_diaria_min?: number
          created_at?: string
          id?: string
          intervalo_minimo_min?: number
          intervalo_obrigatorio?: boolean
          tolerancia_diaria_min?: number
          tolerancia_marcacao_min?: number
          tolerancia_min?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          banco_horas_validade_meses?: number | null
          carga_diaria_min?: number
          created_at?: string
          id?: string
          intervalo_minimo_min?: number
          intervalo_obrigatorio?: boolean
          tolerancia_diaria_min?: number
          tolerancia_marcacao_min?: number
          tolerancia_min?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      ponto_consentimento_geo: {
        Row: {
          aceito: boolean
          aceito_em: string
          created_at: string
          id: string
          ip_aceite: string | null
          texto_termo: string | null
          updated_at: string
          user_agent: string | null
          usuario_id: string
          versao_termo: string
        }
        Insert: {
          aceito: boolean
          aceito_em?: string
          created_at?: string
          id?: string
          ip_aceite?: string | null
          texto_termo?: string | null
          updated_at?: string
          user_agent?: string | null
          usuario_id: string
          versao_termo?: string
        }
        Update: {
          aceito?: boolean
          aceito_em?: string
          created_at?: string
          id?: string
          ip_aceite?: string | null
          texto_termo?: string | null
          updated_at?: string
          user_agent?: string | null
          usuario_id?: string
          versao_termo?: string
        }
        Relationships: []
      }
      ponto_eventos: {
        Row: {
          created_at: string
          data_hora: string
          dispositivo: string | null
          distancia_m: number | null
          fora_do_raio: boolean
          id: string
          jornada_id: string | null
          latitude: number | null
          local_mais_proximo_id: string | null
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
          distancia_m?: number | null
          fora_do_raio?: boolean
          id?: string
          jornada_id?: string | null
          latitude?: number | null
          local_mais_proximo_id?: string | null
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
          distancia_m?: number | null
          fora_do_raio?: boolean
          id?: string
          jornada_id?: string | null
          latitude?: number | null
          local_mais_proximo_id?: string | null
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
          {
            foreignKeyName: "ponto_eventos_local_mais_proximo_id_fkey"
            columns: ["local_mais_proximo_id"]
            isOneToOne: false
            referencedRelation: "ponto_locais_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_fechamentos_mensais: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          ciencia_colaborador_em: string | null
          ciencia_colaborador_ip: string | null
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
          ciencia_colaborador_em?: string | null
          ciencia_colaborador_ip?: string | null
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
          ciencia_colaborador_em?: string | null
          ciencia_colaborador_ip?: string | null
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
          divergencia_entrada_min: number | null
          divergencia_intervalo_min: number | null
          divergencia_saida_min: number | null
          divergencia_total_dia: number | null
          entrada: string | null
          fechamento_id: string | null
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          minutos_considerados: number
          minutos_descontaveis: number
          minutos_extras_validos: number
          minutos_intervalo: number | null
          minutos_tolerados: number
          minutos_trabalhados: number | null
          observacao: string | null
          prev_entrada: string | null
          prev_intervalo_min: number | null
          prev_saida: string | null
          saida: string | null
          status: Database["public"]["Enums"]["ponto_jornada_status"]
          status_ponto: Database["public"]["Enums"]["ponto_status_dia"] | null
          tolerancia_excedida: boolean
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          data: string
          divergencia_entrada_min?: number | null
          divergencia_intervalo_min?: number | null
          divergencia_saida_min?: number | null
          divergencia_total_dia?: number | null
          entrada?: string | null
          fechamento_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          minutos_considerados?: number
          minutos_descontaveis?: number
          minutos_extras_validos?: number
          minutos_intervalo?: number | null
          minutos_tolerados?: number
          minutos_trabalhados?: number | null
          observacao?: string | null
          prev_entrada?: string | null
          prev_intervalo_min?: number | null
          prev_saida?: string | null
          saida?: string | null
          status?: Database["public"]["Enums"]["ponto_jornada_status"]
          status_ponto?: Database["public"]["Enums"]["ponto_status_dia"] | null
          tolerancia_excedida?: boolean
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          data?: string
          divergencia_entrada_min?: number | null
          divergencia_intervalo_min?: number | null
          divergencia_saida_min?: number | null
          divergencia_total_dia?: number | null
          entrada?: string | null
          fechamento_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          minutos_considerados?: number
          minutos_descontaveis?: number
          minutos_extras_validos?: number
          minutos_intervalo?: number | null
          minutos_tolerados?: number
          minutos_trabalhados?: number | null
          observacao?: string | null
          prev_entrada?: string | null
          prev_intervalo_min?: number | null
          prev_saida?: string | null
          saida?: string | null
          status?: Database["public"]["Enums"]["ponto_jornada_status"]
          status_ponto?: Database["public"]["Enums"]["ponto_status_dia"] | null
          tolerancia_excedida?: boolean
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
      ponto_locais_trabalho: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          latitude: number
          longitude: number
          nome: string
          raio_m: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          nome: string
          raio_m?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          nome?: string
          raio_m?: number
          updated_at?: string
        }
        Relationships: []
      }
      ponto_politica_retencao: {
        Row: {
          base_legal: string
          changelog: string | null
          contato_dpo: string | null
          criado_em: string
          criado_por: string | null
          id: string
          rascunho: boolean
          responsavel_dados: string
          retencao_banco_horas_anos: number
          retencao_eventos_anos: number
          retencao_jornadas_anos: number
          texto_termo: string | null
          titulo: string | null
          versao: string
          vigente: boolean
          vigente_desde: string
        }
        Insert: {
          base_legal?: string
          changelog?: string | null
          contato_dpo?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          rascunho?: boolean
          responsavel_dados?: string
          retencao_banco_horas_anos?: number
          retencao_eventos_anos?: number
          retencao_jornadas_anos?: number
          texto_termo?: string | null
          titulo?: string | null
          versao?: string
          vigente?: boolean
          vigente_desde?: string
        }
        Update: {
          base_legal?: string
          changelog?: string | null
          contato_dpo?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          rascunho?: boolean
          responsavel_dados?: string
          retencao_banco_horas_anos?: number
          retencao_eventos_anos?: number
          retencao_jornadas_anos?: number
          texto_termo?: string | null
          titulo?: string | null
          versao?: string
          vigente?: boolean
          vigente_desde?: string
        }
        Relationships: []
      }
      ponto_substituicoes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          created_by: string
          data: string
          forma_pagamento: Database["public"]["Enums"]["ponto_subs_forma_pgto"]
          hora_fim: string
          hora_inicio: string
          id: string
          motivo: string
          observacoes: string | null
          qtd_horas: number
          status: Database["public"]["Enums"]["ponto_subs_status"]
          substituido_id: string
          substituto_id: string
          updated_at: string
          valor_hora_aplicado: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          created_by: string
          data: string
          forma_pagamento?: Database["public"]["Enums"]["ponto_subs_forma_pgto"]
          hora_fim: string
          hora_inicio: string
          id?: string
          motivo: string
          observacoes?: string | null
          qtd_horas: number
          status?: Database["public"]["Enums"]["ponto_subs_status"]
          substituido_id: string
          substituto_id: string
          updated_at?: string
          valor_hora_aplicado?: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          created_by?: string
          data?: string
          forma_pagamento?: Database["public"]["Enums"]["ponto_subs_forma_pgto"]
          hora_fim?: string
          hora_inicio?: string
          id?: string
          motivo?: string
          observacoes?: string | null
          qtd_horas?: number
          status?: Database["public"]["Enums"]["ponto_subs_status"]
          substituido_id?: string
          substituto_id?: string
          updated_at?: string
          valor_hora_aplicado?: number
        }
        Relationships: []
      }
      portal_push_log: {
        Row: {
          aluno_id: string | null
          body: string | null
          enviado_em: string
          erro_detalhe: string | null
          gatilho: string
          id: string
          sucesso: boolean
          title: string
        }
        Insert: {
          aluno_id?: string | null
          body?: string | null
          enviado_em?: string
          erro_detalhe?: string | null
          gatilho: string
          id?: string
          sucesso?: boolean
          title: string
        }
        Update: {
          aluno_id?: string | null
          body?: string | null
          enviado_em?: string
          erro_detalhe?: string | null
          gatilho?: string
          id?: string
          sucesso?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_push_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_push_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      portal_push_subscriptions: {
        Row: {
          aluno_id: string
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          aluno_id: string
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          aluno_id?: string
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_push_subscriptions_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_push_subscriptions_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          pis_pasep: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          pis_pasep?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          pis_pasep?: string | null
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
      prospect_nao_conversao_motivos: {
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
      rate_limit_cobrancas: {
        Row: {
          aluno_id: string
          contagem: number
          janela_min: number
        }
        Insert: {
          aluno_id: string
          contagem?: number
          janela_min: number
        }
        Update: {
          aluno_id?: string
          contagem?: number
          janela_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_limit_cobrancas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
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
      regulamento_interno_versoes: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string
          criado_por: string | null
          id: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          conteudo: string
          created_at?: string
          criado_por?: string | null
          id?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          updated_at?: string
          versao?: number
        }
        Relationships: []
      }
      relatorios_alertas_config: {
        Row: {
          ativo: boolean
          descricao: string | null
          id: string
          nome: string
          slug: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          descricao?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      relatorios_insights: {
        Row: {
          descricao: string | null
          gerado_em: string
          id: string
          payload: Json
          periodo_fim: string | null
          periodo_inicio: string | null
          severidade: string
          titulo: string
        }
        Insert: {
          descricao?: string | null
          gerado_em?: string
          id?: string
          payload?: Json
          periodo_fim?: string | null
          periodo_inicio?: string | null
          severidade?: string
          titulo: string
        }
        Update: {
          descricao?: string | null
          gerado_em?: string
          id?: string
          payload?: Json
          periodo_fim?: string | null
          periodo_inicio?: string | null
          severidade?: string
          titulo?: string
        }
        Relationships: []
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
      system_logs: {
        Row: {
          acao: string
          created_at: string
          id: string
          mensagem: string | null
          modulo: string
          payload: Json | null
          stacktrace: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          mensagem?: string | null
          modulo: string
          payload?: Json | null
          stacktrace?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          mensagem?: string | null
          modulo?: string
          payload?: Json | null
          stacktrace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tarefa_notificacoes_log: {
        Row: {
          enviado_em: string
          evento: string
          id: string
          tarefa_id: string
        }
        Insert: {
          enviado_em?: string
          evento: string
          id?: string
          tarefa_id: string
        }
        Update: {
          enviado_em?: string
          evento?: string
          id?: string
          tarefa_id?: string
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
          {
            foreignKeyName: "tarefas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      treino_agendamentos: {
        Row: {
          aluno_id: string
          cancelado_em: string | null
          cancelado_por: string | null
          ciclo_id: string | null
          created_at: string
          created_by: string | null
          credito_debitado: boolean
          credito_estornado: boolean
          data: string
          horario_fim: string
          horario_inicio: string
          id: string
          observacoes: string | null
          slot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          ciclo_id?: string | null
          created_at?: string
          created_by?: string | null
          credito_debitado?: boolean
          credito_estornado?: boolean
          data: string
          horario_fim: string
          horario_inicio: string
          id?: string
          observacoes?: string | null
          slot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          ciclo_id?: string | null
          created_at?: string
          created_by?: string | null
          credito_debitado?: boolean
          credito_estornado?: boolean
          data?: string
          horario_fim?: string
          horario_inicio?: string
          id?: string
          observacoes?: string | null
          slot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treino_agendamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treino_agendamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "treino_agendamentos_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treino_agendamentos_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "treino_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      treino_cargas: {
        Row: {
          aluno_id: string
          exercicio_nome: string
          id: string
          kg: string | null
          sessao_id: string | null
          treino_id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          exercicio_nome: string
          id?: string
          kg?: string | null
          sessao_id?: string | null
          treino_id: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          exercicio_nome?: string
          id?: string
          kg?: string | null
          sessao_id?: string | null
          treino_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treino_cargas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treino_cargas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "treino_cargas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "treino_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treino_cargas_treino_id_fkey"
            columns: ["treino_id"]
            isOneToOne: false
            referencedRelation: "treinos"
            referencedColumns: ["id"]
          },
        ]
      }
      treino_horarios_fixos: {
        Row: {
          aluno_id: string
          ativo: boolean
          created_at: string
          created_by: string | null
          criado_por: string
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id: string
          pausado_ate: string | null
          slot_id: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          criado_por?: string
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id?: string
          pausado_ate?: string | null
          slot_id: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          criado_por?: string
          dia_semana?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          pausado_ate?: string | null
          slot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treino_horarios_fixos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treino_horarios_fixos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "treino_horarios_fixos_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "treino_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      treino_sessoes: {
        Row: {
          agendamento_id: string | null
          aluno_id: string
          concluido_em: string | null
          created_at: string
          data: string
          foi_troca: boolean
          id: string
          observacoes: string | null
          treino_id: string
          updated_at: string
          variacao: string
          variacao_original: string | null
        }
        Insert: {
          agendamento_id?: string | null
          aluno_id: string
          concluido_em?: string | null
          created_at?: string
          data?: string
          foi_troca?: boolean
          id?: string
          observacoes?: string | null
          treino_id: string
          updated_at?: string
          variacao: string
          variacao_original?: string | null
        }
        Update: {
          agendamento_id?: string | null
          aluno_id?: string
          concluido_em?: string | null
          created_at?: string
          data?: string
          foi_troca?: boolean
          id?: string
          observacoes?: string | null
          treino_id?: string
          updated_at?: string
          variacao?: string
          variacao_original?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treino_sessoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "treino_agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treino_sessoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treino_sessoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "treino_sessoes_treino_id_fkey"
            columns: ["treino_id"]
            isOneToOne: false
            referencedRelation: "treinos"
            referencedColumns: ["id"]
          },
        ]
      }
      treino_slots: {
        Row: {
          ativo: boolean
          capacidade_maxima: number
          created_at: string
          created_by: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id: string
          instrutor_id: string | null
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          capacidade_maxima?: number
          created_at?: string
          created_by?: string | null
          dia_semana: number
          horario_fim: string
          horario_inicio: string
          id?: string
          instrutor_id?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          capacidade_maxima?: number
          created_at?: string
          created_by?: string | null
          dia_semana?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          instrutor_id?: string | null
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      treinos: {
        Row: {
          aluno_id: string
          autor_id: string
          conteudo: Json | null
          created_at: string
          data_inicio: string | null
          descricao: string
          id: string
          semanas: number
          status: string
          template_fase: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          aluno_id: string
          autor_id: string
          conteudo?: Json | null
          created_at?: string
          data_inicio?: string | null
          descricao: string
          id?: string
          semanas?: number
          status?: string
          template_fase?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          aluno_id?: string
          autor_id?: string
          conteudo?: Json | null
          created_at?: string
          data_inicio?: string | null
          descricao?: string
          id?: string
          semanas?: number
          status?: string
          template_fase?: string | null
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
          {
            foreignKeyName: "treinos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
          {
            foreignKeyName: "uploads_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
            foreignKeyName: "uso_beneficios_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
          {
            foreignKeyName: "uso_beneficios_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          aluno_id: string
          canal_pagamento: string | null
          catalogo_id: string
          cobranca_id: string | null
          created_at: string
          data_cancelamento: string | null
          data_venda: string
          desconto: number
          forma_pagamento: string | null
          id: string
          modalidade_pagamento: string | null
          motivo_cancelamento_id: string | null
          nome_snapshot: string
          observacao_cancelamento: string | null
          observacoes: string | null
          origem: string
          parcelas: number
          plano_id: string | null
          status_pagamento: Database["public"]["Enums"]["venda_status"]
          taxa_mensal: number
          tipo: Database["public"]["Enums"]["venda_tipo"]
          tipo_cobranca: string | null
          updated_at: string
          valor: number
          valor_final: number
          vendedor_id: string | null
        }
        Insert: {
          aluno_id: string
          canal_pagamento?: string | null
          catalogo_id: string
          cobranca_id?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_venda?: string
          desconto?: number
          forma_pagamento?: string | null
          id?: string
          modalidade_pagamento?: string | null
          motivo_cancelamento_id?: string | null
          nome_snapshot: string
          observacao_cancelamento?: string | null
          observacoes?: string | null
          origem?: string
          parcelas?: number
          plano_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["venda_status"]
          taxa_mensal?: number
          tipo: Database["public"]["Enums"]["venda_tipo"]
          tipo_cobranca?: string | null
          updated_at?: string
          valor?: number
          valor_final?: number
          vendedor_id?: string | null
        }
        Update: {
          aluno_id?: string
          canal_pagamento?: string | null
          catalogo_id?: string
          cobranca_id?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_venda?: string
          desconto?: number
          forma_pagamento?: string | null
          id?: string
          modalidade_pagamento?: string | null
          motivo_cancelamento_id?: string | null
          nome_snapshot?: string
          observacao_cancelamento?: string | null
          observacoes?: string | null
          origem?: string
          parcelas?: number
          plano_id?: string | null
          status_pagamento?: Database["public"]["Enums"]["venda_status"]
          taxa_mensal?: number
          tipo?: Database["public"]["Enums"]["venda_tipo"]
          tipo_cobranca?: string | null
          updated_at?: string
          valor?: number
          valor_final?: number
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
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "vendas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_motivo_cancelamento_id_fkey"
            columns: ["motivo_cancelamento_id"]
            isOneToOne: false
            referencedRelation: "cancelamento_motivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "v_planos_base"
            referencedColumns: ["plano_id"]
          },
        ]
      }
      webhook_events_rede: {
        Row: {
          event_id: string
          payload: Json
          processed_at: string
        }
        Insert: {
          event_id: string
          payload: Json
          processed_at?: string
        }
        Update: {
          event_id?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      whatsapp_conversas: {
        Row: {
          created_at: string
          id: string
          nao_lidas: number
          nome_contato: string | null
          telefone: string
          ultima_mensagem: string | null
          ultima_mensagem_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nao_lidas?: number
          nome_contato?: string | null
          telefone: string
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nao_lidas?: number
          nome_contato?: string | null
          telefone?: string
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_disparos_config: {
        Row: {
          atividades: string[] | null
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          destinatario: string
          gatilho: string
          id: string
          modo_teste: boolean
          nome: string
          ordem: number
          template_texto: string
          updated_at: string
          variaveis_disponiveis: string[]
        }
        Insert: {
          atividades?: string[] | null
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao?: string | null
          destinatario: string
          gatilho: string
          id?: string
          modo_teste?: boolean
          nome: string
          ordem?: number
          template_texto: string
          updated_at?: string
          variaveis_disponiveis?: string[]
        }
        Update: {
          atividades?: string[] | null
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          destinatario?: string
          gatilho?: string
          id?: string
          modo_teste?: boolean
          nome?: string
          ordem?: number
          template_texto?: string
          updated_at?: string
          variaveis_disponiveis?: string[]
        }
        Relationships: []
      }
      whatsapp_disparos_log: {
        Row: {
          agenda_id: string | null
          aluno_id: string | null
          config_id: string | null
          created_at: string
          destinatario_nome: string | null
          destinatario_telefone: string | null
          erro_detalhe: string | null
          id: string
          mensagem_enviada: string | null
          status: string
        }
        Insert: {
          agenda_id?: string | null
          aluno_id?: string | null
          config_id?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone?: string | null
          erro_detalhe?: string | null
          id?: string
          mensagem_enviada?: string | null
          status?: string
        }
        Update: {
          agenda_id?: string | null
          aluno_id?: string | null
          config_id?: string | null
          created_at?: string
          destinatario_nome?: string | null
          destinatario_telefone?: string | null
          erro_detalhe?: string | null
          id?: string
          mensagem_enviada?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_disparos_log_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agenda_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_disparos_log_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "v_servicos_agenda"
            referencedColumns: ["agenda_id"]
          },
          {
            foreignKeyName: "whatsapp_disparos_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_disparos_log_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "whatsapp_disparos_log_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_disparos_config"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_events: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
          type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
          type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
          type?: string | null
        }
        Relationships: []
      }
      whatsapp_mensagens: {
        Row: {
          conteudo: string | null
          conversa_id: string
          created_at: string
          direcao: string
          enviado_por: string | null
          id: string
          status: string
          tipo: string
          wamid: string | null
        }
        Insert: {
          conteudo?: string | null
          conversa_id: string
          created_at?: string
          direcao: string
          enviado_por?: string | null
          id?: string
          status?: string
          tipo?: string
          wamid?: string | null
        }
        Update: {
          conteudo?: string | null
          conversa_id?: string
          created_at?: string
          direcao?: string
          enviado_por?: string | null
          id?: string
          status?: string
          tipo?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inadimplencias_view: {
        Row: {
          aluno_id: string | null
          cobranca_id: string | null
          contrato_id: string | null
          created_at: string | null
          data_regularizacao: string | null
          data_vencimento: string | null
          dias_atraso: number | null
          id: string | null
          notificacoes: Json | null
          status: string | null
          valor: number | null
        }
        Insert: {
          aluno_id?: string | null
          cobranca_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          data_regularizacao?: string | null
          data_vencimento?: string | null
          dias_atraso?: never
          id?: string | null
          notificacoes?: Json | null
          status?: string | null
          valor?: number | null
        }
        Update: {
          aluno_id?: string | null
          cobranca_id?: string | null
          contrato_id?: string | null
          created_at?: string | null
          data_regularizacao?: string | null
          data_vencimento?: string | null
          dias_atraso?: never
          id?: string | null
          notificacoes?: Json | null
          status?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inadimplencias_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inadimplencias_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "inadimplencias_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inadimplencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros_publico: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          descricao: string | null
          endereco: string | null
          id: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          modo_validacao:
            | Database["public"]["Enums"]["parceiro_modo_validacao"]
            | null
          nome: string | null
          pontuacao_engajamento: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          modo_validacao?:
            | Database["public"]["Enums"]["parceiro_modo_validacao"]
            | null
          nome?: string | null
          pontuacao_engajamento?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          descricao?: string | null
          endereco?: string | null
          id?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          modo_validacao?:
            | Database["public"]["Enums"]["parceiro_modo_validacao"]
            | null
          nome?: string | null
          pontuacao_engajamento?: number | null
        }
        Relationships: []
      }
      v_audit_resumo: {
        Row: {
          created_at: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          id: string | null
          operacao: string | null
          registro_id: string | null
          tabela: string | null
          tipo_operacao: string | null
          user_id: string | null
          usuario_email: string | null
        }
        Relationships: []
      }
      v_cancelamentos: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          data_cancelamento: string | null
          data_venda: string | null
          dias_ate_cancelar: number | null
          motivo_cancelamento_id: string | null
          motivo_nome: string | null
          motivo_slug: string | null
          observacao_cancelamento: string | null
          plano_tipo: string | null
          responsavel_id: string | null
          valor_final: number | null
          venda_id: string | null
          vendedor_id: string | null
          vendedor_nome: string | null
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
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "vendas_motivo_cancelamento_id_fkey"
            columns: ["motivo_cancelamento_id"]
            isOneToOne: false
            referencedRelation: "cancelamento_motivos"
            referencedColumns: ["id"]
          },
        ]
      }
      v_crm_pipeline: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          aluno_status: string | null
          from_stage: string | null
          from_stage_id: string | null
          funnel: Database["public"]["Enums"]["pipeline_funnel"] | null
          moved_at: string | null
          moved_by_user_id: string | null
          movement_id: string | null
          responsavel_id: string | null
          time_in_previous_stage: string | null
          to_stage: string | null
          to_stage_id: string | null
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
            foreignKeyName: "pipeline_movements_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
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
      v_equipe_produtividade: {
        Row: {
          agendamentos: number | null
          alunos_ativos: number | null
          avaliacoes_30d: number | null
          nome: string | null
          profissional_id: string | null
          tarefas_concluidas_30d: number | null
          vendas_pagas_30d: number | null
        }
        Insert: {
          agendamentos?: never
          alunos_ativos?: never
          avaliacoes_30d?: never
          nome?: string | null
          profissional_id?: string | null
          tarefas_concluidas_30d?: never
          vendas_pagas_30d?: never
        }
        Update: {
          agendamentos?: never
          alunos_ativos?: never
          avaliacoes_30d?: never
          nome?: string | null
          profissional_id?: string | null
          tarefas_concluidas_30d?: never
          vendas_pagas_30d?: never
        }
        Relationships: []
      }
      v_financeiro_aberto: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          dias_atraso: number | null
          numero: number | null
          pagamento_id: string | null
          parcela_id: string | null
          responsavel_id: string | null
          status: string | null
          telefone: string | null
          valor: number | null
          vencimento: string | null
          venda_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_parcelas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_cancelamentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_resumo"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_financeiro_recebimentos: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          data_pagamento: string | null
          forma_pagamento: string | null
          mes_pagamento: string | null
          numero: number | null
          pagamento_id: string | null
          parcela_id: string | null
          status: string | null
          valor: number | null
          vencimento: string | null
          venda_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_parcelas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_cancelamentos"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "v_vendas_resumo"
            referencedColumns: ["venda_id"]
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_funil_conversao: {
        Row: {
          alunos: number | null
          alunos_ativos: number | null
          inativos: number | null
          mes: string | null
          perdidos: number | null
          prospects: number | null
          responsavel_id: string | null
          total: number | null
        }
        Relationships: []
      }
      v_planos_base: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          ativo: boolean | null
          data_fim: string | null
          data_inicio: string | null
          dias_no_plano: number | null
          duracao_meses: number | null
          plano_id: string | null
          proxima_renovacao: string | null
          renovacao_automatica: boolean | null
          responsavel_id: string | null
          situacao: string | null
          tipo: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
        ]
      }
      v_servicos_agenda: {
        Row: {
          agenda_id: string | null
          aluno_id: string | null
          aluno_nome: string | null
          atividade: string | null
          comparecimento: boolean | null
          data_especifica: string | null
          dia_semana: number | null
          horario_fim: string | null
          horario_inicio: string | null
          local: string | null
          presenca_marcada: boolean | null
          profissional_id: string | null
          profissional_nome: string | null
          tipo: string | null
        }
        Relationships: []
      }
      v_tecnico_alertas: {
        Row: {
          aluno_id: string | null
          avaliacao_atrasada: boolean | null
          frequencia_semanal: number | null
          nome: string | null
          responsavel_id: string | null
          treino_desatualizado: boolean | null
          ultima_avaliacao: string | null
          ultimo_treino_atualizado: string | null
        }
        Relationships: []
      }
      v_vendas_resumo: {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          data_venda: string | null
          desconto: number | null
          duracao_meses: number | null
          forma_pagamento: string | null
          item: string | null
          mes: string | null
          parcelas: number | null
          plano_id: string | null
          plano_tipo: string | null
          responsavel_id: string | null
          status_pagamento: Database["public"]["Enums"]["venda_status"] | null
          tipo: Database["public"]["Enums"]["venda_tipo"] | null
          valor: number | null
          valor_final: number | null
          venda_id: string | null
          vendedor_id: string | null
          vendedor_nome: string | null
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
            foreignKeyName: "vendas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "v_tecnico_alertas"
            referencedColumns: ["aluno_id"]
          },
          {
            foreignKeyName: "vendas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "v_planos_base"
            referencedColumns: ["plano_id"]
          },
        ]
      }
    }
    Functions: {
      aluno_user_id: { Args: { p_aluno_id: string }; Returns: string }
      ativar_treinos_agendados: { Args: never; Returns: undefined }
      fn_acordo_intervalo_vigente: {
        Args: { _data: string; _usuario: string }
        Returns: Database["public"]["Enums"]["tipo_acordo_intervalo"]
      }
      fn_agendar_reavaliacoes_pendentes: { Args: never; Returns: Json }
      fn_agendar_treino: {
        Args: { p_data: string; p_slot_id: string }
        Returns: Json
      }
      fn_calcular_rescisao: { Args: { p_contrato_id: string }; Returns: Json }
      fn_call_edge_function: {
        Args: { p_body: Json; p_name: string }
        Returns: undefined
      }
      fn_cancelar_treino_agendamento: {
        Args: { p_agendamento_id: string }
        Returns: Json
      }
      fn_carteira_ativos_por_profissional: {
        Args: never
        Returns: {
          profissional_id: string
          qtd_alunos: number
        }[]
      }
      fn_carteira_total_ativos: { Args: never; Returns: number }
      fn_check_rate_limit: {
        Args: { p_aluno_id: string; p_janela: number; p_limite: number }
        Returns: boolean
      }
      fn_clube_adicionar_pontos: {
        Args: {
          p_acao: string
          p_aluno_id: string
          p_created_by?: string
          p_motivo_manual?: string
          p_pontos_manual?: number
          p_referencia_id?: string
          p_referencia_tipo?: string
        }
        Returns: Json
      }
      fn_clube_check_divergencias: { Args: never; Returns: Json }
      fn_clube_dashboard: { Args: { _periodo_dias?: number }; Returns: Json }
      fn_clube_generate_qr_token: { Args: { _aluno_id: string }; Returns: Json }
      fn_clube_hash_cpf: { Args: { _cpf: string }; Returns: string }
      fn_clube_marcar_alerta_lido: {
        Args: { _alerta_id: string }
        Returns: undefined
      }
      fn_clube_nivel_por_plano: { Args: { _aluno_id: string }; Returns: Json }
      fn_clube_resgatar: { Args: { p_recompensa_id: string }; Returns: Json }
      fn_clube_resync_todos: { Args: never; Returns: Json }
      fn_clube_resync_todos_safe: { Args: never; Returns: Json }
      fn_clube_sync_membro: { Args: { _aluno_id: string }; Returns: undefined }
      fn_clube_validar_token: {
        Args: { _beneficio_id: string; _token: string }
        Returns: Json
      }
      fn_comissao_valor: {
        Args: { _tipo: Database["public"]["Enums"]["comissao_tipo"] }
        Returns: number
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
      fn_criar_contrato_recorrencia:
        | {
            Args: {
              p_aluno_id: string
              p_cartao_token_id?: string
              p_data_inicio: string
              p_forma_pagamento: string
              p_plano_id: string
              p_primeira_paga?: boolean
              p_taxa_mensal: number
              p_valor_mensal: number
              p_venda_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_aluno_id: string
              p_cartao_token_id?: string
              p_data_inicio: string
              p_forma_pagamento: string
              p_plano_id: string
              p_primeira_paga?: boolean
              p_servicos_inclusos?: Json
              p_taxa_mensal: number
              p_valor_mensal: number
              p_venda_id: string
            }
            Returns: string
          }
      fn_criar_tarefa_reavaliacao: {
        Args: { _aluno_id: string; _criado_por: string; _data_ultima: string }
        Returns: string
      }
      fn_current_aluno_id: { Args: never; Returns: string }
      fn_desafio_atualizar_progresso: {
        Args: { p_desafio_id: string }
        Returns: Json
      }
      fn_desafio_calcular_progresso: {
        Args: { p_desafio_id: string }
        Returns: number
      }
      fn_detect_evasao: { Args: never; Returns: Json }
      fn_distancia_metros: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      fn_excluir_horario_fixo: {
        Args: { p_horario_fixo_id: string }
        Returns: Json
      }
      fn_gerar_comissao: {
        Args: {
          _aluno: string
          _descricao: string
          _origem_id: string
          _origem_tabela: string
          _profissional: string
          _tipo: Database["public"]["Enums"]["comissao_tipo"]
        }
        Returns: string
      }
      fn_is_auto_renew_plan: { Args: { _tipo: string }; Returns: boolean }
      fn_lgpd_anonimizar_titular: {
        Args: { p_aluno_id: string }
        Returns: Json
      }
      fn_lgpd_relatorio_titular: { Args: { p_aluno_id: string }; Returns: Json }
      fn_local_mais_proximo: {
        Args: { _lat: number; _lng: number }
        Returns: {
          dentro_raio: boolean
          distancia_m: number
          local_id: string
          nome: string
        }[]
      }
      fn_lookup_aluno_por_cpf_hash: {
        Args: { p_cpf_hash: string }
        Returns: Json
      }
      fn_marcar_parcelas_vencidas: { Args: never; Returns: number }
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
      fn_notificar_expandir_destinatarios: {
        Args: { p_grupos: Json }
        Returns: string[]
      }
      fn_notificar_listar_profissionais: {
        Args: never
        Returns: {
          full_name: string
          roles: string[]
          specialty: string
          user_id: string
        }[]
      }
      fn_parceiro_login: {
        Args: { p_email: string; p_senha: string }
        Returns: Json
      }
      fn_parceiro_set_senha: {
        Args: { p_parceiro_id: string; p_senha: string }
        Returns: undefined
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
      fn_ponto_alertas_diarios: { Args: never; Returns: Json }
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
      fn_ponto_calcular_divergencias: {
        Args: { _jornada_id: string }
        Returns: undefined
      }
      fn_ponto_calcular_fechamento: {
        Args: { _mes: string; _user_id: string }
        Returns: Json
      }
      fn_ponto_consolidar_banco: {
        Args: { _jornada_id: string }
        Returns: undefined
      }
      fn_ponto_criar_jornada_manual: {
        Args: { _data: string; _motivo: string; _user_id: string }
        Returns: string
      }
      fn_ponto_dashboard_coordenador: {
        Args: { _data?: string }
        Returns: Json
      }
      fn_ponto_dashboard_periodo: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      fn_ponto_dia_ausencia: {
        Args: { _data: string; _user_id: string }
        Returns: string
      }
      fn_ponto_estado_atual: { Args: { _user_id?: string }; Returns: Json }
      fn_ponto_gerar_fechamentos_mes: { Args: { _mes: string }; Returns: Json }
      fn_ponto_janelas_dia: {
        Args: { _data: string; _usuario: string }
        Returns: {
          tempo_estabelecimento_min: number
          tempo_ocioso_min: number
          tempo_trabalhado_min: number
        }[]
      }
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
      fn_processar_comissao_carteira: {
        Args: { _ref: string }
        Returns: number
      }
      fn_processar_horarios_fixos: { Args: never; Returns: Json }
      fn_proxima_renovacao_from: {
        Args: { _data_inicio: string }
        Returns: string
      }
      fn_resolver_prof_avaliacao: {
        Args: { _aluno_id: string; _avaliador: string; _data: string }
        Returns: string
      }
      fn_resolver_responsavel_reavaliacao: {
        Args: { _aluno_id: string; _fallback: string }
        Returns: string
      }
      fn_sanitize_rede_response: { Args: { p_raw: Json }; Returns: Json }
      fn_staff_excluir_treino_agendamento: {
        Args: { p_agendamento_id: string; p_estornar?: boolean }
        Returns: Json
      }
      fn_tentar_comissao_experimental: {
        Args: { _agenda: string; _aluno: string; _profissional: string }
        Returns: undefined
      }
      fn_treino_concluir_sessao: {
        Args: {
          p_agendamento_id?: string
          p_aluno_id: string
          p_foi_troca?: boolean
          p_observacoes?: string
          p_treino_id: string
          p_variacao: string
          p_variacao_original?: string
        }
        Returns: Json
      }
      fn_treino_variacao_atual: {
        Args: { p_aluno_id: string; p_treino_id: string }
        Returns: Json
      }
      fn_user_can_see_notificacao: {
        Args: { _notif_id: string; _user_id: string }
        Returns: boolean
      }
      fn_user_created_notificacao: {
        Args: { _notif_id: string; _user_id: string }
        Returns: boolean
      }
      get_dashboard_data: { Args: { _professor_id?: string }; Returns: Json }
      get_webhook_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_admin_role: { Args: never; Returns: boolean }
      is_coordenador_ou_admin: { Args: never; Returns: boolean }
      is_coordinator_or_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_professor_staff: { Args: never; Returns: boolean }
      is_staff:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      rename_exercicio_categoria: {
        Args: {
          p_new_grupo: string
          p_new_sub?: string
          p_old_grupo: string
          p_old_sub?: string
        }
        Returns: undefined
      }
      search_cadastros: {
        Args: { termo: string }
        Returns: {
          current_pipeline_stage_id: string
          id: string
          nome: string
          status: string
          telefone: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      adquirente_bandeira: "visa" | "mastercard" | "elo"
      adquirente_modalidade:
        | "debito"
        | "credito_vista"
        | "credito_2_6x"
        | "credito_7_12x"
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
      clube_nivel_membro: "bronze" | "prata" | "ouro" | "diamante" | "platina"
      clube_status_membro: "ativo" | "bloqueado" | "inadimplente" | "cancelado"
      comissao_pendencia_tipo:
        | "avaliar_experimental"
        | "concluir_avaliacao_funcional"
        | "upload_arquivo_forca"
        | "aguardando_pagamento_plano"
      comissao_status:
        | "pendente"
        | "em_validacao"
        | "aprovado"
        | "pago"
        | "cancelado"
      comissao_tipo:
        | "treino_experimental"
        | "avaliacao_funcional"
        | "carteira_ativa"
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
        | "ponto"
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
      ponto_atv_forma_pgto: "pagamento" | "banco_horas"
      ponto_banco_tipo:
        | "credito_manual"
        | "debito_manual"
        | "compensacao"
        | "ajuste_saldo"
        | "tolerancia_excedida"
        | "hora_extra"
        | "vencimento"
        | "rescisao"
        | "substituicao"
        | "atividade_especial"
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
      ponto_status_dia:
        | "dentro_tolerancia"
        | "divergencia_leve"
        | "divergencia_considerada"
        | "banco_negativo"
        | "hora_extra"
        | "jornada_incompleta"
        | "falta_marcacao"
        | "em_analise"
      ponto_subs_forma_pgto: "pagamento" | "banco_horas"
      ponto_subs_status: "pendente" | "aprovada" | "rejeitada"
      regra_elegibilidade_tipo:
        | "plano"
        | "frequencia_minima"
        | "status_financeiro"
        | "tempo_matricula"
      tipo_acordo_intervalo: "estendido_2h" | "reduzido_30min"
      tipo_vinculo_trabalhista:
        | "horista"
        | "mensalista"
        | "pj"
        | "estagiario"
        | "autonomo"
        | "coordenador_gestao"
      uso_origem_validacao: "scanner" | "cpf_manual" | "admin"
      uso_status_validacao: "valido" | "recusado" | "expirado" | "bloqueado"
      venda_status: "pendente" | "pago" | "cancelado" | "falha" | "estornado"
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
      adquirente_bandeira: ["visa", "mastercard", "elo"],
      adquirente_modalidade: [
        "debito",
        "credito_vista",
        "credito_2_6x",
        "credito_7_12x",
      ],
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
      clube_nivel_membro: ["bronze", "prata", "ouro", "diamante", "platina"],
      clube_status_membro: ["ativo", "bloqueado", "inadimplente", "cancelado"],
      comissao_pendencia_tipo: [
        "avaliar_experimental",
        "concluir_avaliacao_funcional",
        "upload_arquivo_forca",
        "aguardando_pagamento_plano",
      ],
      comissao_status: [
        "pendente",
        "em_validacao",
        "aprovado",
        "pago",
        "cancelado",
      ],
      comissao_tipo: [
        "treino_experimental",
        "avaliacao_funcional",
        "carteira_ativa",
      ],
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
        "ponto",
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
      ponto_atv_forma_pgto: ["pagamento", "banco_horas"],
      ponto_banco_tipo: [
        "credito_manual",
        "debito_manual",
        "compensacao",
        "ajuste_saldo",
        "tolerancia_excedida",
        "hora_extra",
        "vencimento",
        "rescisao",
        "substituicao",
        "atividade_especial",
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
      ponto_status_dia: [
        "dentro_tolerancia",
        "divergencia_leve",
        "divergencia_considerada",
        "banco_negativo",
        "hora_extra",
        "jornada_incompleta",
        "falta_marcacao",
        "em_analise",
      ],
      ponto_subs_forma_pgto: ["pagamento", "banco_horas"],
      ponto_subs_status: ["pendente", "aprovada", "rejeitada"],
      regra_elegibilidade_tipo: [
        "plano",
        "frequencia_minima",
        "status_financeiro",
        "tempo_matricula",
      ],
      tipo_acordo_intervalo: ["estendido_2h", "reduzido_30min"],
      tipo_vinculo_trabalhista: [
        "horista",
        "mensalista",
        "pj",
        "estagiario",
        "autonomo",
        "coordenador_gestao",
      ],
      uso_origem_validacao: ["scanner", "cpf_manual", "admin"],
      uso_status_validacao: ["valido", "recusado", "expirado", "bloqueado"],
      venda_status: ["pendente", "pago", "cancelado", "falha", "estornado"],
      venda_tipo: ["plano", "servico"],
    },
  },
} as const
