
-- FASE 1
ALTER TABLE public.treinos ADD COLUMN IF NOT EXISTS semanas integer NOT NULL DEFAULT 4;

-- FASE 2
CREATE TABLE IF NOT EXISTS public.treino_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  treino_id uuid NOT NULL REFERENCES public.treinos(id) ON DELETE CASCADE,
  agendamento_id uuid REFERENCES public.treino_agendamentos(id) ON DELETE SET NULL,
  variacao text NOT NULL CHECK (variacao IN ('T1','T2','T3','T4','T5','T6','T7','T8')),
  variacao_original text,
  foi_troca boolean NOT NULL DEFAULT false,
  data date NOT NULL DEFAULT CURRENT_DATE,
  concluido_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treino_sessoes_aluno_treino_data ON public.treino_sessoes (aluno_id, treino_id, data);
CREATE INDEX IF NOT EXISTS idx_treino_sessoes_aluno_data ON public.treino_sessoes (aluno_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_treino_sessoes_agendamento ON public.treino_sessoes (agendamento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treino_sessoes TO authenticated;
GRANT ALL ON public.treino_sessoes TO service_role;

ALTER TABLE public.treino_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_treino_sessoes" ON public.treino_sessoes
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "aluno_own_treino_sessoes" ON public.treino_sessoes
  FOR ALL TO authenticated
  USING (aluno_id = public.fn_current_aluno_id())
  WITH CHECK (aluno_id = public.fn_current_aluno_id());

CREATE TRIGGER update_treino_sessoes_updated_at BEFORE UPDATE ON public.treino_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FASE 3
CREATE TABLE IF NOT EXISTS public.treino_cargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  treino_id uuid NOT NULL REFERENCES public.treinos(id) ON DELETE CASCADE,
  exercicio_nome text NOT NULL,
  kg text,
  sessao_id uuid REFERENCES public.treino_sessoes(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aluno_id, treino_id, exercicio_nome)
);

CREATE INDEX IF NOT EXISTS idx_treino_cargas_aluno_treino ON public.treino_cargas (aluno_id, treino_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treino_cargas TO authenticated;
GRANT ALL ON public.treino_cargas TO service_role;

ALTER TABLE public.treino_cargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_all_treino_cargas" ON public.treino_cargas
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "aluno_own_treino_cargas" ON public.treino_cargas
  FOR ALL TO authenticated
  USING (aluno_id = public.fn_current_aluno_id())
  WITH CHECK (aluno_id = public.fn_current_aluno_id());

CREATE TRIGGER update_treino_cargas_updated_at BEFORE UPDATE ON public.treino_cargas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FASE 4
CREATE OR REPLACE FUNCTION public.fn_treino_variacao_atual(
  p_aluno_id uuid,
  p_treino_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _treino public.treinos%ROWTYPE;
  _semanas integer;
  _total_sessoes integer;
BEGIN
  SELECT * INTO _treino FROM public.treinos WHERE id = p_treino_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'treino_nao_encontrado');
  END IF;

  _semanas := COALESCE(_treino.semanas, 4);

  SELECT COUNT(*) INTO _total_sessoes
  FROM public.treino_sessoes
  WHERE aluno_id = p_aluno_id
    AND treino_id = p_treino_id
    AND concluido_em IS NOT NULL;

  RETURN jsonb_build_object(
    'ok', true,
    'total_sessoes_realizadas', _total_sessoes,
    'semanas', _semanas,
    'aluno_id', p_aluno_id,
    'treino_id', p_treino_id
  );
END;
$$;

-- FASE 5
CREATE OR REPLACE FUNCTION public.fn_treino_concluir_sessao(
  p_aluno_id uuid,
  p_treino_id uuid,
  p_variacao text,
  p_agendamento_id uuid DEFAULT NULL,
  p_foi_troca boolean DEFAULT false,
  p_variacao_original text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sessao_id uuid;
  _aluno_id uuid;
BEGIN
  _aluno_id := COALESCE(public.fn_current_aluno_id(), p_aluno_id);

  INSERT INTO public.treino_sessoes (
    aluno_id, treino_id, variacao, variacao_original,
    foi_troca, agendamento_id, data, concluido_em, observacoes
  ) VALUES (
    _aluno_id, p_treino_id, p_variacao, p_variacao_original,
    p_foi_troca, p_agendamento_id, CURRENT_DATE, now(), p_observacoes
  ) RETURNING id INTO _sessao_id;

  IF p_agendamento_id IS NOT NULL THEN
    UPDATE public.treino_agendamentos SET
      status = 'realizado',
      updated_at = now()
    WHERE id = p_agendamento_id
      AND status IN ('agendado', 'confirmado');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sessao_id', _sessao_id
  );
END;
$$;
