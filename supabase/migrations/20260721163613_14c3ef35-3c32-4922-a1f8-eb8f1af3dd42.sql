
CREATE TABLE public.clube_desafios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  tipo_meta text NOT NULL CHECK (tipo_meta IN ('treinos_realizados', 'avaliacoes_funcionais', 'indicacoes_convertidas', 'checkins_semana')),
  valor_meta integer NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  tipo_recompensa text NOT NULL DEFAULT 'pontos' CHECK (tipo_recompensa IN ('pontos', 'parceiro', 'combinado')),
  pontos_recompensa integer DEFAULT 0,
  mensagem_recompensa text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'encerrado')),
  progresso_atual integer NOT NULL DEFAULT 0,
  meta_atingida boolean NOT NULL DEFAULT false,
  meta_atingida_em timestamptz,
  recompensa_distribuida boolean NOT NULL DEFAULT false,
  recompensa_distribuida_em timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clube_desafios TO authenticated;
GRANT ALL ON public.clube_desafios TO service_role;

ALTER TABLE public.clube_desafios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_desafios" ON public.clube_desafios FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_desafios_ativos" ON public.clube_desafios FOR SELECT USING (
  status = 'ativo' AND auth.uid() IS NOT NULL
);

CREATE TABLE public.clube_desafios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id uuid NOT NULL REFERENCES public.clube_desafios(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  pontos_recebidos integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clube_desafios_log TO authenticated;
GRANT ALL ON public.clube_desafios_log TO service_role;

ALTER TABLE public.clube_desafios_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_desafios_log" ON public.clube_desafios_log FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_own_log" ON public.clube_desafios_log FOR SELECT USING (
  aluno_id = public.fn_current_aluno_id()
);

CREATE OR REPLACE FUNCTION public.fn_desafio_calcular_progresso(p_desafio_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _desafio clube_desafios%ROWTYPE;
  _progresso integer := 0;
BEGIN
  SELECT * INTO _desafio FROM clube_desafios WHERE id = p_desafio_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  _progresso := CASE _desafio.tipo_meta
    WHEN 'treinos_realizados' THEN (
      SELECT COUNT(*)::integer FROM treino_agendamentos
      WHERE status IN ('realizado', 'confirmado')
      AND data BETWEEN _desafio.data_inicio AND _desafio.data_fim
    )
    WHEN 'avaliacoes_funcionais' THEN (
      SELECT COUNT(*)::integer FROM avaliacoes
      WHERE tipo IN ('funcional_v2', 'funcional')
      AND data::date BETWEEN _desafio.data_inicio AND _desafio.data_fim
    )
    WHEN 'indicacoes_convertidas' THEN (
      SELECT COUNT(*)::integer FROM clube_indicacoes
      WHERE status = 'convertido'
      AND convertido_em::date BETWEEN _desafio.data_inicio AND _desafio.data_fim
    )
    WHEN 'checkins_semana' THEN (
      SELECT COUNT(*)::integer FROM treino_agendamentos
      WHERE status IN ('realizado', 'confirmado')
      AND data BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE
    )
    ELSE 0
  END;

  RETURN _progresso;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_desafio_atualizar_progresso(p_desafio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _desafio clube_desafios%ROWTYPE;
  _progresso integer;
  _aluno RECORD;
  _alunos_count integer := 0;
BEGIN
  SELECT * INTO _desafio FROM clube_desafios WHERE id = p_desafio_id AND status = 'ativo';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'desafio_nao_encontrado'); END IF;

  _progresso := fn_desafio_calcular_progresso(p_desafio_id);

  UPDATE clube_desafios SET
    progresso_atual = _progresso,
    updated_at = now()
  WHERE id = p_desafio_id;

  IF _progresso >= _desafio.valor_meta AND NOT _desafio.meta_atingida THEN
    UPDATE clube_desafios SET
      meta_atingida = true,
      meta_atingida_em = now(),
      updated_at = now()
    WHERE id = p_desafio_id;

    IF (_desafio.tipo_recompensa IN ('pontos', 'combinado')) AND
       (_desafio.pontos_recompensa > 0) AND
       NOT _desafio.recompensa_distribuida THEN

      FOR _aluno IN
        SELECT DISTINCT a.id as aluno_id
        FROM alunos a
        JOIN planos p ON p.aluno_id = a.id AND p.ativo = true
        WHERE a.status = 'ativo'
      LOOP
        PERFORM fn_clube_adicionar_pontos(
          _aluno.aluno_id,
          'ajuste_manual',
          p_desafio_id,
          'desafio_coletivo',
          'Recompensa: ' || _desafio.titulo,
          NULL,
          _desafio.pontos_recompensa
        );

        INSERT INTO clube_desafios_log (desafio_id, aluno_id, pontos_recebidos)
        VALUES (p_desafio_id, _aluno.aluno_id, _desafio.pontos_recompensa);

        _alunos_count := _alunos_count + 1;
      END LOOP;

      UPDATE clube_desafios SET
        recompensa_distribuida = true,
        recompensa_distribuida_em = now(),
        status = 'concluido',
        updated_at = now()
      WHERE id = p_desafio_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'progresso', _progresso,
    'meta', _desafio.valor_meta,
    'meta_atingida', (_progresso >= _desafio.valor_meta),
    'alunos_recompensados', _alunos_count
  );
END;
$fn$;

SELECT cron.schedule(
  'fortem-desafios-progresso',
  '0 * * * *',
  $cron$
  DO $inner$
  DECLARE rec RECORD;
  BEGIN
    FOR rec IN SELECT id FROM public.clube_desafios WHERE status = 'ativo' LOOP
      PERFORM public.fn_desafio_atualizar_progresso(rec.id);
    END LOOP;
    UPDATE public.clube_desafios SET status = 'encerrado', updated_at = now()
    WHERE status = 'ativo' AND data_fim < CURRENT_DATE AND NOT meta_atingida;
  END;
  $inner$;
  $cron$
);

SELECT cron.schedule(
  'fortem-finalizar-treinos-dia',
  '55 23 * * *',
  $cron$
  UPDATE public.treino_agendamentos
  SET status = 'realizado', updated_at = now()
  WHERE status IN ('agendado', 'confirmado')
  AND data = CURRENT_DATE;
  $cron$
);
