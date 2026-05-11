-- Helper: identifies plan types with automatic monthly renewal
CREATE OR REPLACE FUNCTION public.fn_is_auto_renew_plan(_tipo text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _tipo IS NOT NULL AND (
    lower(_tipo) LIKE '%start%'
    OR lower(_tipo) LIKE '%gympass%'
    OR lower(_tipo) LIKE '%wellhub%'
    OR lower(_tipo) LIKE '%total%pass%'
    OR lower(_tipo) LIKE '%totalpass%'
  );
$$;

-- Update evasion detection: skip auto-renew plans and roll their data_fim forward monthly
CREATE OR REPLACE FUNCTION public.fn_detect_evasao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _aluno record;
  _plano record;
  _ativo_id uuid;
  _risco_id uuid;
  _renov_id uuid;
  _inativo_id uuid;
  _moved_to_risco int := 0;
  _moved_to_renov int := 0;
  _moved_to_inativo int := 0;
  _renewed int := 0;
  _new_fim date;
BEGIN
  SELECT id INTO _ativo_id FROM pipeline_stages WHERE name = 'Aluno ativo';
  SELECT id INTO _risco_id FROM pipeline_stages WHERE name = 'Risco de evasão';
  SELECT id INTO _renov_id FROM pipeline_stages WHERE name = 'Renovação de plano';
  SELECT id INTO _inativo_id FROM pipeline_stages WHERE name = 'Aluno inativo';

  -- Auto-renew monthly plans (Start, Gympass/Wellhub, Total Pass) when expired
  FOR _plano IN
    SELECT p.* FROM planos p
    WHERE p.ativo = true
      AND fn_is_auto_renew_plan(p.tipo)
      AND p.data_fim IS NOT NULL
      AND p.data_fim <= CURRENT_DATE
  LOOP
    _new_fim := _plano.data_fim;
    WHILE _new_fim <= CURRENT_DATE LOOP
      _new_fim := (_new_fim + INTERVAL '1 month')::date;
    END LOOP;
    UPDATE planos
       SET data_fim = _new_fim,
           duracao_meses = duracao_meses + GREATEST(1, ((_new_fim - _plano.data_fim) / 30)::int),
           updated_at = now()
     WHERE id = _plano.id;
    _renewed := _renewed + 1;
  END LOOP;

  -- Ativo → Risco: sem agenda recente (skip alunos com plano auto-renovável ativo)
  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id = _ativo_id AND a.status = 'ativo'
      AND NOT EXISTS (
        SELECT 1 FROM agenda_servicos ag
        WHERE ag.aluno_id = a.id
          AND COALESCE(ag.data_especifica, CURRENT_DATE) >= CURRENT_DATE - INTERVAL '7 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND fn_is_auto_renew_plan(p.tipo)
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Risco de evasão', 'auto_evasao'::pipeline_movement_source,
                             'Sem atividade recente.', NULL);
    _moved_to_risco := _moved_to_risco + 1;
  END LOOP;

  -- Ativo/Risco → Renovação: plano termina em ≤15 dias (exceto auto-renováveis)
  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id IN (_ativo_id, _risco_id)
      AND EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND p.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
          AND NOT fn_is_auto_renew_plan(p.tipo)
      )
      AND NOT EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND fn_is_auto_renew_plan(p.tipo)
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Renovação de plano', 'auto_evasao'::pipeline_movement_source,
                             'Plano expira em até 15 dias.', NULL);
    _moved_to_renov := _moved_to_renov + 1;
  END LOOP;

  -- Risco/Renovação/Ativo → Inativo: 15 dias após término (exceto se houver plano auto-renovável ativo)
  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id IN (_risco_id, _renov_id, _ativo_id)
      AND NOT EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND (p.data_fim IS NULL OR p.data_fim >= CURRENT_DATE - INTERVAL '15 days')
      )
      AND NOT EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND fn_is_auto_renew_plan(p.tipo)
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Aluno inativo', 'auto_evasao'::pipeline_movement_source,
                             'Plano vencido há mais de 15 dias.', NULL);
    _moved_to_inativo := _moved_to_inativo + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'movidos_para_risco', _moved_to_risco,
    'movidos_para_renovacao', _moved_to_renov,
    'movidos_para_inativo', _moved_to_inativo,
    'planos_auto_renovados', _renewed,
    'movidos_para_recuperado', 0
  );
END;
$function$;