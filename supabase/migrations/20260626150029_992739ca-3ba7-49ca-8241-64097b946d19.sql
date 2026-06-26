
-- ============================================================
-- 1) LIMPEZA RETROATIVA
-- ============================================================

-- 1a) Créditos cujo origem_id aponta para venda inexistente
DELETE FROM public.creditos_aluno c
WHERE c.origem_tipo = 'plano'
  AND c.origem_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = c.origem_id);

-- 1b) Créditos cujo origem_id aponta para contrato cancelado
DELETE FROM public.creditos_aluno c
WHERE c.origem_tipo = 'plano'
  AND c.origem_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.contratos ct
    WHERE ct.id = c.origem_id AND ct.status = 'cancelado'
  );

-- 1c) Remove contratos cancelados e suas dependências (na ordem das FK RESTRICT)
DELETE FROM public.inadimplencias i
USING public.contratos ct
WHERE i.contrato_id = ct.id AND ct.status = 'cancelado';

DELETE FROM public.ciclos_credito cc
USING public.contratos ct
WHERE cc.contrato_id = ct.id AND ct.status = 'cancelado';

DELETE FROM public.cobrancas co
USING public.contratos ct
WHERE co.contrato_id = ct.id AND ct.status = 'cancelado';

DELETE FROM public.contratos WHERE status = 'cancelado';

-- 1d) Dedup de créditos ativos por (aluno, atividade, origem_tipo, origem_id) — mantém o mais recente
WITH dups AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY aluno_id, atividade, origem_tipo, origem_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.creditos_aluno
  WHERE ativo = true AND origem_id IS NOT NULL
)
DELETE FROM public.creditos_aluno c
USING dups
WHERE c.id = dups.id AND dups.rn > 1;

-- 1e) Desativa planos sem venda associada nem contrato ativo
UPDATE public.planos p
SET ativo = false
WHERE ativo = true
  AND NOT EXISTS (SELECT 1 FROM public.vendas v WHERE v.plano_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.contratos ct WHERE ct.plano_id = p.id AND ct.status <> 'cancelado');

-- ============================================================
-- 2) ÍNDICE ÚNICO PARCIAL — impede duplicidade por venda
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_creditos_unicos_por_venda
ON public.creditos_aluno (aluno_id, atividade, origem_tipo, origem_id)
WHERE ativo = true AND origem_id IS NOT NULL;

-- ============================================================
-- 3) HARDENING — fn_processar_venda idempotente (ON CONFLICT)
-- ============================================================
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

    INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos)
    VALUES (NEW.aluno_id, _cat_plano.nome, NEW.data_venda, _cat_plano.periodo_meses, _cat_plano.valor, true, ARRAY[]::text[])
    RETURNING id INTO _novo_plano_id;

    NEW.plano_id := _novo_plano_id;

    _qtd := COALESCE(_cat_plano.quantidade_creditos, 0);
    _ilim := _cat_plano.ilimitado;

    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
    VALUES (NEW.aluno_id, 'plano', NEW.id, 'Treino', _qtd, _ilim,
            (NEW.data_venda + (_cat_plano.periodo_meses || ' months')::interval)::date)
    ON CONFLICT (aluno_id, atividade, origem_tipo, origem_id) WHERE ativo = true AND origem_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO _credito_id;

    IF _credito_id IS NOT NULL THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
      VALUES (_credito_id, 'compra', _qtd, NEW.vendedor_id, 'Plano: ' || _cat_plano.nome);
    END IF;

  ELSIF NEW.tipo = 'servico' THEN
    SELECT * INTO _cat_serv FROM public.servicos_catalogo WHERE id = NEW.catalogo_id;
    IF _cat_serv IS NULL THEN RAISE EXCEPTION 'Serviço de catálogo não encontrado'; END IF;

    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado)
    VALUES (NEW.aluno_id, 'servico', NEW.id, _cat_serv.atividade, _cat_serv.quantidade_sessoes, false)
    ON CONFLICT (aluno_id, atividade, origem_tipo, origem_id) WHERE ativo = true AND origem_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO _credito_id;

    IF _credito_id IS NOT NULL THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
      VALUES (_credito_id, 'compra', _cat_serv.quantidade_sessoes, NEW.vendedor_id, 'Serviço: ' || _cat_serv.nome);
    END IF;
  END IF;

  RETURN NEW;
END $function$;

-- ============================================================
-- 4) TRIGGER DE CASCATA AO EXCLUIR VENDA
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_cleanup_on_venda_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _contrato_ids uuid[];
  _vendas_rest int;
  _contratos_rest int;
BEGIN
  -- Créditos vinculados diretamente à venda (qualquer origem_tipo)
  DELETE FROM public.creditos_aluno WHERE origem_id = OLD.id;

  -- Contratos vinculados ao mesmo plano da venda
  IF OLD.plano_id IS NOT NULL THEN
    SELECT array_agg(id) INTO _contrato_ids
    FROM public.contratos WHERE plano_id = OLD.plano_id;

    IF _contrato_ids IS NOT NULL AND array_length(_contrato_ids, 1) > 0 THEN
      DELETE FROM public.inadimplencias WHERE contrato_id = ANY(_contrato_ids);
      DELETE FROM public.ciclos_credito  WHERE contrato_id = ANY(_contrato_ids);
      DELETE FROM public.cobrancas       WHERE contrato_id = ANY(_contrato_ids);
      DELETE FROM public.contratos       WHERE id           = ANY(_contrato_ids);
    END IF;
  END IF;

  -- Pagamentos e comissionamentos da venda
  DELETE FROM public.pagamentos_rede   WHERE venda_id  = OLD.id;
  DELETE FROM public.comissionamentos  WHERE origem_id = OLD.id;

  -- Desativa o plano se ficou sem outras vendas/contratos
  IF OLD.plano_id IS NOT NULL THEN
    SELECT count(*) INTO _vendas_rest
    FROM public.vendas WHERE plano_id = OLD.plano_id AND id <> OLD.id;
    SELECT count(*) INTO _contratos_rest
    FROM public.contratos WHERE plano_id = OLD.plano_id;
    IF _vendas_rest = 0 AND _contratos_rest = 0 THEN
      UPDATE public.planos SET ativo = false WHERE id = OLD.plano_id;
    END IF;
  END IF;

  RETURN OLD;
END $function$;

DROP TRIGGER IF EXISTS trg_cleanup_on_venda_delete ON public.vendas;
CREATE TRIGGER trg_cleanup_on_venda_delete
BEFORE DELETE ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.fn_cleanup_on_venda_delete();
