CREATE OR REPLACE FUNCTION public.search_cadastros(termo text)
 RETURNS TABLE(id uuid, nome text, telefone text, status text, current_pipeline_stage_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.nome, a.telefone, a.status::text, a.current_pipeline_stage_id
  FROM public.alunos a
  WHERE COALESCE(a.is_equipe, false) = false
    AND public.unaccent(lower(a.nome)) ILIKE public.unaccent(lower('%' || termo || '%'))
  ORDER BY a.nome
  LIMIT 40;
$function$;

CREATE OR REPLACE VIEW public.v_tecnico_alertas AS
 WITH ua AS (
         SELECT avaliacoes.aluno_id,
            max(avaliacoes.data) AS data_ultima
           FROM avaliacoes
          GROUP BY avaliacoes.aluno_id
        ), ut AS (
         SELECT treinos.aluno_id,
            max(treinos.updated_at)::date AS data_ultimo
           FROM treinos
          GROUP BY treinos.aluno_id
        )
 SELECT a.id AS aluno_id,
    a.nome,
    a.responsavel_id,
    a.frequencia_semanal,
    ua.data_ultima AS ultima_avaliacao,
    ut.data_ultimo AS ultimo_treino_atualizado,
        CASE
            WHEN ua.data_ultima IS NULL OR (CURRENT_DATE - ua.data_ultima) > 90 THEN true
            ELSE false
        END AS avaliacao_atrasada,
        CASE
            WHEN ut.data_ultimo IS NULL THEN true
            WHEN a.frequencia_semanal >= 3 AND (CURRENT_DATE - ut.data_ultimo) > 42 THEN true
            WHEN a.frequencia_semanal = 2 AND (CURRENT_DATE - ut.data_ultimo) > 56 THEN true
            WHEN a.frequencia_semanal <= 1 AND (CURRENT_DATE - ut.data_ultimo) > 84 THEN true
            ELSE false
        END AS treino_desatualizado
   FROM alunos a
     LEFT JOIN ua ON ua.aluno_id = a.id
     LEFT JOIN ut ON ut.aluno_id = a.id
  WHERE a.status = 'ativo'::text
    AND COALESCE(a.is_equipe, false) = false;

CREATE OR REPLACE FUNCTION public.fn_carteira_ativos_por_profissional()
 RETURNS TABLE(profissional_id uuid, qtd_alunos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.responsavel_id AS profissional_id, COUNT(*)::int AS qtd_alunos
  FROM public.alunos a
  WHERE a.status = 'ativo'
    AND COALESCE(a.is_equipe, false) = false
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
$function$;