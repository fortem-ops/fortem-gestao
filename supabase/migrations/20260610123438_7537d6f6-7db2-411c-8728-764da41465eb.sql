
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
      (SELECT COUNT(*) FROM planos_ativos
        WHERE tipo NOT IN ('Gympass/Wellhub','Total Pass')
          AND tipo NOT ILIKE 'vip%') AS ativos,
      (SELECT COUNT(*) FROM planos_ativos WHERE tipo IN ('Gympass/Wellhub','Total Pass')) AS agregadores,
      (SELECT COUNT(*) FROM planos_ativos WHERE tipo ILIKE 'vip%') AS vip,
      (SELECT COUNT(*) FROM alunos_filtered WHERE status = 'licenca') AS licenca
  ),
  tarefas_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'pendente') AS pendentes,
      COUNT(*) FILTER (WHERE status = 'pendente' AND data_limite IS NOT NULL AND data_limite < today_date) AS atrasadas
    FROM tarefas
    WHERE (_professor_id IS NULL OR responsavel_id = _professor_id)
  ),
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

CREATE OR REPLACE FUNCTION public.fn_carteira_ativos_por_profissional()
RETURNS TABLE(profissional_id uuid, qtd_alunos integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.responsavel_id AS profissional_id, COUNT(*)::int AS qtd_alunos
  FROM public.alunos a
  WHERE a.status = 'ativo'
    AND a.responsavel_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.planos p
      WHERE p.aluno_id = a.id
        AND p.ativo = true
        AND p.tipo NOT IN ('Gympass/Wellhub','Total Pass')
        AND p.tipo NOT ILIKE 'vip%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.aluno_licencas l
      WHERE l.aluno_id = a.id
        AND CURRENT_DATE BETWEEN l.data_inicio AND l.data_fim
    )
  GROUP BY a.responsavel_id;
$$;
