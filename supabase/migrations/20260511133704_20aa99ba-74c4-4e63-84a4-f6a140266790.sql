-- 1) pipeline_stages.funnel
CREATE TYPE public.pipeline_funnel AS ENUM ('prospects', 'aluno', 'inativo');

ALTER TABLE public.pipeline_stages
  ADD COLUMN funnel public.pipeline_funnel NOT NULL DEFAULT 'prospects';

-- Backfill
UPDATE public.pipeline_stages SET funnel = 'aluno'
  WHERE name IN ('Aluno ativo', 'Risco de evasão', 'Aluno recuperado', 'Renovação de plano', 'Plano contratado');

UPDATE public.pipeline_stages SET funnel = 'inativo'
  WHERE name IN ('Aluno inativo');

UPDATE public.pipeline_stages SET funnel = 'prospects'
  WHERE name IN ('Novo lead', 'Informações encaminhadas', 'Prospect', 'Agendando',
                 'Treino experimental agendado', 'Follow Up',
                 'Avaliação agendada', 'Avaliação confirmada', 'Avaliação realizada',
                 'Aluno perdido', 'Aula experimental agendada', 'Proposta enviada');

-- Create new stages if missing
INSERT INTO public.pipeline_stages (name, color, position, funnel, is_active)
SELECT 'Agendando', 'amber', 25, 'prospects', true
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE name = 'Agendando');

INSERT INTO public.pipeline_stages (name, color, position, funnel, is_active)
SELECT 'Renovação de plano', 'amber', 50, 'aluno', true
WHERE NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE name = 'Renovação de plano');

-- 2) Endereço + motivo_perda em alunos
ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS motivo_perda text;

-- 3) Atualizar fn_detect_evasao para mover Risco→Inativo após 15d do fim do plano
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
BEGIN
  SELECT id INTO _ativo_id FROM pipeline_stages WHERE name = 'Aluno ativo';
  SELECT id INTO _risco_id FROM pipeline_stages WHERE name = 'Risco de evasão';
  SELECT id INTO _renov_id FROM pipeline_stages WHERE name = 'Renovação de plano';
  SELECT id INTO _inativo_id FROM pipeline_stages WHERE name = 'Aluno inativo';

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

  -- Ativo/Risco → Renovação: plano termina em ≤15 dias
  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id IN (_ativo_id, _risco_id)
      AND EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND p.data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
      )
  LOOP
    PERFORM fn_move_pipeline(_aluno.id, 'Renovação de plano', 'auto_evasao'::pipeline_movement_source,
                             'Plano expira em até 15 dias.', NULL);
    _moved_to_renov := _moved_to_renov + 1;
  END LOOP;

  -- Risco/Renovação → Inativo: passados 15 dias do término do último plano
  FOR _aluno IN
    SELECT a.id FROM alunos a
    WHERE a.current_pipeline_stage_id IN (_risco_id, _renov_id, _ativo_id)
      AND NOT EXISTS (
        SELECT 1 FROM planos p
        WHERE p.aluno_id = a.id AND p.ativo = true
          AND (p.data_fim IS NULL OR p.data_fim >= CURRENT_DATE - INTERVAL '15 days')
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
    'movidos_para_recuperado', 0
  );
END;
$$;