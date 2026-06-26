CREATE OR REPLACE FUNCTION public.fn_processar_venda()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cat_plano record;
  _cat_serv record;
  _novo_plano_id uuid;
  _credito_id uuid;
  _qtd int;
  _ilim bool;
BEGIN
  IF NEW.status_pagamento = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'plano' THEN
    SELECT * INTO _cat_plano FROM public.planos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_plano IS NULL THEN RAISE EXCEPTION 'Plano de catálogo não encontrado'; END IF;

    -- Não desativa planos anteriores aqui. O frontend decide com base no
    -- seletor "Renovação / Novo contrato / Substituir".
    INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos)
    VALUES (NEW.aluno_id, _cat_plano.nome, NEW.data_venda, _cat_plano.periodo_meses, _cat_plano.valor, true, ARRAY[]::text[])
    RETURNING id INTO _novo_plano_id;

    NEW.plano_id := _novo_plano_id;

    _qtd := COALESCE(_cat_plano.quantidade_creditos, 0);
    _ilim := _cat_plano.ilimitado;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
    VALUES (NEW.aluno_id, 'plano', NEW.id, 'Treino', _qtd, _ilim,
            (NEW.data_venda + (_cat_plano.periodo_meses || ' months')::interval)::date)
    RETURNING id INTO _credito_id;

    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (_credito_id, 'compra', _qtd, NEW.vendedor_id, 'Plano: ' || _cat_plano.nome);

    -- Bônus Start+ removido: a etapa "Serviços do Plano" no frontend já cria
    -- os créditos de Avaliação Funcional / Nutrição / Reabilitação.

  ELSIF NEW.tipo = 'servico' THEN
    SELECT * INTO _cat_serv FROM public.servicos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_serv IS NULL THEN RAISE EXCEPTION 'Serviço de catálogo não encontrado'; END IF;

    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado)
    VALUES (NEW.aluno_id, 'servico', NEW.id, _cat_serv.atividade, _cat_serv.quantidade_sessoes, false)
    RETURNING id INTO _credito_id;

    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (_credito_id, 'compra', _cat_serv.quantidade_sessoes, NEW.vendedor_id, 'Serviço: ' || _cat_serv.nome);
  END IF;

  RETURN NEW;
END $function$;