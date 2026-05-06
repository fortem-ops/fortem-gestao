
-- 1. Add sexo column to alunos
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS sexo text;

-- 2. Create prospect_anamnese table
CREATE TABLE IF NOT EXISTS public.prospect_anamnese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL UNIQUE,
  limitacoes text,
  atividade_fisica text,
  objetivo_treinamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_anamnese ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view anamnese"
  ON public.prospect_anamnese FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Coord/admin or responsavel can insert anamnese"
  ON public.prospect_anamnese FOR INSERT
  TO authenticated
  WITH CHECK (
    is_coordinator_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = prospect_anamnese.aluno_id AND a.responsavel_id = auth.uid())
  );

CREATE POLICY "Coord/admin or responsavel can update anamnese"
  ON public.prospect_anamnese FOR UPDATE
  TO authenticated
  USING (
    is_coordinator_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = prospect_anamnese.aluno_id AND a.responsavel_id = auth.uid())
  );

CREATE POLICY "Admin can delete anamnese"
  ON public.prospect_anamnese FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_prospect_anamnese_updated_at
  BEFORE UPDATE ON public.prospect_anamnese
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RPC: convert lead to prospect
CREATE OR REPLACE FUNCTION public.fn_convert_lead_to_prospect(
  _aluno_id uuid,
  _data_nascimento date DEFAULT NULL,
  _email text DEFAULT NULL,
  _sexo text DEFAULT NULL,
  _origem text DEFAULT NULL,
  _limitacoes text DEFAULT NULL,
  _atividade_fisica text DEFAULT NULL,
  _objetivo_treinamento text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update aluno fields if provided
  UPDATE public.alunos SET
    data_nascimento = COALESCE(_data_nascimento, data_nascimento),
    email = COALESCE(_email, email),
    sexo = COALESCE(_sexo, sexo),
    status = 'prospect',
    updated_at = now()
  WHERE id = _aluno_id;

  -- Upsert origin in pipeline_metadata
  IF _origem IS NOT NULL THEN
    INSERT INTO public.pipeline_metadata (aluno_id, origem_lead)
    VALUES (_aluno_id, _origem)
    ON CONFLICT (aluno_id) DO UPDATE SET origem_lead = EXCLUDED.origem_lead, updated_at = now();
  END IF;

  -- Upsert anamnese
  INSERT INTO public.prospect_anamnese (aluno_id, limitacoes, atividade_fisica, objetivo_treinamento)
  VALUES (_aluno_id, _limitacoes, _atividade_fisica, _objetivo_treinamento)
  ON CONFLICT (aluno_id) DO UPDATE SET
    limitacoes = COALESCE(EXCLUDED.limitacoes, prospect_anamnese.limitacoes),
    atividade_fisica = COALESCE(EXCLUDED.atividade_fisica, prospect_anamnese.atividade_fisica),
    objetivo_treinamento = COALESCE(EXCLUDED.objetivo_treinamento, prospect_anamnese.objetivo_treinamento),
    updated_at = now();

  -- Move pipeline to "Prospect"
  PERFORM public.fn_move_pipeline(_aluno_id, 'Prospect', 'manual', 'Conversão de Lead', auth.uid());
END;
$$;

-- 4. Trigger: auto-move to "Treino experimental agendado" when agenda created for prospect
CREATE OR REPLACE FUNCTION public.fn_auto_move_experimental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _stage_name text;
BEGIN
  IF NEW.aluno_id IS NULL THEN RETURN NEW; END IF;
  IF NOT (NEW.atividade ILIKE '%experimental%' OR NEW.tipo ILIKE '%experimental%') THEN
    RETURN NEW;
  END IF;
  SELECT s.name INTO _stage_name
  FROM public.alunos a
  JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id
  WHERE a.id = NEW.aluno_id;

  IF _stage_name = 'Prospect' THEN
    PERFORM public.fn_move_pipeline(NEW.aluno_id, 'Treino experimental agendado', 'automation', 'Treino experimental agendado', NEW.profissional_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_move_experimental ON public.agenda_servicos;
CREATE TRIGGER trg_auto_move_experimental
  AFTER INSERT ON public.agenda_servicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_move_experimental();
