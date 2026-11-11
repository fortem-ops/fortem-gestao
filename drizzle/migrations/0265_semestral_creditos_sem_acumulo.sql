-- Plano Semestral, Etapa 4 (ajuste): créditos de ciclos anteriores expiram antes de liberar o novo ciclo.
CREATE OR REPLACE FUNCTION public.fn_semestral_liberar_ciclo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.contratos; c public.planos_catalogo; v_venda uuid; v_ini date; v_fim date; v_cred uuid; n int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pago' OR OLD.status = 'pago' OR NEW.numero_ciclo IS NULL OR NEW.numero_ciclo >= 100 THEN RETURN NEW; END IF;
  SELECT * INTO k FROM public.contratos WHERE id = NEW.contrato_id;
  IF k.plano_tipo IS DISTINCT FROM 'semestral_2027' THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE id = k.catalogo_id;
  SELECT id INTO v_venda FROM public.vendas WHERE plano_id = k.plano_id AND tipo = 'plano' ORDER BY created_at LIMIT 1;
  IF v_venda IS NULL THEN RETURN NEW; END IF;
  n := NEW.numero_ciclo;
  v_ini := k.data_inicio + 30 * (n - 1);
  v_fim := v_ini + 29;
  -- Sem acúmulo: créditos de ciclos anteriores desta venda saem antes de liberar o ciclo pago
  -- (o índice único por venda só admite um crédito ativo por atividade).
  UPDATE public.creditos_aluno SET ativo = false
   WHERE origem_id = v_venda AND aluno_id = k.aluno_id AND ativo
     AND atividade IN ('Treino', 'Recovery (Bota de Compressão)') AND competencia < v_ini;
  INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade, competencia, reposicao_pct)
  VALUES (k.aluno_id, 'plano', v_venda, 'Treino', COALESCE(c.quantidade_creditos, 0), false, v_fim, v_ini, 0)
  ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
  IF v_cred IS NOT NULL THEN
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
    VALUES (v_cred, 'compra', COALESCE(c.quantidade_creditos, 0), 'Plano Semestral ciclo ' || n || ' (pago): ' || c.codigo);
  END IF;
  IF COALESCE(c.bota_compressao_mes, 0) > 0 THEN
    v_cred := NULL;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade, competencia, reposicao_pct)
    VALUES (k.aluno_id, 'plano', v_venda, 'Recovery (Bota de Compressão)', c.bota_compressao_mes, false, v_fim, v_ini, 0)
    ON CONFLICT DO NOTHING RETURNING id INTO v_cred;
    IF v_cred IS NOT NULL THEN
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, observacao)
      VALUES (v_cred, 'compra', c.bota_compressao_mes, 'Bota de compressão Semestral ciclo ' || n || ' — ' || c.codigo);
    END IF;
  END IF;
  IF n > 1 THEN
    UPDATE public.ciclos_credito SET status = 'expirado' WHERE contrato_id = k.id AND status = 'ativo' AND data_fim < v_ini;
    IF NOT EXISTS (SELECT 1 FROM public.ciclos_credito WHERE contrato_id = k.id AND data_inicio = v_ini) THEN
      INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
      VALUES (k.id, COALESCE(c.quantidade_creditos, 0), v_ini, v_fim, 'ativo');
    END IF;
    UPDATE public.contratos SET data_fim = v_ini + 30 WHERE id = k.id AND data_fim < v_ini + 30;
    UPDATE public.planos SET data_fim = v_ini + 30 WHERE id = k.plano_id AND (data_fim IS NULL OR data_fim < v_ini + 30);
  ELSE
    BEGIN
      PERFORM public.fn_mensalidade_manual_gerar(v_venda);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
      VALUES ('planos-semestral', 'mensalidade2_erro', 'Plano Semestral: mensalidade nº 2 não gerada', jsonb_build_object('contrato_id', k.id, 'erro', SQLERRM));
    END;
  END IF;
  RETURN NEW;
END $$;