CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(p_recompensa_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aluno_id uuid; _recompensa clube_recompensas%ROWTYPE;
  _pontos clube_pontos%ROWTYPE;
  _custo_final integer; _is_agregador boolean;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); END IF;

  SELECT * INTO _recompensa FROM clube_recompensas WHERE id = p_recompensa_id AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'recompensa_invalida'); END IF;

  _is_agregador := COALESCE((public.fn_clube_plano_info(_aluno_id)->>'agregador')::boolean, false);

  -- Custo único para Start, Power e Pro; agregador paga 30% a mais.
  _custo_final := CASE
    WHEN _is_agregador THEN COALESCE(_recompensa.custo_agregador, ROUND(COALESCE(_recompensa.custo_start, _recompensa.custo_pontos) * 1.3))
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

COMMENT ON COLUMN public.clube_recompensas.planos_elegiveis IS 'DEPRECATED: todos os planos têm os mesmos benefícios; não é mais usada no resgate';