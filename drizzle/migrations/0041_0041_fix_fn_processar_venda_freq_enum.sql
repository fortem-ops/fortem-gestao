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
  _valor_plano numeric;
  _freq_sem smallint;
BEGIN
  IF NEW.status_pagamento = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'plano' THEN
    SELECT * INTO _cat_plano FROM public.planos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_plano IS NULL THEN RAISE EXCEPTION 'Plano de catálogo não encontrado'; END IF;

    _valor_plano := COALESCE(NEW.valor_final, NEW.valor, _cat_plano.valor);

    IF NEW.plano_id IS NULL THEN
      INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade)
      VALUES (NEW.aluno_id, _cat_plano.nome, NEW.data_venda, _cat_plano.periodo_meses, _valor_plano, true, ARRAY[]::text[], _cat_plano.atividade)
      RETURNING id INTO _novo_plano_id;

      NEW.plano_id := _novo_plano_id;
    END IF;

    _qtd := COALESCE(_cat_plano.quantidade_creditos, 0);
    _ilim := _cat_plano.ilimitado;

    SELECT id INTO _credito_id
    FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id
      AND atividade = 'Treino'
      AND origem_tipo = 'plano'
      AND origem_id = NEW.id
      AND ativo = true
    LIMIT 1;

    IF _credito_id IS NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
      VALUES (NEW.aluno_id, 'plano', NEW.id, 'Treino', _qtd, _ilim,
              (NEW.data_venda + (_cat_plano.periodo_meses || ' months')::interval)::date)
      RETURNING id INTO _credito_id;

      IF _credito_id IS NOT NULL THEN
        INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
        VALUES (_credito_id, 'compra', _qtd, NEW.vendedor_id, 'Plano: ' || _cat_plano.nome);
      END IF;
    END IF;

    -- Fonte oficial dos "créditos previstos" do contrato: o pacote realmente vendido.
    -- O gatilho fn_auto_criar_contrato_ciclo cria o contrato com frequência do cadastro x 4;
    -- aqui o valor é sobrescrito pelo que consta no catálogo da venda.
    IF COALESCE(_cat_plano.atividade, '') <> 'corrida' AND NEW.plano_id IS NOT NULL THEN
      _freq_sem := CASE
        WHEN COALESCE(_cat_plano.frequencia::text, '') = 'livre' THEN 5
        WHEN COALESCE(_cat_plano.frequencia::text, '') ~ '^[0-9]+x?$'
          THEN COALESCE(NULLIF(regexp_replace(_cat_plano.frequencia::text, '\D', '', 'g'), '')::smallint, 1)
        ELSE NULL
      END;
      IF _freq_sem IS NOT NULL AND _freq_sem NOT IN (1,2,3,5) THEN _freq_sem := NULL; END IF;

      UPDATE public.contratos
      SET creditos_total = _qtd,
          frequencia_semanal = COALESCE(_freq_sem, frequencia_semanal)
      WHERE plano_id = NEW.plano_id;

      UPDATE public.ciclos_credito
      SET creditos_liberados = _qtd
      WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = NEW.plano_id);
    END IF;

  ELSIF NEW.tipo = 'servico' THEN
    SELECT * INTO _cat_serv FROM public.servicos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_serv IS NULL THEN RAISE EXCEPTION 'Serviço de catálogo não encontrado'; END IF;

    SELECT id INTO _credito_id
    FROM public.creditos_aluno
    WHERE aluno_id = NEW.aluno_id
      AND atividade = _cat_serv.atividade
      AND origem_tipo = 'servico'
      AND origem_id = NEW.id
      AND ativo = true
    LIMIT 1;

    IF _credito_id IS NULL THEN
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado)
      VALUES (NEW.aluno_id, 'servico', NEW.id, _cat_serv.atividade, _cat_serv.quantidade_sessoes, false)
      RETURNING id INTO _credito_id;

      IF _credito_id IS NOT NULL THEN
        INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
        VALUES (_credito_id, 'compra', _cat_serv.quantidade_sessoes, NEW.vendedor_id, 'Serviço: ' || _cat_serv.nome);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;