CREATE OR REPLACE FUNCTION public.fn_clube_adicionar_pontos(p_aluno_id uuid, p_acao text, p_referencia_id uuid DEFAULT NULL::uuid, p_referencia_tipo text DEFAULT NULL::text, p_motivo_manual text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid, p_pontos_manual integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _regra clube_regras_pontuacao%ROWTYPE; _clima clube_clima_cache%ROWTYPE;
  _config_mult text; _multiplicador numeric(3,2) := 1.0;
  _pontos_base integer; _pontos_final integer; _saldo_atual integer;
  _validade_meses integer; _plano_tipo text; _is_agregador boolean; _nivel_novo text;
  _saldo_projetado integer; _nivel_pontos text; _nivel_plano text;
BEGIN
  SELECT * INTO _regra FROM clube_regras_pontuacao WHERE acao = p_acao AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'regra_nao_encontrada'); END IF;
  _pontos_base := COALESCE(p_pontos_manual, _regra.pontos);
  IF _regra.unica_vez THEN
    IF EXISTS (SELECT 1 FROM clube_historico WHERE aluno_id = p_aluno_id AND acao = p_acao) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'acao_ja_realizada');
    END IF;
  END IF;

  SELECT lower((public.fn_plano_principal_ativo(p_aluno_id)).tipo) INTO _plano_tipo;
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

  IF _is_agregador THEN
    _nivel_novo := 'bronze';
  ELSE
    SELECT COALESCE(saldo, 0) INTO _saldo_projetado FROM clube_pontos WHERE aluno_id = p_aluno_id;
    _saldo_projetado := COALESCE(_saldo_projetado, 0) + _pontos_final;
    _nivel_pontos := CASE
      WHEN _saldo_projetado >= 3000 THEN 'platina'
      WHEN _saldo_projetado >= 1000 THEN 'diamante'
      WHEN _saldo_projetado >= 300  THEN 'ouro'
      ELSE 'prata' END;
    _nivel_plano := CASE
      WHEN _plano_tipo LIKE '%max%'   THEN 'platina'
      WHEN _plano_tipo LIKE '%pro%'   THEN 'diamante'
      WHEN _plano_tipo LIKE '%power%' THEN 'ouro'
      ELSE 'prata' END;
    _nivel_novo := CASE
      WHEN 'platina' IN (_nivel_pontos, _nivel_plano) THEN 'platina'
      WHEN 'diamante' IN (_nivel_pontos, _nivel_plano) THEN 'diamante'
      WHEN 'ouro' IN (_nivel_pontos, _nivel_plano) THEN 'ouro'
      ELSE 'prata' END;
  END IF;

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
END;
$function$;