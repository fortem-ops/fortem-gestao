CREATE OR REPLACE FUNCTION public.fn_portal_push_avisos(
  p_hoje date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS TABLE (
  aluno_id uuid,
  gatilho text,
  referencia text,
  url text,
  plano_tipo text,
  data_referencia date,
  valor numeric,
  saldo integer,
  anos integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH ultimas_avaliacoes AS (
    SELECT av.aluno_id, max(av.data)::date AS data
    FROM public.avaliacoes av
    WHERE av.tipo IN ('funcional_v2', 'funcional')
    GROUP BY av.aluno_id
  ), reavaliacoes AS (
    SELECT
      u.aluno_id,
      u.data,
      floor((p_hoje - ((u.data + interval '4 months')::date + 1)) / 15.0)::integer AS janela
    FROM ultimas_avaliacoes u
    WHERE u.data < (p_hoje - interval '4 months')::date
      AND NOT EXISTS (
        SELECT 1
        FROM public.agenda_servicos s
        WHERE s.aluno_id = u.aluno_id
          AND s.atividade ILIKE '%funcional%'
          AND s.data_especifica >= p_hoje
          AND NOT EXISTS (
            SELECT 1
            FROM public.agenda_servicos_excecoes e
            WHERE e.agenda_id = s.id
              AND e.data_excecao = s.data_especifica
          )
      )
  ), creditos AS (
    SELECT
      c.aluno_id,
      COALESCE(c.origem_id, c.id) AS ciclo_origem,
      COALESCE(c.competencia, c.data_validade, c.created_at::date) AS ciclo_data,
      sum(c.quantidade_inicial - c.quantidade_usada)::integer AS saldo
    FROM public.creditos_aluno c
    WHERE c.ativo = true
      AND c.atividade = 'Treino'
      AND NOT COALESCE(c.ilimitado, false)
    GROUP BY
      c.aluno_id,
      COALESCE(c.origem_id, c.id),
      COALESCE(c.competencia, c.data_validade, c.created_at::date)
    HAVING sum(c.quantidade_inicial - c.quantidade_usada) BETWEEN 0 AND 2
  ), aniversarios AS (
    SELECT a.id AS aluno_id, public.fn_cliente_desde(a.id) AS cliente_desde
    FROM public.alunos a
    WHERE a.status = 'ativo'
      AND NOT COALESCE(a.is_equipe, false)
  )
  SELECT p.aluno_id, 'plano_vencendo_30d'::text, 'plano:' || p.id::text,
    '/portal/plano'::text, p.tipo, p.data_fim, NULL::numeric, NULL::integer, NULL::integer
  FROM public.planos p
  WHERE p.ativo = true AND NOT COALESCE(p.renovacao_automatica, false) AND p.data_fim = p_hoje + 30

  UNION ALL

  SELECT r.aluno_id, 'reavaliacao_pendente'::text,
    'reavaliacao:' || r.aluno_id::text || ':' || r.data::text || ':' || r.janela::text,
    '/portal/avaliacoes'::text, NULL::text, r.data, NULL::numeric, NULL::integer, NULL::integer
  FROM reavaliacoes r

  UNION ALL

  SELECT c.aluno_id, 'creditos_baixos'::text,
    'ciclo:' || c.ciclo_origem::text || ':' || c.ciclo_data::text,
    '/portal/plano'::text, NULL::text, c.ciclo_data, NULL::numeric, c.saldo, NULL::integer
  FROM creditos c

  UNION ALL

  SELECT c.aluno_id, 'cobranca_atrasada'::text,
    'cobranca:' || c.id::text || ':D+' || (p_hoje - c.data_vencimento)::text,
    '/portal/pagamentos'::text, NULL::text, c.data_vencimento, c.valor, NULL::integer, NULL::integer
  FROM public.cobrancas c
  WHERE c.status = 'atrasado' AND c.aluno_id IS NOT NULL
    AND c.mensalidade_2027_id IS NULL AND p_hoje - c.data_vencimento IN (1, 3, 7)

  UNION ALL

  SELECT a.aluno_id, 'aniversario_fortem'::text,
    'aniversario:' || a.aluno_id::text || ':' || extract(year FROM p_hoje)::integer::text,
    '/portal'::text, NULL::text, a.cliente_desde, NULL::numeric, NULL::integer,
    extract(year FROM p_hoje)::integer - extract(year FROM a.cliente_desde)::integer
  FROM aniversarios a
  WHERE a.cliente_desde IS NOT NULL
    AND extract(month FROM a.cliente_desde) = extract(month FROM p_hoje)
    AND extract(day FROM a.cliente_desde) = extract(day FROM p_hoje)
    AND extract(year FROM a.cliente_desde) < extract(year FROM p_hoje)

  ORDER BY 2, 3
$function$;

REVOKE ALL ON FUNCTION public.fn_portal_push_avisos(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_portal_push_avisos(date) TO service_role;