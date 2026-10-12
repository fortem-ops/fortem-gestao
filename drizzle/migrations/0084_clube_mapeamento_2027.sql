CREATE OR REPLACE FUNCTION public.fn_clube_nivel_por_plano(_aluno_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _plano public.planos;
  _tipo_l text;
  _nivel_cat text;
  _nivel public.clube_nivel_membro;
BEGIN
  _plano := public.fn_plano_principal_ativo(_aluno_id);
  IF _plano.id IS NULL OR _plano.tipo IS NULL THEN
    RETURN jsonb_build_object('nivel', 'bronze', 'status', 'ativo');
  END IF;

  IF _plano.catalogo_id IS NOT NULL THEN
    SELECT nivel_clube INTO _nivel_cat FROM public.planos_catalogo WHERE id = _plano.catalogo_id;
    IF _nivel_cat IS NOT NULL THEN
      RETURN jsonb_build_object('nivel', _nivel_cat, 'status', 'ativo');
    END IF;
  END IF;

  _tipo_l := lower(_plano.tipo);
  IF _tipo_l LIKE '%wellhub%' OR _tipo_l LIKE '%gympass%'
     OR _tipo_l LIKE '%total pass%' OR _tipo_l LIKE '%totalpass%' THEN
    RETURN jsonb_build_object('nivel', 'bronze', 'status', 'ativo');
  END IF;

  _nivel := CASE
    WHEN _tipo_l LIKE '%max%'   THEN 'platina'::public.clube_nivel_membro
    WHEN _tipo_l LIKE '%pro%'   THEN 'diamante'::public.clube_nivel_membro
    WHEN _tipo_l LIKE '%power%' THEN 'ouro'::public.clube_nivel_membro
    ELSE 'prata'::public.clube_nivel_membro
  END;
  RETURN jsonb_build_object('nivel', _nivel, 'status', 'ativo');
END
$function$;

CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(p_recompensa_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _aluno_id uuid; _recompensa clube_recompensas%ROWTYPE;
  _pontos clube_pontos%ROWTYPE; _plano_tipo text; _plano public.planos; _familia text;
  _custo_final integer; _is_agregador boolean;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); END IF;

  SELECT * INTO _recompensa FROM clube_recompensas WHERE id = p_recompensa_id AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'recompensa_invalida'); END IF;

  _plano := public.fn_plano_principal_ativo(_aluno_id);
  IF _plano.catalogo_id IS NOT NULL THEN
    SELECT familia INTO _familia FROM public.planos_catalogo WHERE id = _plano.catalogo_id;
  END IF;

  IF _familia IS NOT NULL THEN
    _plano_tipo := _familia;   -- start_2027 | power_2027 | pro_2027
  ELSE
    _plano_tipo := REPLACE(LOWER(COALESCE(_plano.tipo, 'start')), '+', '_plus');
    _plano_tipo := REPLACE(_plano_tipo, ' ', '_');
  END IF;

  _is_agregador := (_plano_tipo LIKE '%wellhub%' OR _plano_tipo LIKE '%gympass%'
    OR _plano_tipo LIKE '%total_pass%' OR _plano_tipo LIKE '%totalpass%');

  IF NOT _is_agregador AND _recompensa.planos_elegiveis IS NOT NULL
     AND array_length(_recompensa.planos_elegiveis, 1) > 0
     AND NOT (_plano_tipo = ANY(_recompensa.planos_elegiveis)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'plano_nao_elegivel');
  END IF;

  _custo_final := CASE
    WHEN _is_agregador THEN COALESCE(_recompensa.custo_agregador, ROUND(COALESCE(_recompensa.custo_start, _recompensa.custo_pontos) * 1.3))
    WHEN _plano_tipo = 'pro_2027'   THEN COALESCE(_recompensa.custo_pro, _recompensa.custo_pontos)
    WHEN _plano_tipo = 'power_2027' THEN COALESCE(_recompensa.custo_power, _recompensa.custo_pontos)
    WHEN _plano_tipo = 'start_2027' THEN COALESCE(_recompensa.custo_start, _recompensa.custo_pontos)
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
END; $function$;