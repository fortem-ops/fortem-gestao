CREATE OR REPLACE FUNCTION public.fn_auditoria_fiscal_pipeline()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sem int := 0; v_venc int := 0; v_ganho int := 0; v_orig int := 0;
BEGIN
  -- Leads em aberto no funil Prospects
  WITH leads AS (
    SELECT a.id AS aluno_id, s.name AS etapa, pm.next_followup_at,
      greatest(pm.last_contact_at, pm.updated_at,
               (SELECT max(mv.moved_at) FROM public.pipeline_movements mv WHERE mv.aluno_id = a.id)) AS ultima
    FROM public.alunos a
    JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id AND s.is_active
    JOIN public.pipeline_funnels f ON f.id = s.funnel_id AND f.slug = 'prospects'
    LEFT JOIN public.pipeline_metadata pm ON pm.aluno_id = a.id
    WHERE s.name <> 'Aluno perdido' AND NOT coalesce(a.is_equipe, false)
  ),
  n1 AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'pipeline', 'lead_sem_followup', 'atencao',
      'Lead na etapa "' || l.etapa || '" sem nenhum contato ou movimentação ' ||
        coalesce('desde ' || to_char(l.ultima AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') || ' (' ||
          public.fn_dias_uteis_entre((l.ultima AT TIME ZONE 'America/Sao_Paulo')::date, current_date) || ' dias úteis).', 'registrado.'),
      l.aluno_id,
      jsonb_build_object('aluno_id', l.aluno_id, 'ultima_atividade', l.ultima)
    FROM leads l
    WHERE l.ultima IS NULL
       OR public.fn_dias_uteis_entre((l.ultima AT TIME ZONE 'America/Sao_Paulo')::date, current_date) > 5
    ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_sem FROM n1;

  WITH leads AS (
    SELECT a.id AS aluno_id, s.name AS etapa, pm.next_followup_at, pm.last_contact_at
    FROM public.alunos a
    JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id AND s.is_active
    JOIN public.pipeline_funnels f ON f.id = s.funnel_id AND f.slug = 'prospects'
    JOIN public.pipeline_metadata pm ON pm.aluno_id = a.id
    WHERE s.name <> 'Aluno perdido' AND NOT coalesce(a.is_equipe, false)
      AND pm.next_followup_at IS NOT NULL
  ),
  n2 AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'pipeline', 'followup_vencido', 'atencao',
      'Retorno combinado para ' || to_char(l.next_followup_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') ||
        ' venceu e não houve novo contato (etapa "' || l.etapa || '").',
      l.aluno_id,
      jsonb_build_object('aluno_id', l.aluno_id, 'next_followup_at', l.next_followup_at)
    FROM leads l
    WHERE public.fn_dias_uteis_entre((l.next_followup_at AT TIME ZONE 'America/Sao_Paulo')::date, current_date) > 1
      AND (l.last_contact_at IS NULL OR l.last_contact_at < l.next_followup_at)
    ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_venc FROM n2;

  -- "Ganho" (Aluno ativo / Renovação de plano) sem contrato
  WITH g AS (
    SELECT a.id AS aluno_id, s.name AS etapa,
      coalesce((SELECT max(mv.moved_at) FROM public.pipeline_movements mv WHERE mv.aluno_id = a.id AND mv.to_stage_id = s.id), a.updated_at) AS entrou
    FROM public.alunos a
    JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id
    WHERE s.name IN ('Aluno ativo', 'Renovação de plano') AND NOT coalesce(a.is_equipe, false)
      AND NOT EXISTS (SELECT 1 FROM public.contratos c WHERE c.aluno_id = a.id AND c.status <> 'cancelado')
  ),
  n3 AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'pipeline', 'ganho_sem_contrato', 'critico',
      'Aluno na etapa "' || g.etapa || '" desde ' || to_char(g.entrou AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') ||
        ', mas sem nenhum contrato — possível venda não formalizada.',
      g.aluno_id,
      jsonb_build_object('aluno_id', g.aluno_id)
    FROM g
    WHERE g.entrou < now() - interval '3 days'
    ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_ganho FROM n3;

  -- Primeiro contrato (últimos 30 dias) de aluno que nunca passou pelo funil e sem origem.
  -- Planos de agregadora (TotalPass, Gympass/Wellhub) chegam pela plataforma, sem funil: excluídos.
  WITH c1 AS (
    SELECT c.id AS contrato_id, c.aluno_id, c.created_at, c.plano_tipo
    FROM public.contratos c
    WHERE c.created_at > now() - interval '30 days'
      AND coalesce(c.plano_tipo, '') NOT IN ('totalpass', 'gympass')
      AND NOT EXISTS (SELECT 1 FROM public.contratos c0 WHERE c0.aluno_id = c.aluno_id AND c0.created_at < c.created_at)
      AND NOT EXISTS (
        SELECT 1 FROM public.pipeline_movements mv
        JOIN public.pipeline_stages s ON s.id IN (mv.from_stage_id, mv.to_stage_id)
        JOIN public.pipeline_funnels f ON f.id = s.funnel_id AND f.slug = 'prospects'
        WHERE mv.aluno_id = c.aluno_id AND mv.moved_at <= c.created_at)
      AND NOT EXISTS (SELECT 1 FROM public.pipeline_metadata pm WHERE pm.aluno_id = c.aluno_id AND nullif(trim(pm.origem_lead), '') IS NOT NULL)
  ),
  n4 AS (
    INSERT INTO public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, aluno_id, registros_afetados)
    SELECT 'pipeline', 'contrato_sem_origem', 'info',
      'Primeiro contrato (' || coalesce(c1.plano_tipo, 'plano') || ', ' || to_char(c1.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') ||
        ') criado sem passagem pelo funil e sem origem do lead.',
      c1.aluno_id,
      jsonb_build_object('contrato_id', c1.contrato_id, 'aluno_id', c1.aluno_id)
    FROM c1
    ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT count(*) INTO v_orig FROM n4;

  RETURN jsonb_build_object('lead_sem_followup', v_sem, 'followup_vencido', v_venc,
    'ganho_sem_contrato', v_ganho, 'contrato_sem_origem', v_orig, 'executado_em', now());
END;
$function$;