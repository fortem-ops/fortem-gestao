
-- Helpers temporários
CREATE OR REPLACE FUNCTION public._tmp_map_nivel(x text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE x
    WHEN 'start' THEN 'prata' WHEN 'start_plus' THEN 'prata'
    WHEN 'power' THEN 'ouro' WHEN 'pro' THEN 'diamante' WHEN 'max' THEN 'platina'
    WHEN 'agregador' THEN 'bronze' ELSE x END
$$;

CREATE OR REPLACE FUNCTION public._tmp_map_nivel_arr(arr anyarray) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(public._tmp_map_nivel(x::text)), '{}'::text[])
  FROM unnest(arr) x
$$;

ALTER TYPE public.clube_nivel_membro RENAME TO clube_nivel_membro_old;
CREATE TYPE public.clube_nivel_membro AS ENUM ('bronze','prata','ouro','diamante','platina');

ALTER TABLE public.beneficios ALTER COLUMN niveis_permitidos DROP DEFAULT;
ALTER TABLE public.beneficios
  ALTER COLUMN niveis_permitidos TYPE text[]
  USING public._tmp_map_nivel_arr(niveis_permitidos);
ALTER TABLE public.beneficios
  ALTER COLUMN niveis_permitidos TYPE public.clube_nivel_membro[]
  USING niveis_permitidos::public.clube_nivel_membro[];
ALTER TABLE public.beneficios
  ALTER COLUMN niveis_permitidos SET DEFAULT '{}'::public.clube_nivel_membro[];

ALTER TABLE public.clube_fortem_membros ALTER COLUMN nivel_membro DROP DEFAULT;
ALTER TABLE public.clube_fortem_membros
  ALTER COLUMN nivel_membro TYPE public.clube_nivel_membro
  USING (public._tmp_map_nivel(nivel_membro::text)::public.clube_nivel_membro);
ALTER TABLE public.clube_fortem_membros
  ALTER COLUMN nivel_membro SET DEFAULT 'prata'::public.clube_nivel_membro;

DROP TYPE public.clube_nivel_membro_old;
DROP FUNCTION public._tmp_map_nivel_arr(anyarray);
DROP FUNCTION public._tmp_map_nivel(text);

UPDATE public.clube_pontos SET nivel = CASE nivel
  WHEN 'start' THEN 'prata' WHEN 'start_plus' THEN 'prata'
  WHEN 'power' THEN 'ouro' WHEN 'pro' THEN 'diamante' WHEN 'max' THEN 'platina'
  WHEN 'iniciante' THEN 'prata' WHEN 'dedicado' THEN 'ouro'
  WHEN 'comprometido' THEN 'diamante' WHEN 'elite' THEN 'platina'
  ELSE nivel END
WHERE nivel NOT IN ('bronze','prata','ouro','diamante','platina');
ALTER TABLE public.clube_pontos ALTER COLUMN nivel SET DEFAULT 'prata';

ALTER TABLE public.clube_recompensas ADD COLUMN IF NOT EXISTS custo_agregador integer;
UPDATE public.clube_recompensas
SET custo_agregador = ROUND(COALESCE(custo_start, custo_pontos) * 1.3)
WHERE custo_agregador IS NULL;

CREATE OR REPLACE FUNCTION public.fn_sync_nivel_membro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _nivel_pontos text; _nivel_plano text; _nivel_final text;
  _plano_tipo text; _is_agregador boolean;
BEGIN
  SELECT lower(tipo) INTO _plano_tipo FROM planos
  WHERE aluno_id = NEW.aluno_id AND ativo = true
  ORDER BY created_at DESC LIMIT 1;
  _plano_tipo := COALESCE(_plano_tipo, 'start');
  _is_agregador := (_plano_tipo LIKE '%wellhub%' OR _plano_tipo LIKE '%gympass%'
    OR _plano_tipo LIKE '%total pass%' OR _plano_tipo LIKE '%totalpass%');

  IF _is_agregador THEN
    INSERT INTO public.clube_fortem_membros (aluno_id, nivel_membro, status_membro)
    VALUES (NEW.aluno_id, 'bronze'::public.clube_nivel_membro, 'ativo')
    ON CONFLICT (aluno_id) DO UPDATE SET
      nivel_membro = 'bronze'::public.clube_nivel_membro, updated_at = now();
    RETURN NEW;
  END IF;

  _nivel_pontos := CASE
    WHEN NEW.saldo >= 3000 THEN 'platina'
    WHEN NEW.saldo >= 1000 THEN 'diamante'
    WHEN NEW.saldo >= 300  THEN 'ouro'
    ELSE 'prata' END;
  _nivel_plano := CASE
    WHEN _plano_tipo LIKE '%max%'   THEN 'platina'
    WHEN _plano_tipo LIKE '%pro%'   THEN 'diamante'
    WHEN _plano_tipo LIKE '%power%' THEN 'ouro'
    ELSE 'prata' END;
  _nivel_final := CASE
    WHEN 'platina' IN (_nivel_pontos, _nivel_plano) THEN 'platina'
    WHEN 'diamante' IN (_nivel_pontos, _nivel_plano) THEN 'diamante'
    WHEN 'ouro' IN (_nivel_pontos, _nivel_plano) THEN 'ouro'
    ELSE 'prata' END;

  INSERT INTO public.clube_fortem_membros (aluno_id, nivel_membro, status_membro)
  VALUES (NEW.aluno_id, _nivel_final::public.clube_nivel_membro, 'ativo')
  ON CONFLICT (aluno_id) DO UPDATE SET
    nivel_membro = _nivel_final::public.clube_nivel_membro, updated_at = now()
  WHERE clube_fortem_membros.nivel_membro::text IS DISTINCT FROM _nivel_final;
  RETURN NEW;
END; $$;

-- fn_clube_adicionar_pontos (mantém p_pontos_manual para não quebrar callers)
CREATE OR REPLACE FUNCTION public.fn_clube_adicionar_pontos(
  p_aluno_id uuid, p_acao text, p_referencia_id uuid DEFAULT NULL,
  p_referencia_tipo text DEFAULT NULL, p_motivo_manual text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL, p_pontos_manual integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _regra clube_regras_pontuacao%ROWTYPE; _clima clube_clima_cache%ROWTYPE;
  _config_mult text; _multiplicador numeric(3,2) := 1.0;
  _pontos_base integer; _pontos_final integer; _saldo_atual integer;
  _validade_meses integer; _plano_tipo text; _is_agregador boolean; _nivel_novo text;
BEGIN
  SELECT * INTO _regra FROM clube_regras_pontuacao WHERE acao = p_acao AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'regra_nao_encontrada'); END IF;
  _pontos_base := COALESCE(p_pontos_manual, _regra.pontos);
  IF _regra.unica_vez THEN
    IF EXISTS (SELECT 1 FROM clube_historico WHERE aluno_id = p_aluno_id AND acao = p_acao) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'acao_ja_realizada');
    END IF;
  END IF;

  SELECT lower(tipo) INTO _plano_tipo FROM planos
  WHERE aluno_id = p_aluno_id AND ativo = true ORDER BY created_at DESC LIMIT 1;
  _plano_tipo := COALESCE(_plano_tipo, 'start');
  _is_agregador := (_plano_tipo LIKE '%wellhub%' OR _plano_tipo LIKE '%gympass%'
    OR _plano_tipo LIKE '%total pass%' OR _plano_tipo LIKE '%totalpass%');

  IF _is_agregador THEN
    _pontos_base := ROUND(_pontos_base * 0.5);
  ELSE
    SELECT * INTO _clima FROM clube_clima_cache WHERE data = CURRENT_DATE;
    IF FOUND AND _clima.multiplicador_ativo AND p_acao = 'treino_realizado' THEN
      SELECT valor INTO _config_mult FROM clube_config WHERE chave = 'clima_multiplicador';
      _multiplicador := COALESCE(_config_mult::numeric, 1.5);
    END IF;
  END IF;

  _pontos_final := ROUND(_pontos_base * _multiplicador);
  SELECT valor::integer INTO _validade_meses FROM clube_config WHERE chave = 'pontos_validade_meses';
  _validade_meses := COALESCE(_validade_meses, 12);

  _nivel_novo := CASE WHEN _is_agregador THEN 'bronze' ELSE (
    SELECT CASE
      WHEN (COALESCE(saldo, 0) + _pontos_final) >= 3000 THEN 'platina'
      WHEN (COALESCE(saldo, 0) + _pontos_final) >= 1000 THEN 'diamante'
      WHEN (COALESCE(saldo, 0) + _pontos_final) >= 300  THEN 'ouro'
      ELSE 'prata' END
    FROM clube_pontos WHERE aluno_id = p_aluno_id
  ) END;
  _nivel_novo := COALESCE(_nivel_novo, CASE WHEN _is_agregador THEN 'bronze' ELSE 'prata' END);

  INSERT INTO clube_pontos (aluno_id, total_acumulado, saldo, nivel, ultima_movimentacao, pontos_expiram_em)
  VALUES (p_aluno_id, _pontos_final, _pontos_final, _nivel_novo,
    now(), now() + (_validade_meses || ' months')::interval)
  ON CONFLICT (aluno_id) DO UPDATE SET
    total_acumulado = clube_pontos.total_acumulado + _pontos_final,
    saldo = clube_pontos.saldo + _pontos_final, nivel = _nivel_novo,
    ultima_movimentacao = now(),
    pontos_expiram_em = now() + (_validade_meses || ' months')::interval,
    updated_at = now()
  RETURNING saldo INTO _saldo_atual;

  INSERT INTO clube_historico (aluno_id, acao, label, pontos, multiplicador, pontos_final,
    multiplicador_clima, motivo_manual, referencia_id, referencia_tipo, created_by)
  VALUES (p_aluno_id, p_acao, _regra.label, _pontos_base, _multiplicador, _pontos_final,
    (_multiplicador > 1.0 AND NOT _is_agregador),
    CASE WHEN _is_agregador THEN 'Agregador (50% dos pontos)' ELSE p_motivo_manual END,
    p_referencia_id, p_referencia_tipo, p_created_by);

  RETURN jsonb_build_object('ok', true, 'pontos_adicionados', _pontos_final,
    'multiplicador', _multiplicador,
    'multiplicador_clima', (_multiplicador > 1.0 AND NOT _is_agregador),
    'is_agregador', _is_agregador, 'saldo_atual', _saldo_atual);
END; $$;

CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(p_recompensa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _aluno_id uuid; _recompensa clube_recompensas%ROWTYPE;
  _pontos clube_pontos%ROWTYPE; _plano_tipo text;
  _custo_final integer; _is_agregador boolean;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); END IF;

  SELECT * INTO _recompensa FROM clube_recompensas WHERE id = p_recompensa_id AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'recompensa_invalida'); END IF;

  SELECT lower(tipo) INTO _plano_tipo FROM planos
  WHERE aluno_id = _aluno_id AND ativo = true ORDER BY created_at DESC LIMIT 1;
  _plano_tipo := REPLACE(LOWER(COALESCE(_plano_tipo, 'start')), '+', '_plus');
  _plano_tipo := REPLACE(_plano_tipo, ' ', '_');

  _is_agregador := (_plano_tipo LIKE '%wellhub%' OR _plano_tipo LIKE '%gympass%'
    OR _plano_tipo LIKE '%total_pass%' OR _plano_tipo LIKE '%totalpass%');

  IF NOT _is_agregador AND _recompensa.planos_elegiveis IS NOT NULL
     AND array_length(_recompensa.planos_elegiveis, 1) > 0
     AND NOT (_plano_tipo = ANY(_recompensa.planos_elegiveis)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'plano_nao_elegivel');
  END IF;

  _custo_final := CASE
    WHEN _is_agregador THEN COALESCE(_recompensa.custo_agregador, ROUND(COALESCE(_recompensa.custo_start, _recompensa.custo_pontos) * 1.3))
    WHEN _plano_tipo LIKE '%platina%' OR _plano_tipo LIKE '%max%'  THEN COALESCE(_recompensa.custo_max, _recompensa.custo_pontos)
    WHEN _plano_tipo LIKE '%diamante%' OR _plano_tipo LIKE '%pro%' THEN COALESCE(_recompensa.custo_pro, _recompensa.custo_pontos)
    WHEN _plano_tipo LIKE '%ouro%' OR _plano_tipo LIKE '%power%'   THEN COALESCE(_recompensa.custo_power, _recompensa.custo_pontos)
    WHEN _plano_tipo LIKE '%start_plus%' THEN COALESCE(_recompensa.custo_start_plus, _recompensa.custo_pontos)
    ELSE COALESCE(_recompensa.custo_start, _recompensa.custo_pontos)
  END;

  SELECT * INTO _pontos FROM clube_pontos WHERE aluno_id = _aluno_id;
  IF NOT FOUND OR _pontos.saldo < _custo_final THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'saldo_insuficiente', 'saldo', COALESCE(_pontos.saldo, 0), 'custo', _custo_final);
  END IF;

  UPDATE clube_pontos SET saldo = saldo - _custo_final,
    total_resgatado = total_resgatado + _custo_final, updated_at = now()
  WHERE aluno_id = _aluno_id;

  INSERT INTO clube_resgates (aluno_id, recompensa_id, pontos_utilizados, status)
  VALUES (_aluno_id, p_recompensa_id, _custo_final,
    CASE WHEN _recompensa.tipo = 'automatico' THEN 'aprovado' ELSE 'pendente' END);

  INSERT INTO clube_historico (aluno_id, acao, label, pontos, pontos_final)
  VALUES (_aluno_id, 'resgate', 'Resgate: ' || _recompensa.nome, -_custo_final, -_custo_final);

  RETURN jsonb_build_object('ok', true, 'tipo', _recompensa.tipo, 'recompensa', _recompensa.nome, 'custo', _custo_final, 'is_agregador', _is_agregador);
END; $$;

DO $$
DECLARE
  rec RECORD; _plano_tipo text; _is_ag boolean;
  _nivel_pontos text; _nivel_plano text; _nivel_final text;
BEGIN
  FOR rec IN SELECT cp.aluno_id, cp.saldo FROM public.clube_pontos cp LOOP
    SELECT lower(tipo) INTO _plano_tipo FROM planos
    WHERE aluno_id = rec.aluno_id AND ativo = true ORDER BY created_at DESC LIMIT 1;
    _plano_tipo := COALESCE(_plano_tipo, 'start');
    _is_ag := (_plano_tipo LIKE '%wellhub%' OR _plano_tipo LIKE '%gympass%'
      OR _plano_tipo LIKE '%total pass%' OR _plano_tipo LIKE '%totalpass%');
    IF _is_ag THEN
      _nivel_final := 'bronze';
    ELSE
      _nivel_pontos := CASE
        WHEN rec.saldo >= 3000 THEN 'platina'
        WHEN rec.saldo >= 1000 THEN 'diamante'
        WHEN rec.saldo >= 300  THEN 'ouro' ELSE 'prata' END;
      _nivel_plano := CASE
        WHEN _plano_tipo LIKE '%max%'   THEN 'platina'
        WHEN _plano_tipo LIKE '%pro%'   THEN 'diamante'
        WHEN _plano_tipo LIKE '%power%' THEN 'ouro' ELSE 'prata' END;
      _nivel_final := CASE
        WHEN 'platina' IN (_nivel_pontos, _nivel_plano) THEN 'platina'
        WHEN 'diamante' IN (_nivel_pontos, _nivel_plano) THEN 'diamante'
        WHEN 'ouro' IN (_nivel_pontos, _nivel_plano) THEN 'ouro'
        ELSE 'prata' END;
    END IF;
    UPDATE public.clube_pontos SET nivel = _nivel_final WHERE aluno_id = rec.aluno_id;
    INSERT INTO public.clube_fortem_membros (aluno_id, nivel_membro, status_membro)
    VALUES (rec.aluno_id, _nivel_final::public.clube_nivel_membro, 'ativo')
    ON CONFLICT (aluno_id) DO UPDATE SET nivel_membro = _nivel_final::public.clube_nivel_membro, updated_at = now();
  END LOOP;
END;
$$;
