-- LOTE 3: Clube sem níveis, multiplicador por plano, semanas seguidas.
-- Colunas planos_catalogo.nivel_clube, clube_fortem_membros.nivel_membro e clube_pontos.nivel ficam sem uso (não apagadas).
COMMENT ON COLUMN public.planos_catalogo.nivel_clube IS 'DEPRECATED: Clube sem níveis (lote 3); multiplicador vem de clube_config mult_plano_*';
COMMENT ON COLUMN public.clube_fortem_membros.nivel_membro IS 'DEPRECATED: Clube sem níveis (lote 3); usar fn_clube_plano_info';
COMMENT ON COLUMN public.clube_pontos.nivel IS 'DEPRECATED: Clube sem níveis (lote 3)';

CREATE OR REPLACE FUNCTION public.fn_clube_plano_info(p_aluno_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _plano public.planos;
  _familia text; _freq text; _tipo text; _chave text; _rotulo text;
  _mult numeric; _meta int; _freq_aluno int;
BEGIN
  _plano := public.fn_plano_principal_ativo(p_aluno_id);
  IF _plano.catalogo_id IS NOT NULL THEN
    SELECT familia, frequencia::text INTO _familia, _freq FROM public.planos_catalogo WHERE id = _plano.catalogo_id;
  END IF;
  _tipo := lower(coalesce(_plano.tipo, ''));

  IF _tipo ~ '(wellhub|gympass|total\s*pass|totalpass)' THEN
    _chave := 'agregador';
    _rotulo := CASE WHEN _tipo ~ 'total' THEN 'Total Pass' ELSE 'Wellhub' END;
  ELSIF coalesce(_familia, '') LIKE 'consultoria%' OR _tipo LIKE '%consultoria%' THEN
    _chave := 'consultoria'; _rotulo := 'Consultoria Online';
  ELSIF coalesce(_familia, '') LIKE 'pro%' THEN _chave := 'pro';
  ELSIF coalesce(_familia, '') LIKE 'power%' THEN _chave := 'power';
  ELSIF coalesce(_familia, '') LIKE 'start%' THEN _chave := 'start';
  ELSIF _tipo ~ '(^|[^a-z])(pro|vip|max)([^a-z]|$)' THEN _chave := 'pro';
  ELSIF _tipo ~ '(^|[^a-z])power([^a-z]|$)' THEN _chave := 'power';
  ELSE _chave := 'start';
  END IF;

  IF _rotulo IS NULL THEN
    _rotulo := CASE _chave WHEN 'pro' THEN 'Pro' WHEN 'power' THEN 'Power' ELSE 'Start' END;
  END IF;

  SELECT valor::numeric INTO _mult FROM public.clube_config
   WHERE chave = CASE _chave WHEN 'agregador' THEN 'mult_agregador' ELSE 'mult_plano_' || _chave END;
  _mult := coalesce(_mult, CASE WHEN _chave = 'agregador' THEN 0.5 ELSE 1 END);

  IF _freq IS NOT NULL THEN
    _meta := CASE WHEN _freq = 'livre' THEN 3 ELSE nullif(regexp_replace(_freq, '\D', '', 'g'), '')::int END;
  ELSE
    SELECT frequencia_semanal INTO _freq_aluno FROM public.alunos WHERE id = p_aluno_id;
    _meta := CASE WHEN _freq_aluno IS NULL OR _freq_aluno <= 0 THEN 1 WHEN _freq_aluno >= 5 THEN 3 ELSE least(_freq_aluno, 3) END;
  END IF;

  RETURN jsonb_build_object('chave', _chave, 'plano', _rotulo, 'multiplicador', _mult,
    'agregador', _chave = 'agregador', 'meta_semanal', coalesce(_meta, 1),
    'tem_plano', _plano.id IS NOT NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_clube_semanas_seguidas(p_aluno_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _info jsonb; _meta int; _semana date; _n int := 0; _qtd int;
  _hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  _info := public.fn_clube_plano_info(p_aluno_id);
  IF _info->>'chave' = 'consultoria' THEN RETURN 0; END IF;
  _meta := greatest(1, (_info->>'meta_semanal')::int);
  _semana := date_trunc('week', _hoje)::date - 7;
  LOOP
    SELECT count(*) INTO _qtd FROM public.treino_agendamentos
     WHERE aluno_id = p_aluno_id AND status = 'realizado'
       AND data >= _semana AND data < _semana + 7;
    EXIT WHEN _qtd < _meta;
    _n := _n + 1;
    _semana := _semana - 7;
    EXIT WHEN _n >= 520;
  END LOOP;
  RETURN _n;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_clube_meu_plano()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _aluno uuid := public.fn_current_aluno_id();
BEGIN
  IF _aluno IS NULL THEN RETURN NULL; END IF;
  RETURN public.fn_clube_plano_info(_aluno)
    || jsonb_build_object('semanas_seguidas', public.fn_clube_semanas_seguidas(_aluno));
END $function$;

REVOKE ALL ON FUNCTION public.fn_clube_plano_info(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_clube_semanas_seguidas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_clube_plano_info(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_clube_semanas_seguidas(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fn_clube_meu_plano() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_clube_meu_plano() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_clube_adicionar_pontos(p_aluno_id uuid, p_acao text, p_referencia_id uuid DEFAULT NULL::uuid, p_referencia_tipo text DEFAULT NULL::text, p_motivo_manual text DEFAULT NULL::text, p_created_by uuid DEFAULT NULL::uuid, p_pontos_manual integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _regra clube_regras_pontuacao%ROWTYPE; _clima clube_clima_cache%ROWTYPE;
  _config_mult text; _mult_clima numeric := 1.0; _mult_plano numeric := 1.0;
  _multiplicador numeric(4,2) := 1.0; _info jsonb;
  _pontos_base integer; _pontos_final integer; _saldo_atual integer;
  _validade_meses integer; _is_agregador boolean;
BEGIN
  SELECT * INTO _regra FROM clube_regras_pontuacao WHERE acao = p_acao AND ativo = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'regra_nao_encontrada'); END IF;
  _pontos_base := COALESCE(p_pontos_manual, _regra.pontos);
  IF _regra.unica_vez THEN
    IF EXISTS (SELECT 1 FROM clube_historico WHERE aluno_id = p_aluno_id AND acao = p_acao) THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'acao_ja_realizada');
    END IF;
  END IF;

  _info := public.fn_clube_plano_info(p_aluno_id);
  _is_agregador := COALESCE((_info->>'agregador')::boolean, false);
  _mult_plano := COALESCE((_info->>'multiplicador')::numeric, 1.0);

  IF NOT _is_agregador THEN
    SELECT * INTO _clima FROM clube_clima_cache WHERE data = CURRENT_DATE;
    IF FOUND AND _clima.multiplicador_ativo AND p_acao = 'treino_realizado' THEN
      SELECT valor INTO _config_mult FROM clube_config WHERE chave = 'clima_multiplicador';
      _mult_clima := COALESCE(_config_mult::numeric, 1.5);
    END IF;
  END IF;

  -- Agregador: só o multiplicador do agregador (sem clima). Demais: plano x clima.
  _multiplicador := CASE WHEN _is_agregador THEN _mult_plano ELSE _mult_plano * _mult_clima END;
  IF p_pontos_manual IS NOT NULL THEN _multiplicador := 1.0; END IF;
  _pontos_final := ROUND(_pontos_base * _multiplicador);

  SELECT valor::integer INTO _validade_meses FROM clube_config WHERE chave = 'pontos_validade_meses';
  _validade_meses := COALESCE(_validade_meses, 12);

  INSERT INTO clube_pontos (aluno_id, total_acumulado, saldo, ultima_movimentacao, pontos_expiram_em)
  VALUES (p_aluno_id, _pontos_final, _pontos_final,
    now(), now() + (_validade_meses || ' months')::interval)
  ON CONFLICT (aluno_id) DO UPDATE SET
    total_acumulado = clube_pontos.total_acumulado + _pontos_final,
    saldo = clube_pontos.saldo + _pontos_final,
    ultima_movimentacao = now(),
    pontos_expiram_em = now() + (_validade_meses || ' months')::interval,
    updated_at = now()
  RETURNING saldo INTO _saldo_atual;

  INSERT INTO clube_historico (aluno_id, acao, label, pontos, multiplicador, pontos_final,
    multiplicador_clima, motivo_manual, referencia_id, referencia_tipo, created_by)
  VALUES (p_aluno_id, p_acao, _regra.label, _pontos_base, _multiplicador, _pontos_final,
    (_mult_clima > 1.0 AND NOT _is_agregador),
    CASE WHEN _is_agregador THEN 'Agregador (50% dos pontos)' ELSE p_motivo_manual END,
    p_referencia_id, p_referencia_tipo, p_created_by);

  RETURN jsonb_build_object('ok', true, 'pontos_adicionados', _pontos_final,
    'multiplicador', _multiplicador, 'multiplicador_plano', _mult_plano,
    'multiplicador_clima', (_mult_clima > 1.0 AND NOT _is_agregador),
    'plano', _info->>'plano',
    'is_agregador', _is_agregador, 'saldo_atual', _saldo_atual);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_clube_resgatar(p_recompensa_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    _plano_tipo := _familia;
  ELSE
    _plano_tipo := REPLACE(LOWER(COALESCE(_plano.tipo, 'start')), '+', '_plus');
    _plano_tipo := REPLACE(_plano_tipo, ' ', '_');
  END IF;

  _is_agregador := COALESCE((public.fn_clube_plano_info(_aluno_id)->>'agregador')::boolean, false);

  IF NOT _is_agregador AND _recompensa.planos_elegiveis IS NOT NULL
     AND array_length(_recompensa.planos_elegiveis, 1) > 0
     AND NOT (_plano_tipo = ANY(_recompensa.planos_elegiveis)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'plano_nao_elegivel');
  END IF;

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

CREATE OR REPLACE FUNCTION public.fn_sync_nivel_membro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Clube sem níveis (lote 3): nada a sincronizar.
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_clube_nivel_por_plano(_aluno_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _info jsonb;
BEGIN
  _info := public.fn_clube_plano_info(_aluno_id);
  RETURN jsonb_build_object('plano', _info->>'plano', 'chave', _info->>'chave', 'status', 'ativo');
END
$function$;

CREATE OR REPLACE FUNCTION public.fn_clube_sync_membro(_aluno_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _info jsonb;
  _status public.clube_status_membro;
  _existing record;
  _placeholder_hash text;
BEGIN
  _info := public.fn_clube_nivel_por_plano(_aluno_id);
  _status := (_info->>'status')::public.clube_status_membro;

  SELECT * INTO _existing FROM public.clube_fortem_membros WHERE aluno_id = _aluno_id;

  IF _existing IS NULL THEN
    _placeholder_hash := encode(extensions.digest('aluno:' || _aluno_id::text, 'sha256'), 'hex');
    INSERT INTO public.clube_fortem_membros (aluno_id, cpf_hash, status_membro, fortem_id)
    VALUES (_aluno_id, _placeholder_hash, _status, '');
  ELSE
    IF _existing.status_membro = 'cancelado' THEN
      RETURN;
    END IF;
    UPDATE public.clube_fortem_membros
    SET status_membro = _status,
        updated_at = now()
    WHERE id = _existing.id;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.fn_clube_check_divergencias()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r record;
  _info jsonb;
  _esperado_status public.clube_status_membro;
  _divergencias int := 0;
BEGIN
  FOR _r IN
    SELECT m.aluno_id, m.status_membro, a.nome
    FROM public.clube_fortem_membros m
    JOIN public.alunos a ON a.id = m.aluno_id
    WHERE m.status_membro <> 'cancelado'
  LOOP
    _info := public.fn_clube_nivel_por_plano(_r.aluno_id);
    _esperado_status := (_info->>'status')::public.clube_status_membro;

    IF _r.status_membro <> _esperado_status
       AND _r.status_membro NOT IN ('inadimplente','bloqueado') THEN
      INSERT INTO public.clube_alertas (tipo, severidade, mensagem, payload, aluno_id)
      VALUES (
        'divergencia_nivel',
        'aviso',
        'Divergência entre plano e status do Clube para ' || _r.nome,
        jsonb_build_object(
          'aluno_id', _r.aluno_id,
          'aluno_nome', _r.nome,
          'plano', _info->>'plano',
          'status_atual', _r.status_membro,
          'status_esperado', _esperado_status
        ),
        _r.aluno_id
      );
      _divergencias := _divergencias + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('divergencias', _divergencias, 'verificado_em', now());
END $function$;

CREATE OR REPLACE FUNCTION public.fn_clube_validar_token(_token text, _beneficio_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _parts text[];
  _payload_b64 text;
  _signature text;
  _payload_json jsonb;
  _payload_text text;
  _aluno_id uuid;
  _cpf_hash text;
  _exp bigint;
  _membro record;
  _beneficio record;
  _expected_sig text;
  _aluno record;
  _used_count int;
  _vigencia_inicio timestamptz;
  _vigencia_fim timestamptz;
  _regra record;
  _motivo text;
  _status public.uso_status_validacao := 'valido';
  _plano_ativo boolean;
  _dias_matricula int;
BEGIN
  _parts := string_to_array(_token, '.');
  IF array_length(_parts, 1) <> 2 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Token malformado');
  END IF;
  _payload_b64 := _parts[1];
  _signature := _parts[2];

  BEGIN
    _payload_text := convert_from(decode(translate(_payload_b64, '-_', '+/') || repeat('=', (4 - length(_payload_b64) % 4) % 4), 'base64'), 'UTF8');
    _payload_json := _payload_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Payload inválido');
  END;

  _aluno_id := (_payload_json->>'aluno_id')::uuid;
  _cpf_hash := _payload_json->>'cpf_hash';
  _exp := (_payload_json->>'exp')::bigint;

  SELECT * INTO _membro FROM public.clube_fortem_membros WHERE aluno_id = _aluno_id AND cpf_hash = _cpf_hash;
  IF _membro IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Membro não encontrado');
  END IF;

  _expected_sig := translate(encode(extensions.hmac(_payload_b64, _membro.qr_secret, 'sha256'), 'base64'), E'+/=\n', '-_');
  IF _expected_sig <> _signature THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Assinatura inválida');
  END IF;

  IF to_timestamp(_exp) < now() THEN
    INSERT INTO public.uso_beneficios (aluno_id, cpf_hash, beneficio_id, parceiro_id, validado_por, status_validacao, motivo_recusa, token_validacao, origem_validacao)
      SELECT _aluno_id, _cpf_hash, _beneficio_id, b.parceiro_id, auth.uid(), 'expirado', 'Token expirado', _token, 'scanner'
      FROM public.beneficios b WHERE b.id = _beneficio_id;
    RETURN jsonb_build_object('ok', false, 'motivo', 'Token expirado');
  END IF;

  SELECT * INTO _beneficio FROM public.beneficios WHERE id = _beneficio_id;
  IF _beneficio IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Benefício não encontrado');
  END IF;

  SELECT * INTO _aluno FROM public.alunos WHERE id = _aluno_id;

  IF _membro.status_membro <> 'ativo' THEN
    _status := 'bloqueado';
    _motivo := 'Membro ' || _membro.status_membro;
  ELSIF NOT _beneficio.ativo THEN
    _status := 'recusado';
    _motivo := 'Benefício inativo';
  ELSIF _beneficio.data_inicio > CURRENT_DATE OR (_beneficio.data_fim IS NOT NULL AND _beneficio.data_fim < CURRENT_DATE) THEN
    _status := 'recusado';
    _motivo := 'Benefício fora do período de vigência';
  ELSIF _beneficio.limite_por_periodo IS NOT NULL THEN
    -- Limite total durante toda a vigência (não renova por período)
    _vigencia_inicio := _beneficio.data_inicio::timestamptz;
    _vigencia_fim := CASE WHEN _beneficio.data_fim IS NOT NULL
                          THEN (_beneficio.data_fim + 1)::timestamptz
                          ELSE NULL END;

    SELECT count(*) INTO _used_count FROM public.uso_beneficios
      WHERE aluno_id = _aluno_id AND beneficio_id = _beneficio_id
        AND status_validacao = 'valido'
        AND created_at >= _vigencia_inicio
        AND (_vigencia_fim IS NULL OR created_at < _vigencia_fim);

    IF _used_count >= _beneficio.limite_por_periodo THEN
      _status := 'recusado';
      _motivo := 'Limite de usos do benefício atingido';
    END IF;
  END IF;

  IF _status = 'valido' THEN
    FOR _regra IN SELECT * FROM public.regras_elegibilidade WHERE beneficio_id = _beneficio_id AND ativo = true LOOP
      IF _regra.tipo_regra = 'plano' THEN
        IF NOT EXISTS (SELECT 1 FROM public.planos WHERE aluno_id = _aluno_id AND ativo = true AND tipo = _regra.valor_regra) THEN
          _status := 'recusado'; _motivo := 'Plano não atende à regra'; EXIT;
        END IF;
      ELSIF _regra.tipo_regra = 'status_financeiro' THEN
        SELECT EXISTS (SELECT 1 FROM public.planos WHERE aluno_id = _aluno_id AND ativo = true) INTO _plano_ativo;
        IF _regra.valor_regra = 'ativo' AND NOT _plano_ativo THEN
          _status := 'recusado'; _motivo := 'Sem plano ativo'; EXIT;
        END IF;
      ELSIF _regra.tipo_regra = 'tempo_matricula' THEN
        _dias_matricula := (CURRENT_DATE - _membro.aluno_desde);
        IF _dias_matricula < _regra.valor_regra::int THEN
          _status := 'recusado'; _motivo := 'Tempo de matrícula insuficiente'; EXIT;
        END IF;
      ELSIF _regra.tipo_regra = 'frequencia_minima' THEN
        IF COALESCE(_aluno.frequencia_semanal, 0) < _regra.valor_regra::int THEN
          _status := 'recusado'; _motivo := 'Frequência semanal abaixo do mínimo'; EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.uso_beneficios (aluno_id, cpf_hash, beneficio_id, parceiro_id, validado_por, status_validacao, motivo_recusa, token_validacao, origem_validacao)
  VALUES (_aluno_id, _cpf_hash, _beneficio_id, _beneficio.parceiro_id, auth.uid(), _status, _motivo, _token, 'scanner');

  IF _status = 'valido' THEN
    UPDATE public.parceiros SET pontuacao_engajamento = pontuacao_engajamento + 1 WHERE id = _beneficio.parceiro_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', _status = 'valido',
    'status', _status,
    'motivo', _motivo,
    'aluno', jsonb_build_object('id', _aluno.id, 'nome', _aluno.nome, 'fortem_id', _membro.fortem_id, 'plano', public.fn_clube_plano_info(_aluno_id)->>'plano'),
    'beneficio', jsonb_build_object('titulo', _beneficio.titulo, 'descricao', _beneficio.descricao)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.fn_clube_generate_qr_token(_aluno_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _membro record;
  _payload text;
  _signature text;
  _token text;
  _expires_at timestamptz;
  _nonce text;
BEGIN
  IF NOT (
    public.is_coordinator_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos WHERE id = _aluno_id AND responsavel_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos WHERE id = _aluno_id AND user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerar QR deste aluno';
  END IF;

  SELECT * INTO _membro FROM public.clube_fortem_membros WHERE aluno_id = _aluno_id;
  IF _membro IS NULL THEN
    RAISE EXCEPTION 'Aluno não é membro do Clube FORTEM';
  END IF;

  _expires_at := now() + interval '30 seconds';
  _nonce := encode(extensions.gen_random_bytes(8), 'hex');
  _payload := encode(
    convert_to(
      jsonb_build_object(
        'aluno_id', _membro.aluno_id,
        'cpf_hash', _membro.cpf_hash,
        'exp', extract(epoch FROM _expires_at)::bigint,
        'nonce', _nonce
      )::text,
      'UTF8'
    ),
    'base64'
  );
  _payload := translate(_payload, E'+/=\n', '-_');
  _signature := translate(encode(extensions.hmac(_payload, _membro.qr_secret, 'sha256'), 'base64'), E'+/=\n', '-_');
  _token := _payload || '.' || _signature;

  UPDATE public.clube_fortem_membros SET ultimo_refresh_qr = now() WHERE id = _membro.id;

  RETURN jsonb_build_object(
    'token', _token,
    'expires_at', _expires_at,
    'fortem_id', _membro.fortem_id,
    'plano', public.fn_clube_plano_info(_aluno_id)->>'plano',
    'status_membro', _membro.status_membro
  );
END $function$;

CREATE OR REPLACE FUNCTION public.fn_lgpd_relatorio_titular(p_aluno_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin_role() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem gerar relatórios LGPD';
  END IF;

  SELECT jsonb_build_object(
    'gerado_em', now(),
    'gerado_por', auth.uid(),
    'aluno_id', p_aluno_id,
    'dados_cadastrais', (SELECT row_to_json(a)::jsonb FROM public.alunos a WHERE a.id = p_aluno_id),
    'avaliacoes', (SELECT jsonb_agg(row_to_json(av)) FROM public.avaliacoes av WHERE av.aluno_id = p_aluno_id),
    'legal_annexes', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', la.id, 'document_type', la.document_type, 'signed_at', la.signed_at,
        'valid_until', la.valid_until, 'medical_status', la.medical_status, 'image_usage', la.image_usage
      )) FROM public.legal_annexes la WHERE la.aluno_id = p_aluno_id
    ),
    'creditos', (SELECT jsonb_agg(row_to_json(ca)) FROM public.creditos_aluno ca WHERE ca.aluno_id = p_aluno_id),
    'consumo_servicos', (SELECT jsonb_agg(row_to_json(cs)) FROM public.consumo_servicos cs WHERE cs.aluno_id = p_aluno_id),
    'clube_membro', (
      SELECT jsonb_build_object(
        'id', cm.id, 'fortem_id', cm.fortem_id, 'plano', public.fn_clube_plano_info(p_aluno_id)->>'plano',
        'status_membro', cm.status_membro, 'data_inicio', cm.data_inicio
      ) FROM public.clube_fortem_membros cm WHERE cm.aluno_id = p_aluno_id
    ),
    'historico_auditoria', (
      SELECT jsonb_agg(jsonb_build_object('tabela', al.tabela, 'operacao', al.operacao, 'created_at', al.created_at))
      FROM public.audit_log al
      WHERE al.registro_id = p_aluno_id::text
         OR al.registro_id IN (
           SELECT id::text FROM public.legal_annexes WHERE aluno_id = p_aluno_id
           UNION ALL SELECT id::text FROM public.creditos_aluno WHERE aluno_id = p_aluno_id
           UNION ALL SELECT id::text FROM public.avaliacoes WHERE aluno_id = p_aluno_id
         )
    )
  ) INTO v_result;

  INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES ('lgpd_relatorio', p_aluno_id::text, 'LGPD_EXPORT', auth.uid(), NULL,
    jsonb_build_object('aluno_id', p_aluno_id, 'gerado_em', now()));

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_treino_agendamento_pontuar_clube()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'realizado' AND (OLD.status IS DISTINCT FROM 'realizado') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clube_historico
      WHERE referencia_id = NEW.id AND referencia_tipo = 'treino_agendamento' AND acao = 'treino_realizado'
    ) THEN
      PERFORM public.fn_clube_adicionar_pontos(NEW.aluno_id, 'treino_realizado', NEW.id, 'treino_agendamento');
    END IF;

    PERFORM public.fn_clube_conceder_badge(NEW.aluno_id, 'Primeiro Passo');

    IF EXISTS (
      SELECT 1 FROM public.clube_clima_cache c
      WHERE c.data = NEW.data AND c.multiplicador_ativo = true
    ) THEN
      PERFORM public.fn_clube_conceder_badge(NEW.aluno_id, 'Guerreiro da Chuva');
    END IF;

    IF public.fn_clube_semanas_seguidas(NEW.aluno_id) >= 8 THEN
      PERFORM public.fn_clube_conceder_badge(NEW.aluno_id, '8 Semanas Seguidas');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
