CREATE OR REPLACE FUNCTION public.fn_alterar_tipo_cobranca_contrato(
  p_contrato_id uuid, p_tipo text, p_forma text, p_parcelas int, p_dia_venc int, p_aplicar_taxa boolean DEFAULT false, p_primeiro_venc date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record; v_antes jsonb; v_total numeric; v_n int; v_taxa numeric := 0; v_valor numeric; v_resto numeric;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_primeiro date; v_venc date; i int; v_removidas int;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF p_tipo NOT IN ('recorrencia','tradicional') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
  SELECT * INTO c FROM contratos WHERE id = p_contrato_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF c.status NOT IN ('ativo','suspenso','inadimplente') THEN RAISE EXCEPTION 'Contrato não está vigente'; END IF;
  IF EXISTS (SELECT 1 FROM cobrancas WHERE contrato_id = p_contrato_id AND (status IN ('pago','estornado','isento') OR tid IS NOT NULL)) THEN
    RAISE EXCEPTION 'Contrato possui cobrança paga/estornada; não é possível alterar o tipo de cobrança';
  END IF;
  v_antes := jsonb_build_object('contrato', to_jsonb(c), 'cobrancas', (SELECT jsonb_agg(to_jsonb(b)) FROM cobrancas b WHERE contrato_id = p_contrato_id));

  v_total := COALESCE(c.valor_base, c.valor_cobrado, 0);
  IF p_tipo = 'recorrencia' THEN
    v_n := CASE c.vigencia_tipo WHEN 'anual' THEN 12 WHEN 'semestral' THEN 6 ELSE 1 END;
    IF p_aplicar_taxa THEN v_taxa := 20; END IF;
  ELSE
    v_n := GREATEST(1, LEAST(12, COALESCE(p_parcelas,1)));
  END IF;
  v_valor := round(v_total / v_n, 2);
  v_resto := v_total - v_valor * (v_n - 1);
  v_primeiro := COALESCE(p_primeiro_venc, c.data_inicio);
  IF p_dia_venc BETWEEN 1 AND 31 THEN
    v_primeiro := make_date(extract(year from v_primeiro)::int, extract(month from v_primeiro)::int,
      LEAST(p_dia_venc, extract(day from (date_trunc('month', v_primeiro) + interval '1 month - 1 day'))::int));
  END IF;

  DELETE FROM inadimplencias WHERE cobranca_id IN (SELECT id FROM cobrancas WHERE contrato_id = p_contrato_id AND status IN ('pendente','atrasado','cancelado'));
  DELETE FROM cobrancas WHERE contrato_id = p_contrato_id AND status IN ('pendente','atrasado','cancelado');
  GET DIAGNOSTICS v_removidas = ROW_COUNT;

  FOR i IN 1..v_n LOOP
    v_venc := (v_primeiro + ((i-1) || ' months')::interval)::date;
    INSERT INTO cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status, forma_pagamento, meio_registro)
    VALUES (p_contrato_id, c.aluno_id, i, (CASE WHEN i = v_n THEN v_resto ELSE v_valor END) + v_taxa, v_venc,
      CASE WHEN v_venc >= v_hoje THEN 'pendente' ELSE 'atrasado' END, p_forma, 'manual_admin');
  END LOOP;

  UPDATE contratos SET forma_pagamento = p_forma, parcelas = v_n, taxa_recorrencia = v_taxa,
    valor_cobrado = v_total + v_taxa * v_n, updated_at = now() WHERE id = p_contrato_id;
  IF c.plano_id IS NOT NULL THEN
    UPDATE vendas SET tipo_cobranca = p_tipo, forma_pagamento = p_forma, parcelas = v_n, taxa_mensal = v_taxa,
      valor_final = v_total + v_taxa * v_n, updated_at = now() WHERE plano_id = c.plano_id AND tipo = 'plano';
    UPDATE planos SET forma_pagamento_padrao = p_forma, parcelas_padrao = v_n, updated_at = now() WHERE id = c.plano_id;
  END IF;

  INSERT INTO audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES ('contratos', p_contrato_id, 'update', auth.uid(), v_antes,
    jsonb_build_object('acao','alterar_tipo_cobranca','tipo',p_tipo,'forma',p_forma,'parcelas',v_n,'taxa',v_taxa));

  RETURN jsonb_build_object('removidas', v_removidas, 'criadas', v_n, 'valor_parcela', v_valor + v_taxa);
END $$;
REVOKE ALL ON FUNCTION public.fn_alterar_tipo_cobranca_contrato(uuid,text,text,int,int,boolean,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_alterar_tipo_cobranca_contrato(uuid,text,text,int,int,boolean,date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_auto_criar_contrato_ciclo()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_freq int; v_tipo text; v_data_inicio date; v_data_fim date; v_creditos int; v_contrato_id uuid;
  v_existing uuid; v_venda_recente uuid; v_vigencia text; v_periodo int;
BEGIN
  IF COALESCE(NEW.renovacao_automatica, false) = false OR NEW.ativo = false THEN
    RETURN NEW;
  END IF;

  SELECT v.id INTO v_venda_recente FROM public.vendas v
  WHERE v.aluno_id = NEW.aluno_id AND v.tipo = 'plano' AND v.created_at >= now() - interval '30 seconds' LIMIT 1;
  IF v_venda_recente IS NOT NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM public.contratos WHERE plano_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

  -- Guarda: se o aluno já tem um contrato vigente mais novo (venda posterior de outro plano),
  -- a renovação automática do plano antigo não deve substituí-lo.
  IF EXISTS (
    SELECT 1 FROM public.contratos ct
    WHERE ct.aluno_id = NEW.aluno_id AND ct.status IN ('ativo','suspenso','inadimplente')
      AND ct.plano_id IS DISTINCT FROM NEW.id
      AND ct.data_inicio >= NEW.data_inicio::date - 7
      AND (ct.data_fim IS NULL OR ct.data_fim > NEW.data_inicio::date)
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendas v
    WHERE v.aluno_id = NEW.aluno_id AND v.tipo = 'plano' AND v.origem = 'renovacao_automatica'
      AND v.created_at >= now() - interval '20 hours' AND v.created_at < now() - interval '30 seconds'
  ) THEN RETURN NEW; END IF;

  IF NEW.atividade = 'corrida' THEN
    v_tipo := 'corrida';
  ELSE
    v_tipo := CASE lower(trim(NEW.tipo))
      WHEN 'start' THEN 'start' WHEN 'start+' THEN 'start_plus' WHEN 'start plus' THEN 'start_plus'
      WHEN 'power' THEN 'power' WHEN 'pro' THEN 'pro' WHEN 'max' THEN 'max'
      WHEN 'vip' THEN 'outro' WHEN 'vip 2x/semana' THEN 'outro' WHEN 'vip 3x/semana' THEN 'outro'
      WHEN 'gympass/wellhub' THEN 'gympass' WHEN 'gympass' THEN 'gympass' WHEN 'wellhub' THEN 'wellhub'
      WHEN 'total pass' THEN 'totalpass' WHEN 'totalpass' THEN 'totalpass' WHEN 'corrida' THEN 'corrida'
      ELSE 'outro' END;
  END IF;

  IF v_tipo = 'corrida' THEN v_freq := NULL;
  ELSE
    SELECT CASE WHEN a.frequencia_semanal IN (1,2,3,5) THEN a.frequencia_semanal ELSE 2 END
      INTO v_freq FROM public.alunos a WHERE a.id = NEW.aluno_id;
  END IF;

  v_periodo := COALESCE(NEW.duracao_meses, 1);
  v_vigencia := CASE WHEN v_periodo = 12 THEN 'anual' WHEN v_periodo = 6 THEN 'semestral' ELSE 'mensal' END;
  v_data_inicio := NEW.data_inicio::date;
  v_data_fim    := COALESCE(NEW.proxima_renovacao::date, v_data_inicio + (v_periodo || ' months')::interval);
  v_creditos    := CASE WHEN v_tipo = 'corrida' THEN NULL WHEN v_freq = 5 THEN 20 ELSE v_freq * 4 END;

  UPDATE public.contratos
  SET status = 'encerrado',
      observacoes = COALESCE(observacoes || ' | ', '') || 'Encerrado automaticamente: substituído por renovação em ' || CURRENT_DATE
  WHERE aluno_id = NEW.aluno_id AND status IN ('ativo', 'suspenso') AND plano_id IS DISTINCT FROM NEW.id;

  UPDATE public.ciclos_credito SET status = 'expirado'
  WHERE status IN ('ativo', 'suspenso')
    AND contrato_id IN (SELECT id FROM public.contratos WHERE aluno_id = NEW.aluno_id AND plano_id IS DISTINCT FROM NEW.id AND status = 'encerrado');

  INSERT INTO public.contratos (
    aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total, vigencia_tipo, data_inicio, data_fim, forma_pagamento,
    valor_base, valor_cobrado, taxa_recorrencia, parcelas, status
  ) VALUES (
    NEW.aluno_id, NEW.id, v_tipo, v_freq, v_creditos, v_vigencia, v_data_inicio, v_data_fim, 'cartao_recorrencia',
    COALESCE(NEW.valor, 0), COALESCE(NEW.valor, 0), 0, 1, 'ativo'
  ) RETURNING id INTO v_contrato_id;

  IF NEW.atividade <> 'corrida' THEN
    INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
    VALUES (v_contrato_id, v_creditos, v_data_inicio, v_data_fim, 'ativo');
  END IF;

  INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status, forma_pagamento, meio_registro, gateway)
  VALUES (v_contrato_id, NEW.aluno_id, 1, COALESCE(NEW.valor, 0), v_data_inicio, 'pendente', 'cartao_recorrencia', 'automatico', 'rede');

  RETURN NEW;
END;
$function$;