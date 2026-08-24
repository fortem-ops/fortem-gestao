-- 1) Blindagem de valor mensal vs total do periodo
CREATE OR REPLACE FUNCTION public.fn_criar_contrato_recorrencia(p_venda_id uuid, p_aluno_id uuid, p_plano_id uuid, p_valor_mensal numeric, p_taxa_mensal numeric, p_data_inicio date, p_forma_pagamento text, p_cartao_token_id uuid DEFAULT NULL::uuid, p_primeira_paga boolean DEFAULT false, p_servicos_inclusos jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contrato_id uuid;
  v_plano record;
  v_plano_aluno_id uuid;
  v_freq_text text;
  v_plano_tipo text;
  v_freq_sem smallint;
  v_nome_norm text;
  v_valor_total_mes numeric;
  v_meio text;
  v_vigencia text;
  v_n_parcelas smallint;
  i smallint;
  v_status text;
  v_dt_pag date;
  v_data_validade date;
  v_is_corrida boolean;
  v_creditos int;
  v_contratos_antigos uuid[];
BEGIN
  SELECT periodo_meses, frequencia, quantidade_creditos, ilimitado, nome, valor, atividade
    INTO v_plano
  FROM public.planos_catalogo
  WHERE id = p_plano_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de catálogo % não encontrado', p_plano_id;
  END IF;

  SELECT v.plano_id INTO v_plano_aluno_id FROM public.vendas v WHERE v.id = p_venda_id;
  IF v_plano_aluno_id IS NULL THEN
    SELECT p.id INTO v_plano_aluno_id
    FROM public.planos p
    WHERE p.aluno_id = p_aluno_id AND p.ativo = true AND p.tipo = v_plano.nome
    ORDER BY p.created_at DESC NULLS LAST, p.data_inicio DESC
    LIMIT 1;
  END IF;
  IF v_plano_aluno_id IS NULL THEN
    RAISE EXCEPTION 'Plano ativo do aluno não encontrado para a venda %', p_venda_id;
  END IF;

  -- Remove qualquer contrato "automático" que o gatilho de criação de planos
  -- (fn_auto_criar_contrato_ciclo) já tenha criado para este mesmo plano_id
  -- nesta mesma transação (acontece para tipos com renovacao_automatica=true
  -- por padrão: Start, Gympass/Wellhub, TotalPass, VIP). Essa RPC é a versão
  -- completa e correta (créditos, serviços inclusos, parcelas reais) — a
  -- versão do gatilho é só um placeholder e nunca deve sobreviver duplicada.
  SELECT array_agg(id) INTO v_contratos_antigos
  FROM public.contratos WHERE plano_id = v_plano_aluno_id;

  IF v_contratos_antigos IS NOT NULL AND array_length(v_contratos_antigos, 1) > 0 THEN
    DELETE FROM public.contratos_documentos WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.inadimplencias WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.ciclos_credito WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.cobrancas WHERE contrato_id = ANY(v_contratos_antigos);
    DELETE FROM public.contratos WHERE id = ANY(v_contratos_antigos);
  END IF;

  v_is_corrida := (v_plano.atividade = 'corrida');

  v_freq_text := COALESCE(v_plano.frequencia, '1x');
  v_nome_norm := lower(btrim(COALESCE(v_plano.nome, '')));

  IF v_is_corrida THEN
    v_plano_tipo := 'corrida';
  ELSE
    v_plano_tipo := CASE
      WHEN v_nome_norm = 'start' THEN 'start'
      WHEN v_nome_norm IN ('start+', 'start plus', 'startplus') THEN 'start_plus'
      WHEN v_nome_norm = 'power' THEN 'power'
      WHEN v_nome_norm = 'pro' THEN 'pro'
      WHEN v_nome_norm IN ('max', 'vip') THEN 'max'
      WHEN v_nome_norm LIKE '%gympass%' THEN 'gympass'
      WHEN v_nome_norm LIKE '%wellhub%' THEN 'wellhub'
      WHEN v_nome_norm LIKE '%total%pass%' OR v_nome_norm = 'totalpass' THEN 'totalpass'
      ELSE 'outro'
    END;
  END IF;

  IF v_is_corrida THEN
    v_freq_sem := NULL;
    v_creditos := NULL;
  ELSE
    v_freq_sem := CASE
      WHEN v_freq_text = 'livre' THEN 5
      WHEN v_freq_text ~ '^[0-9]+x?$' THEN COALESCE(NULLIF(regexp_replace(v_freq_text,'\D','','g'),'')::smallint, 1)
      ELSE 1
    END;
    IF v_freq_sem NOT IN (1,2,3,5) THEN v_freq_sem := 1; END IF;
    v_creditos := COALESCE(v_plano.quantidade_creditos, 0);
  END IF;

  v_valor_total_mes := COALESCE(p_valor_mensal,0) + COALESCE(p_taxa_mensal,0);

  v_vigencia := CASE
    WHEN COALESCE(v_plano.periodo_meses, 1) = 12 THEN 'anual'
    WHEN COALESCE(v_plano.periodo_meses, 1) = 6 THEN 'semestral'
    ELSE 'mensal'
  END;
  v_n_parcelas := CASE
    WHEN v_vigencia = 'anual' THEN 12
    WHEN v_vigencia = 'semestral' THEN 6
    ELSE 1
  END;
  -- Blindagem: quando o valor recebido é o TOTAL do período (e não a mensalidade),
  -- normaliza dividindo pelo número de parcelas. Detecção determinística: o valor
  -- do catálogo (v_plano.valor) é sempre o total do período.
  IF v_n_parcelas > 1
     AND COALESCE(v_plano.valor,0) > 0
     AND COALESCE(p_valor_mensal,0) >= COALESCE(v_plano.valor,0) * 0.9 THEN
    RAISE NOTICE 'fn_criar_contrato_recorrencia: valor % parece ser total do periodo; normalizando para % parcelas', p_valor_mensal, v_n_parcelas;
    p_valor_mensal := round(p_valor_mensal / v_n_parcelas, 2);
    v_valor_total_mes := COALESCE(p_valor_mensal,0) + COALESCE(p_taxa_mensal,0);
  END IF;

  v_data_validade := (p_data_inicio + (COALESCE(v_plano.periodo_meses,1) || ' months')::interval)::date;

  v_meio := CASE
    WHEN p_forma_pagamento IN ('cartao_credito','cartao_recorrencia','pix_automatico','boleto') THEN 'automatico'
    ELSE 'manual_admin'
  END;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim,
    forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, cartao_token_id, criado_por, servicos_inclusos
  ) VALUES (
    p_aluno_id, v_plano_aluno_id, v_plano_tipo, v_freq_sem,
    v_creditos,
    v_vigencia, p_data_inicio, v_data_validade,
    p_forma_pagamento, COALESCE(p_valor_mensal,0), v_valor_total_mes,
    COALESCE(p_taxa_mensal,0),
    v_n_parcelas, 'ativo', p_cartao_token_id, auth.uid(),
    COALESCE(p_servicos_inclusos, '{}'::jsonb)
  )
  RETURNING id INTO v_contrato_id;

  IF NOT v_is_corrida THEN
    INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
    VALUES (v_contrato_id, COALESCE(v_plano.quantidade_creditos, 0), p_data_inicio,
            (p_data_inicio + INTERVAL '1 month')::date, 'ativo');
  END IF;

  FOR i IN 1..v_n_parcelas LOOP
    IF i = 1 AND p_primeira_paga THEN
      v_status := 'pago'; v_dt_pag := CURRENT_DATE;
    ELSE
      v_status := 'pendente'; v_dt_pag := NULL;
    END IF;

    INSERT INTO public.cobrancas (
      contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, data_pagamento,
      status, forma_pagamento, meio_registro, gateway
    ) VALUES (
      v_contrato_id, p_aluno_id, i, v_valor_total_mes,
      (p_data_inicio + ((i-1) || ' months')::interval)::date, v_dt_pag,
      v_status, p_forma_pagamento, v_meio,
      CASE WHEN p_forma_pagamento IN ('cartao_credito','cartao_recorrencia') THEN 'rede'
           WHEN p_forma_pagamento = 'pix_automatico' THEN 'inter'
           ELSE NULL END
    );
  END LOOP;

  RETURN v_contrato_id;
END;
$function$;

-- ============================================================
-- 2) Créditos: creditos_aluno como fonte única de verdade
-- ============================================================

ALTER TABLE public.creditos_movimentos
  ADD COLUMN IF NOT EXISTS consumo_id uuid;

CREATE INDEX IF NOT EXISTS idx_creditos_movimentos_consumo
  ON public.creditos_movimentos (consumo_id) WHERE consumo_id IS NOT NULL;

-- Mapeia o rótulo usado em consumo_servicos.tipo_servico para creditos_aluno.atividade
CREATE OR REPLACE FUNCTION public.fn_creditos_atividade_de_servico(_tipo_servico text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(btrim(COALESCE(_tipo_servico,'')))
    WHEN 'consultas nutricao'      THEN 'Nutrição'
    WHEN 'consultas nutrição'      THEN 'Nutrição'
    WHEN 'nutricao'                THEN 'Nutrição'
    WHEN 'nutrição'                THEN 'Nutrição'
    WHEN 'consultas reabilitacao'  THEN 'Reabilitação'
    WHEN 'consultas reabilitação'  THEN 'Reabilitação'
    WHEN 'reabilitacao'            THEN 'Reabilitação'
    WHEN 'reabilitação'            THEN 'Reabilitação'
    WHEN 'avaliacao funcional'     THEN 'Avaliação Funcional'
    WHEN 'avaliação funcional'     THEN 'Avaliação Funcional'
    ELSE NULL
  END
$$;

-- Debita creditos_aluno sempre que um uso é registrado em consumo_servicos
CREATE OR REPLACE FUNCTION public.fn_creditos_debitar_por_consumo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _atividade text;
  _credito record;
BEGIN
  IF NEW.aluno_id IS NULL OR COALESCE(NEW.tipo_registro,'') = 'compra' THEN
    RETURN NEW;
  END IF;

  _atividade := public.fn_creditos_atividade_de_servico(NEW.tipo_servico);
  IF _atividade IS NULL THEN
    RETURN NEW;
  END IF;

  -- Evita duplo débito quando a agenda já debitou creditos_aluno diretamente
  IF NEW.agenda_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.creditos_movimentos
    WHERE agenda_id = NEW.agenda_id AND tipo = 'consumo'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _credito
  FROM public.creditos_aluno
  WHERE aluno_id = NEW.aluno_id
    AND atividade = _atividade
    AND ativo = true
    AND (data_validade IS NULL OR data_validade >= CURRENT_DATE)
    AND (ilimitado = true OR quantidade_usada < quantidade_inicial)
  ORDER BY (origem_tipo::text = 'plano') DESC, data_validade NULLS LAST, created_at
  LIMIT 1;

  IF _credito.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT _credito.ilimitado THEN
    UPDATE public.creditos_aluno
       SET quantidade_usada = quantidade_usada + COALESCE(NEW.quantidade,1),
           updated_at = now()
     WHERE id = _credito.id;
  END IF;

  INSERT INTO public.creditos_movimentos
    (credito_id, tipo, quantidade, agenda_id, consumo_id, registrado_por, observacao)
  VALUES
    (_credito.id, 'consumo', COALESCE(NEW.quantidade,1), NULL, NEW.id,
     COALESCE(NEW.registrado_por, auth.uid()),
     'Consumo de serviço: ' || COALESCE(NEW.tipo_servico,'-'));

  RETURN NEW;
END;
$$;

-- Estorna o crédito quando o registro de consumo é removido
CREATE OR REPLACE FUNCTION public.fn_creditos_estornar_por_consumo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mov record;
BEGIN
  FOR _mov IN
    SELECT * FROM public.creditos_movimentos
    WHERE consumo_id = OLD.id AND tipo = 'consumo'
  LOOP
    UPDATE public.creditos_aluno
       SET quantidade_usada = GREATEST(0, quantidade_usada - _mov.quantidade),
           updated_at = now()
     WHERE id = _mov.credito_id AND ilimitado = false;

    INSERT INTO public.creditos_movimentos
      (credito_id, tipo, quantidade, consumo_id, registrado_por, observacao)
    VALUES
      (_mov.credito_id, 'estorno', _mov.quantidade, NULL, auth.uid(),
       'Estorno por exclusão de consumo de serviço');
  END LOOP;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_creditos_debitar_por_consumo ON public.consumo_servicos;
CREATE TRIGGER trg_creditos_debitar_por_consumo
AFTER INSERT ON public.consumo_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_creditos_debitar_por_consumo();

DROP TRIGGER IF EXISTS trg_creditos_estornar_por_consumo ON public.consumo_servicos;
CREATE TRIGGER trg_creditos_estornar_por_consumo
AFTER DELETE ON public.consumo_servicos
FOR EACH ROW EXECUTE FUNCTION public.fn_creditos_estornar_por_consumo();

-- ============================================================
-- 3) Correção: desativar créditos ao desativar o plano
--    (creditos_aluno.origem_id aponta para vendas.id, não planos.id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_sync_creditos_on_plano_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.ativo = true AND NEW.ativo = false) THEN
    UPDATE public.creditos_aluno ca
       SET ativo = false,
           updated_at = now()
     WHERE ca.aluno_id = NEW.aluno_id
       AND ca.origem_tipo = 'plano'
       AND ca.ativo = true
       AND (
         ca.origem_id = NEW.id
         OR ca.origem_id IN (SELECT v.id FROM public.vendas v WHERE v.plano_id = NEW.id)
       );
  END IF;
  RETURN NEW;
END;
$$;