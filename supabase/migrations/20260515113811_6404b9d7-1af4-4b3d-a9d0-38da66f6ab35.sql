CREATE OR REPLACE FUNCTION public.fn_detect_evasao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno record;
  _ativo_id uuid;
  _risco_id uuid;
  _renov_id uuid;
  _inativo_id uuid;
  _moved_to_risco int := 0;
  _moved_to_renov int := 0;
  _moved_to_inativo int := 0;
  _moved_to_ativo int := 0;
BEGIN
  SELECT id INTO _ativo_id FROM pipeline_stages WHERE name = 'Aluno ativo';
  SELECT id INTO _risco_id FROM pipeline_stages WHERE name = 'Risco de evasão';
  SELECT id INTO _renov_id FROM pipeline_stages WHERE name = 'Renovação de plano';
  SELECT id INTO _inativo_id FROM pipeline_stages WHERE name = 'Aluno inativo';

  -- Reativação: aluno em Inativo que voltou a ter plano ativo (incluindo auto-renovação)
  FOR _aluno IN
    SELECT a.id FROM alunos a
    JOIN pipeline_stages ps ON ps.id = a.current_pipeline_stage_id
    WHERE ps.funnel = 'inativo'
      AND a.status NOT IN ('lead','prospect')
      AND EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND (
            p.data_fim IS NULL
            OR p.data_fim >= CURRENT_DATE
            OR LOWER(COALESCE(p.tipo,'')) ~ '(start|gympass|wellhub|total ?pass)'
          )
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Aluno ativo', 'auto_evasao'::pipeline_movement_source,
                             'Aluno reativado: plano ativo detectado.', NULL);
    _moved_to_ativo := _moved_to_ativo + 1;
  END LOOP;

  -- Ativo → Risco: sem agenda recente
  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id = _ativo_id AND a.status = 'ativo'
      AND NOT EXISTS (
        SELECT 1 FROM agenda_servicos ag
        WHERE ag.aluno_id = a.id
          AND COALESCE(ag.data_especifica, CURRENT_DATE) >= CURRENT_DATE - INTERVAL '7 days'
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Risco de evasão', 'auto_evasao'::pipeline_movement_source,
                             'Sem atividade recente.', NULL);
    _moved_to_risco := _moved_to_risco + 1;
  END LOOP;

  -- Ativo/Risco → Renovação: plano termina em ≤15 dias (exceto auto-renovação)
  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id IN (_ativo_id, _risco_id)
      AND EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND p.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
          AND LOWER(COALESCE(p.tipo,'')) !~ '(start|gympass|wellhub|total ?pass)'
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Renovação de plano', 'auto_evasao'::pipeline_movement_source,
                             'Plano expira em até 15 dias.', NULL);
    _moved_to_renov := _moved_to_renov + 1;
  END LOOP;

  -- Qualquer aluno em funil "aluno" sem plano ativo vigente → Inativo (imediato)
  FOR _aluno IN
    SELECT a.id FROM alunos a
    JOIN pipeline_stages ps ON ps.id = a.current_pipeline_stage_id
    WHERE ps.funnel = 'aluno'
      AND a.status NOT IN ('lead','prospect')
      AND NOT EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND (
            p.data_fim IS NULL
            OR p.data_fim >= CURRENT_DATE
            OR LOWER(COALESCE(p.tipo,'')) ~ '(start|gympass|wellhub|total ?pass)'
          )
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Aluno inativo', 'auto_evasao'::pipeline_movement_source,
                             'Sem plano ativo vigente.', NULL);
    _moved_to_inativo := _moved_to_inativo + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'movidos_para_risco', _moved_to_risco,
    'movidos_para_renovacao', _moved_to_renov,
    'movidos_para_inativo', _moved_to_inativo,
    'movidos_para_recuperado', _moved_to_ativo
  );
END;
$$;