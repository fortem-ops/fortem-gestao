CREATE OR REPLACE FUNCTION public.fn_plano_principal_ativo(p_aluno_id uuid)
RETURNS public.planos
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM public.planos
  WHERE aluno_id = p_aluno_id AND ativo = true AND atividade = 'treinamento_funcional'
  ORDER BY created_at DESC LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_plano_principal_ativo(uuid) TO authenticated, service_role;

-- Refatora, preservando o restante do corpo, as funções que faziam a busca inline
DO $do$
DECLARE
  _f text;
  _src text;
  _new text;
  _pat text := 'SELECT \* INTO _plano\s+FROM public\.planos\s+WHERE aluno_id = ([A-Za-z_\.]+)\s+AND ativo = true\s+ORDER BY created_at DESC\s+LIMIT 1;';
BEGIN
  FOREACH _f IN ARRAY ARRAY['public.fn_agenda_debitar_credito()', 'public.fn_agendar_servico(uuid,date)'] LOOP
    _src := pg_get_functiondef(_f::regprocedure);
    _new := regexp_replace(_src, _pat, 'SELECT * INTO _plano FROM public.fn_plano_principal_ativo(\1);', 'g');
    IF _new = _src THEN
      RAISE EXCEPTION 'Padrão de busca de plano não encontrado em %', _f;
    END IF;
    EXECUTE _new;
  END LOOP;
END
$do$;

-- Clube: nível por plano
CREATE OR REPLACE FUNCTION public.fn_clube_nivel_por_plano(_aluno_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tipo text;
  _tipo_l text;
  _nivel public.clube_nivel_membro;
BEGIN
  SELECT (public.fn_plano_principal_ativo(_aluno_id)).tipo INTO _tipo;

  IF _tipo IS NULL THEN
    RETURN jsonb_build_object('nivel', 'bronze', 'status', 'ativo');
  END IF;

  _tipo_l := lower(_tipo);

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

-- Clube: sincronização de nível do membro
CREATE OR REPLACE FUNCTION public.fn_sync_nivel_membro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _nivel_pontos text; _nivel_plano text; _nivel_final text;
  _plano_tipo text; _is_agregador boolean;
BEGIN
  SELECT lower((public.fn_plano_principal_ativo(NEW.aluno_id)).tipo) INTO _plano_tipo;
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
END; $function$;

-- Clube: pontos
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
END; $function$;

-- Clube: resgate
CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(p_recompensa_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _aluno_id uuid; _recompensa clube_recompensas%ROWTYPE;
  _pontos clube_pontos%ROWTYPE; _plano_tipo text;
  _custo_final integer; _is_agregador boolean;
BEGIN
  _aluno_id := fn_current_aluno_id();
  IF _aluno_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_autenticado'); END IF;

  SELECT * INTO _recompensa FROM clube_recompensas WHERE id = p_recompensa_id AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'recompensa_invalida'); END IF;

  SELECT lower((public.fn_plano_principal_ativo(_aluno_id)).tipo) INTO _plano_tipo;
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
END; $function$;