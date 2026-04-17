
-- ========== ÍNDICES NAS FKs MAIS USADAS ==========
CREATE INDEX IF NOT EXISTS idx_alunos_responsavel_id ON public.alunos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_id ON public.tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);
CREATE INDEX IF NOT EXISTS idx_planos_aluno_id ON public.planos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_planos_ativo ON public.planos(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_agenda_profissional_id ON public.agenda_servicos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_agenda_dia_semana ON public.agenda_servicos(dia_semana);
CREATE INDEX IF NOT EXISTS idx_agenda_data_especifica ON public.agenda_servicos(data_especifica);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_aluno_id ON public.avaliacoes(aluno_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_tipo_data ON public.avaliacoes(tipo, data DESC);
CREATE INDEX IF NOT EXISTS idx_treinos_aluno_id ON public.treinos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_treinos_status ON public.treinos(status);
CREATE INDEX IF NOT EXISTS idx_uploads_categoria ON public.uploads(categoria);
CREATE INDEX IF NOT EXISTS idx_uploads_aluno_id ON public.uploads(aluno_id);
CREATE INDEX IF NOT EXISTS idx_exercicios_criado_por ON public.exercicios_personalizados(criado_por);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- ========== RPC CONSOLIDADA DO DASHBOARD ==========
CREATE OR REPLACE FUNCTION public.get_dashboard_data(_professor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  today_date date := CURRENT_DATE;
  dia_semana_hoje int := EXTRACT(DOW FROM CURRENT_DATE)::int;
  mes_inicio date := date_trunc('month', CURRENT_DATE)::date;
  mes_fim date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
BEGIN
  WITH
  -- ===== ALUNOS STATS =====
  alunos_filtered AS (
    SELECT id, nome, status, frequencia_semanal, responsavel_id, data_nascimento
    FROM alunos
    WHERE (_professor_id IS NULL OR responsavel_id = _professor_id)
  ),
  planos_ativos AS (
    SELECT DISTINCT ON (aluno_id) aluno_id, tipo, duracao_meses, data_inicio
    FROM planos
    WHERE ativo = true
      AND aluno_id IN (SELECT id FROM alunos_filtered WHERE status = 'ativo')
    ORDER BY aluno_id, created_at DESC
  ),
  alunos_stats AS (
    SELECT
      (SELECT COUNT(*) FROM planos_ativos WHERE tipo NOT IN ('Gympass/Wellhub','Total Pass')) AS ativos,
      (SELECT COUNT(*) FROM planos_ativos WHERE tipo IN ('Gympass/Wellhub','Total Pass')) AS agregadores,
      (SELECT COUNT(*) FROM alunos_filtered WHERE status = 'licenca') AS licenca
  ),
  -- ===== TAREFAS STATS =====
  tarefas_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
      COUNT(*) FILTER (WHERE status = 'pendente' AND data_limite IS NOT NULL AND data_limite < today_date) AS atrasadas
    FROM tarefas
    WHERE (_professor_id IS NULL OR responsavel_id = _professor_id)
  ),
  -- ===== AGENDA HOJE =====
  agenda_hoje AS (
    SELECT atividade
    FROM agenda_servicos
    WHERE (_professor_id IS NULL OR profissional_id = _professor_id)
      AND (dia_semana = dia_semana_hoje OR data_especifica = today_date)
  ),
  agenda_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE atividade IN ('Avaliação Funcional','Avaliação Física')) AS avaliacoes_hoje,
      COUNT(*) FILTER (WHERE atividade = 'Treino Experimental') AS experimentais_hoje
    FROM agenda_hoje
  ),
  -- ===== ANIVERSARIANTES (este mês) =====
  aniversariantes AS (
    SELECT id, nome, EXTRACT(DAY FROM data_nascimento)::int AS dia,
           (EXTRACT(MONTH FROM data_nascimento)::int = EXTRACT(MONTH FROM today_date)::int
            AND EXTRACT(DAY FROM data_nascimento)::int = EXTRACT(DAY FROM today_date)::int) AS hoje
    FROM alunos_filtered
    WHERE status = 'ativo'
      AND data_nascimento IS NOT NULL
      AND EXTRACT(MONTH FROM data_nascimento)::int = EXTRACT(MONTH FROM today_date)::int
  )
  SELECT jsonb_build_object(
    'alunos', (SELECT row_to_json(s) FROM alunos_stats s),
    'tarefas', (SELECT row_to_json(s) FROM tarefas_stats s),
    'agenda', (SELECT row_to_json(s) FROM agenda_stats s),
    'aniversariantes', jsonb_build_object(
      'today', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'dia', dia)) FROM aniversariantes WHERE hoje = true), '[]'::jsonb),
      'month', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'dia', dia) ORDER BY dia) FROM aniversariantes WHERE hoje = false), '[]'::jsonb)
    )
  ) INTO result;

  RETURN result;
END;
$$;
