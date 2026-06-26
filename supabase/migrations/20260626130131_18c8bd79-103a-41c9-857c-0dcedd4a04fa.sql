
-- 1. fn_criar_contrato_recorrencia: vigência derivada do catálogo + nº de parcelas correto
CREATE OR REPLACE FUNCTION public.fn_criar_contrato_recorrencia(
  p_venda_id uuid, p_aluno_id uuid, p_plano_id uuid, p_valor_mensal numeric,
  p_taxa_mensal numeric, p_data_inicio date, p_forma_pagamento text,
  p_cartao_token_id uuid DEFAULT NULL::uuid, p_primeira_paga boolean DEFAULT false,
  p_servicos_inclusos jsonb DEFAULT '{}'::jsonb
)
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
BEGIN
  SELECT periodo_meses, frequencia, quantidade_creditos, ilimitado, nome, valor
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

  v_freq_text := COALESCE(v_plano.frequencia, '1x');
  v_nome_norm := lower(btrim(COALESCE(v_plano.nome, '')));

  v_plano_tipo := CASE
    WHEN v_nome_norm = 'start' THEN 'start'
    WHEN v_nome_norm IN ('start+', 'start plus', 'startplus') THEN 'start_plus'
    WHEN v_nome_norm = 'power' THEN 'power'
    WHEN v_nome_norm = 'pro' THEN 'pro'
    WHEN v_nome_norm IN ('max', 'vip') THEN 'max'
    WHEN v_nome_norm LIKE '%corrida%' THEN 'corrida'
    WHEN v_nome_norm LIKE '%gympass%' THEN 'gympass'
    WHEN v_nome_norm LIKE '%wellhub%' THEN 'wellhub'
    WHEN v_nome_norm LIKE '%total%pass%' OR v_nome_norm = 'totalpass' THEN 'totalpass'
    ELSE 'outro'
  END;

  v_freq_sem := CASE
    WHEN v_freq_text = 'livre' THEN 5
    WHEN v_freq_text ~ '^[0-9]+x?$' THEN COALESCE(NULLIF(regexp_replace(v_freq_text,'\D','','g'),'')::smallint, 1)
    ELSE 1
  END;
  IF v_freq_sem NOT IN (1,2,3,5) THEN v_freq_sem := 1; END IF;

  v_valor_total_mes := COALESCE(p_valor_mensal,0) + COALESCE(p_taxa_mensal,0);

  -- Vigência e nº de parcelas derivados do catálogo
  v_vigencia := CASE WHEN COALESCE(v_plano.periodo_meses, 1) = 12 THEN 'anual' ELSE 'mensal' END;
  v_n_parcelas := CASE WHEN v_vigencia = 'anual' THEN 12 ELSE 1 END;
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
    COALESCE(v_plano.quantidade_creditos, 0),
    v_vigencia, p_data_inicio, v_data_validade,
    p_forma_pagamento, COALESCE(p_valor_mensal,0), v_valor_total_mes,
    COALESCE(p_taxa_mensal,0),
    v_n_parcelas, 'ativo', p_cartao_token_id, auth.uid(),
    COALESCE(p_servicos_inclusos, '{}'::jsonb)
  )
  RETURNING id INTO v_contrato_id;

  -- Ciclo de crédito inicial
  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato_id, COALESCE(v_plano.quantidade_creditos, 0), p_data_inicio,
          (p_data_inicio + INTERVAL '1 month')::date, 'ativo');

  -- Cobranças
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

-- Mantém o wrapper de aridade antiga
CREATE OR REPLACE FUNCTION public.fn_criar_contrato_recorrencia(
  p_venda_id uuid, p_aluno_id uuid, p_plano_id uuid, p_valor_mensal numeric,
  p_taxa_mensal numeric, p_data_inicio date, p_forma_pagamento text,
  p_cartao_token_id uuid DEFAULT NULL::uuid, p_primeira_paga boolean DEFAULT false
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.fn_criar_contrato_recorrencia(
    p_venda_id, p_aluno_id, p_plano_id, p_valor_mensal, p_taxa_mensal,
    p_data_inicio, p_forma_pagamento, p_cartao_token_id, p_primeira_paga, '{}'::jsonb
  );
$function$;

-- 2. fn_auto_criar_contrato_ciclo: pular quando há venda recente para o mesmo plano (evita duplicação com a RPC)
CREATE OR REPLACE FUNCTION public.fn_auto_criar_contrato_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_freq int;
  v_tipo text;
  v_data_inicio date;
  v_data_fim date;
  v_creditos int;
  v_contrato_id uuid;
  v_existing uuid;
  v_venda_recente uuid;
  v_vigencia text;
  v_periodo int;
BEGIN
  IF COALESCE(NEW.renovacao_automatica, false) = false OR NEW.ativo = false THEN
    RETURN NEW;
  END IF;

  -- Se há venda recente (mesma transação UI) para este aluno/plano, deixar a RPC criar o contrato
  SELECT v.id INTO v_venda_recente
  FROM public.vendas v
  WHERE v.aluno_id = NEW.aluno_id
    AND v.tipo = 'plano'
    AND v.created_at >= now() - interval '30 seconds'
  LIMIT 1;
  IF v_venda_recente IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing FROM public.contratos WHERE plano_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

  SELECT CASE WHEN a.frequencia_semanal IN (1,2,3,5) THEN a.frequencia_semanal ELSE 2 END
    INTO v_freq FROM public.alunos a WHERE a.id = NEW.aluno_id;

  v_tipo := CASE lower(trim(NEW.tipo))
    WHEN 'start'           THEN 'start'
    WHEN 'start+'          THEN 'start_plus'
    WHEN 'start plus'      THEN 'start_plus'
    WHEN 'power'           THEN 'power'
    WHEN 'pro'             THEN 'pro'
    WHEN 'max'             THEN 'max'
    WHEN 'vip'             THEN 'pro'
    WHEN 'vip 3x/semana'   THEN 'pro'
    WHEN 'gympass/wellhub' THEN 'gympass'
    WHEN 'gympass'         THEN 'gympass'
    WHEN 'wellhub'         THEN 'wellhub'
    WHEN 'total pass'      THEN 'totalpass'
    WHEN 'totalpass'       THEN 'totalpass'
    WHEN 'corrida'         THEN 'corrida'
    ELSE 'outro'
  END;

  v_periodo := COALESCE(NEW.duracao_meses, 1);
  v_vigencia := CASE WHEN v_periodo = 12 THEN 'anual' ELSE 'mensal' END;

  v_data_inicio := NEW.data_inicio::date;
  v_data_fim    := COALESCE(NEW.proxima_renovacao::date, v_data_inicio + (v_periodo || ' months')::interval);
  v_creditos    := CASE WHEN v_freq = 5 THEN 20 ELSE v_freq * 4 END;

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento,
    valor_base, valor_cobrado, taxa_recorrencia, parcelas, status
  ) VALUES (
    NEW.aluno_id, NEW.id, v_tipo, v_freq, v_creditos,
    v_vigencia, v_data_inicio, v_data_fim, 'cartao_recorrencia',
    COALESCE(NEW.valor, 0), COALESCE(NEW.valor, 0), 0, 1, 'ativo'
  ) RETURNING id INTO v_contrato_id;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato_id, v_creditos, v_data_inicio, v_data_fim, 'ativo');

  INSERT INTO public.cobrancas (
    contrato_id, aluno_id, numero_ciclo, valor, data_vencimento,
    status, forma_pagamento, meio_registro, gateway
  ) VALUES (
    v_contrato_id, NEW.aluno_id, 1, COALESCE(NEW.valor, 0), v_data_inicio,
    'pendente', 'cartao_recorrencia', 'automatico', 'rede'
  );

  RETURN NEW;
END;
$function$;

-- 3. Limpar duplicação da Marilza (mantém o contrato de 12x R$ 299)
DELETE FROM public.ciclos_credito WHERE contrato_id = '4e1e2096-9b79-4418-9f49-d069f201652e';
DELETE FROM public.cobrancas WHERE contrato_id = '4e1e2096-9b79-4418-9f49-d069f201652e';
DELETE FROM public.contratos WHERE id = '4e1e2096-9b79-4418-9f49-d069f201652e';

-- 4. Backfill: vigência anual para planos que sempre são de 12 meses
UPDATE public.contratos
   SET vigencia_tipo = 'anual'
 WHERE plano_tipo IN ('start_plus','power','pro','max')
   AND vigencia_tipo <> 'anual';
