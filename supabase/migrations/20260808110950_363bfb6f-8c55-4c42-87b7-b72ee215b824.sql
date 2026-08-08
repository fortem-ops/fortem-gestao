CREATE OR REPLACE FUNCTION public.fn_agendar_servico(
  _aluno_id uuid,
  _servico_catalogo_id uuid,
  _data_hora timestamp with time zone,
  _profissional_id uuid DEFAULT NULL::uuid,
  _observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plano public.planos%ROWTYPE;
  _servico public.servicos_catalogo%ROWTYPE;
  _credito public.creditos_aluno%ROWTYPE;
  _agenda public.agenda_servicos%ROWTYPE;
  _consumo public.consumo_servicos%ROWTYPE;
  _saldo integer;
  _servicos_incluidos jsonb;
  _qtd_incluida integer;
  _fim timestamp with time zone;
BEGIN
  -- Busca o plano ativo de treinamento funcional do aluno
  SELECT * INTO _plano
  FROM public.planos
  WHERE aluno_id = _aluno_id
    AND ativo = true
    AND atividade = 'treinamento_funcional'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Busca o serviço do catálogo
  SELECT * INTO _servico
  FROM public.servicos_catalogo
  WHERE id = _servico_catalogo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'servico_nao_encontrado');
  END IF;

  -- Calcula fim com base na duração padrão do serviço
  _fim := _data_hora + COALESCE(_servico.duracao_minutos, 60) * interval '1 minute';

  -- Verifica crédito no plano
  IF FOUND THEN
    _servicos_incluidos := COALESCE(_plano.servicos_incluidos, '[]'::jsonb);

    SELECT (elem->>'quantidade')::int
    INTO _qtd_incluida
    FROM jsonb_array_elements(_servicos_incluidos) AS elem
    WHERE (elem->>'servico_catalogo_id')::uuid = _servico_catalogo_id;

    IF _qtd_incluida IS NOT NULL AND _qtd_incluida > 0 THEN
      -- Verifica saldo real de créditos desse serviço
      SELECT * INTO _credito
      FROM public.creditos_aluno
      WHERE aluno_id = _aluno_id
        AND servico_catalogo_id = _servico_catalogo_id
        AND plano_id = _plano.id
        AND status = 'ativo'
      ORDER BY created_at DESC
      LIMIT 1;

      IF FOUND THEN
        _saldo := COALESCE(_credito.saldo, 0);
      ELSE
        -- Cria o crédito com a quantidade incluída no plano
        INSERT INTO public.creditos_aluno (
          aluno_id,
          plano_id,
          servico_catalogo_id,
          saldo,
          status
        ) VALUES (
          _aluno_id,
          _plano.id,
          _servico_catalogo_id,
          _qtd_incluida,
          'ativo'
        )
        RETURNING * INTO _credito;

        _saldo := _qtd_incluida;
      END IF;

      IF _saldo <= 0 THEN
        RETURN jsonb_build_object('sucesso', false, 'erro', 'sem_creditos', 'detalhe', 'Créditos do plano esgotados para este serviço');
      END IF;
    ELSE
      RETURN jsonb_build_object('sucesso', false, 'erro', 'sem_creditos', 'detalhe', 'Plano ativo não inclui este serviço');
    END IF;
  ELSE
    RETURN jsonb_build_object('sucesso', false, 'erro', 'sem_creditos', 'detalhe', 'Nenhum plano ativo de treinamento funcional encontrado');
  END IF;

  -- Cria o agendamento
  INSERT INTO public.agenda_servicos (
    aluno_id,
    servico_catalogo_id,
    profissional_id,
    data_hora,
    fim,
    observacoes,
    status,
    origem
  ) VALUES (
    _aluno_id,
    _servico_catalogo_id,
    _profissional_id,
    _data_hora,
    _fim,
    _observacoes,
    'agendado',
    'portal'
  )
  RETURNING * INTO _agenda;

  -- Consome o crédito
  UPDATE public.creditos_aluno
  SET saldo = saldo - 1,
      updated_at = now()
  WHERE id = _credito.id
  RETURNING * INTO _credito;

  -- Registra o consumo
  INSERT INTO public.consumo_servicos (
    aluno_id,
    plano_id,
    servico_catalogo_id,
    agenda_servico_id,
    quantidade
  ) VALUES (
    _aluno_id,
    _plano.id,
    _servico_catalogo_id,
    _agenda.id,
    1
  )
  RETURNING * INTO _consumo;

  RETURN jsonb_build_object(
    'sucesso', true,
    'agenda_id', _agenda.id,
    'credito_id', _credito.id,
    'saldo_restante', _credito.saldo
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'erro_interno', 'detalhe', SQLERRM);
END;
$$;