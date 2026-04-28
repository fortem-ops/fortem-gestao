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
  ELSIF NOT (_membro.nivel_membro = ANY(_beneficio.niveis_permitidos)) THEN
    _status := 'recusado';
    _motivo := 'Nível sem acesso ao benefício';
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
    'aluno', jsonb_build_object('id', _aluno.id, 'nome', _aluno.nome, 'fortem_id', _membro.fortem_id, 'nivel', _membro.nivel_membro),
    'beneficio', jsonb_build_object('titulo', _beneficio.titulo, 'descricao', _beneficio.descricao)
  );
END $function$;