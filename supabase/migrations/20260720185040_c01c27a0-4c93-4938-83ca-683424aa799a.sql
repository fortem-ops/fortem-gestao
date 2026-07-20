ALTER TABLE public.clube_recompensas
  ADD COLUMN IF NOT EXISTS custo_start       integer,
  ADD COLUMN IF NOT EXISTS custo_start_plus  integer,
  ADD COLUMN IF NOT EXISTS custo_power       integer,
  ADD COLUMN IF NOT EXISTS custo_pro         integer,
  ADD COLUMN IF NOT EXISTS custo_max         integer,
  ADD COLUMN IF NOT EXISTS planos_elegiveis  text[] DEFAULT ARRAY['start','start_plus','power','pro','max'];

UPDATE public.clube_recompensas SET
  custo_start      = COALESCE(custo_start, custo_pontos),
  custo_start_plus = COALESCE(custo_start_plus, ROUND(custo_pontos * 0.9)),
  custo_power      = COALESCE(custo_power, ROUND(custo_pontos * 0.75)),
  custo_pro        = COALESCE(custo_pro, ROUND(custo_pontos * 0.60)),
  custo_max        = COALESCE(custo_max, ROUND(custo_pontos * 0.40));

CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(
  p_recompensa_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _aluno_id     uuid;
  _recompensa   clube_recompensas%ROWTYPE;
  _pontos       clube_pontos%ROWTYPE;
  _plano_tipo   text;
  _custo_final  integer;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  END IF;

  SELECT * INTO _recompensa FROM clube_recompensas WHERE id = p_recompensa_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'recompensa_invalida');
  END IF;

  SELECT lower(tipo) INTO _plano_tipo
  FROM planos
  WHERE aluno_id = _aluno_id AND ativo = true
  ORDER BY created_at DESC LIMIT 1;

  _plano_tipo := REPLACE(LOWER(COALESCE(_plano_tipo, 'start')), '+', '_plus');
  _plano_tipo := REPLACE(_plano_tipo, ' ', '_');

  IF _recompensa.planos_elegiveis IS NOT NULL
     AND array_length(_recompensa.planos_elegiveis, 1) > 0
     AND NOT (_plano_tipo = ANY(_recompensa.planos_elegiveis)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'plano_nao_elegivel', 'plano', _plano_tipo);
  END IF;

  _custo_final := CASE _plano_tipo
    WHEN 'max'        THEN COALESCE(_recompensa.custo_max,       _recompensa.custo_pontos)
    WHEN 'pro'        THEN COALESCE(_recompensa.custo_pro,       _recompensa.custo_pontos)
    WHEN 'power'      THEN COALESCE(_recompensa.custo_power,     _recompensa.custo_pontos)
    WHEN 'start_plus' THEN COALESCE(_recompensa.custo_start_plus,_recompensa.custo_pontos)
    ELSE                   COALESCE(_recompensa.custo_start,     _recompensa.custo_pontos)
  END;

  SELECT * INTO _pontos FROM clube_pontos WHERE aluno_id = _aluno_id;
  IF NOT FOUND OR _pontos.saldo < _custo_final THEN
    RETURN jsonb_build_object(
      'ok', false, 'erro', 'saldo_insuficiente',
      'saldo', COALESCE(_pontos.saldo, 0),
      'custo', _custo_final
    );
  END IF;

  UPDATE clube_pontos SET
    saldo            = saldo - _custo_final,
    total_resgatado  = total_resgatado + _custo_final,
    updated_at       = now()
  WHERE aluno_id = _aluno_id;

  INSERT INTO clube_resgates (aluno_id, recompensa_id, pontos_utilizados, status)
  VALUES (
    _aluno_id, p_recompensa_id, _custo_final,
    CASE WHEN _recompensa.tipo = 'automatico' THEN 'aprovado' ELSE 'pendente' END
  );

  INSERT INTO clube_historico (aluno_id, acao, label, pontos, pontos_final)
  VALUES (_aluno_id, 'resgate', 'Resgate: ' || _recompensa.nome, -_custo_final, -_custo_final);

  RETURN jsonb_build_object(
    'ok',     true,
    'tipo',   _recompensa.tipo,
    'recompensa', _recompensa.nome,
    'custo',  _custo_final,
    'plano',  _plano_tipo
  );
END;
$$;