-- Etapa 4C do Plano Semestral: desistência/expiração da venda sem pagamento; CPF conta só venda paga e ativada.

CREATE OR REPLACE FUNCTION public.fn_semestral_venda_paga(p_venda uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = p_venda AND v.status_pagamento IN ('pago','estornado'))
      OR EXISTS (SELECT 1 FROM public.vendas v JOIN public.contratos k ON k.plano_id = v.plano_id AND k.plano_tipo = 'semestral_2027'
                 JOIN public.cobrancas cb ON cb.contrato_id = k.id AND cb.numero_ciclo = 1 AND cb.status = 'pago'
                 WHERE v.id = p_venda)
      OR EXISTS (SELECT 1 FROM public.planos_2027_mensalidades m WHERE m.venda_origem_id = p_venda AND m.numero = 1 AND m.status = 'pago')
      OR EXISTS (SELECT 1 FROM public.pagamentos_rede pr WHERE pr.venda_id = p_venda AND pr.status IN ('approved','refunded'))
      OR EXISTS (SELECT 1 FROM public.system_logs s WHERE s.modulo = 'planos-semestral' AND s.acao = 'venda_ativada' AND s.payload->>'venda_id' = p_venda::text);
$function$;
REVOKE ALL ON FUNCTION public.fn_semestral_venda_paga(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_venda_paga(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_semestral_elegivel(p_aluno uuid, p_codigo text, p_hoje date DEFAULT NULL::date, p_ignorar_cpf boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c public.planos_catalogo;
  v_hoje date := COALESCE(p_hoje, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_well boolean; v_total boolean; v_agr text; v_hash text; v_usado boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO c FROM public.planos_catalogo WHERE codigo = p_codigo;
  IF NOT FOUND OR c.agregadora_requerida IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'Item não é do Plano Semestral de agregadora.');
  END IF;
  SELECT bool_or(tipo = 'Gympass/Wellhub'), bool_or(tipo = 'Total Pass') INTO v_well, v_total
  FROM public.planos WHERE aluno_id = p_aluno AND ativo;
  v_well := COALESCE(v_well, false); v_total := COALESCE(v_total, false);
  IF v_well AND v_total THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'Aluno com Wellhub e TotalPass ativos ao mesmo tempo: a equipe precisa corrigir o cadastro.');
  END IF;
  v_agr := CASE WHEN v_well THEN 'wellhub' WHEN v_total THEN 'totalpass' END;
  IF v_agr IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'Aluno sem plano de agregadora ativo.');
  END IF;
  IF v_agr <> c.agregadora_requerida THEN
    RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Este item é de outra agregadora.');
  END IF;
  IF c.vendavel_ate IS NOT NULL AND v_hoje > c.vendavel_ate THEN
    RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Promoção encerrada em ' || to_char(c.vendavel_ate, 'DD/MM/YYYY') || '.');
  END IF;
  IF NOT p_ignorar_cpf THEN
    SELECT cpf_hash INTO v_hash FROM public.alunos WHERE id = p_aluno;
    -- Conta só vendas do Semestral que chegaram a ser pagas e ativadas (mesmo canceladas/estornadas depois).
    -- Desistidas/expiradas nunca pagas e a venda ainda aberta (retomada pela própria venda) não contam.
    SELECT EXISTS (
      SELECT 1 FROM public.vendas v
       WHERE v.aluno_id IN (SELECT id FROM public.alunos WHERE id = p_aluno OR (v_hash IS NOT NULL AND cpf_hash = v_hash))
         AND v.catalogo_id IN (SELECT id FROM public.planos_catalogo WHERE familia = 'semestral_2027')
         AND public.fn_semestral_venda_paga(v.id)
    ) INTO v_usado;
    IF v_usado THEN
      RETURN jsonb_build_object('elegivel', false, 'agregadora', v_agr, 'motivo', 'Este CPF já contratou o Plano Semestral (inclusive cancelado) e não pode recontratar.');
    END IF;
  END IF;
  RETURN jsonb_build_object('elegivel', true, 'agregadora', v_agr, 'motivo', null);
END $function$;

-- Encerra venda Semestral nunca paga (desistência ou expiração). Nada é ligado; agregadora fica intacta.
CREATE OR REPLACE FUNCTION public.fn_semestral_encerrar_sem_pagamento(p_venda uuid, p_motivo text, p_acao text, p_por uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.vendas; k public.contratos; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_primeiro_ciclo:'||p_venda::text,0));
  SELECT * INTO v FROM public.vendas WHERE id = p_venda FOR UPDATE;
  IF v.id IS NULL OR v.catalogo_id NOT IN (SELECT id FROM public.planos_catalogo WHERE familia = 'semestral_2027') THEN
    RETURN jsonb_build_object('ok', false, 'situacao', 'nao_encontrada');
  END IF;
  IF v.status_pagamento IN ('cancelado','falha') THEN RETURN jsonb_build_object('ok', true, 'situacao', 'ja_encerrada', 'repetida', true); END IF;
  IF public.fn_semestral_venda_paga(p_venda) OR EXISTS (SELECT 1 FROM public.planos WHERE id = v.plano_id AND ativo) THEN
    RETURN jsonb_build_object('ok', false, 'situacao', 'paga');
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagamentos_rede WHERE venda_id = p_venda AND status = 'pending')
     OR EXISTS (SELECT 1 FROM public.planos_2027_mensalidades WHERE venda_origem_id = p_venda AND status IN ('processando','desconhecido')) THEN
    RETURN jsonb_build_object('ok', false, 'situacao', 'pagamento_em_andamento');
  END IF;
  SELECT * INTO k FROM public.contratos WHERE plano_id = v.plano_id AND plano_tipo = 'semestral_2027' FOR UPDATE;

  UPDATE public.vendas SET status_pagamento = 'cancelado', data_cancelamento = v_hoje,
    observacao_cancelamento = p_motivo,
    motivo_cancelamento_id = COALESCE(motivo_cancelamento_id, (SELECT id FROM public.cancelamento_motivos WHERE nome = 'Outros' LIMIT 1))
   WHERE id = p_venda;
  IF k.id IS NOT NULL THEN
    UPDATE public.contratos SET status = 'cancelado', data_cancelamento = v_hoje, multa_percentual = 0,
      motivo_cancelamento = p_motivo
     WHERE id = k.id;
    UPDATE public.cobrancas SET status = 'cancelado' WHERE contrato_id = k.id AND status IN ('pendente','atrasado');
  END IF;
  UPDATE public.planos_2027_mensalidades SET status = 'cancelado', proxima_tentativa_em = NULL
   WHERE venda_origem_id = p_venda AND status IN ('pendente','recusado','inadimplente');
  UPDATE public.planos SET ativo = false, renovacao_automatica = false, data_fim = v_hoje WHERE id = v.plano_id;
  UPDATE public.creditos_aluno SET ativo = false
   WHERE aluno_id = v.aluno_id AND origem_id IN (p_venda, v.plano_id) AND ativo;
  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-semestral', p_acao, 'Venda do Plano Semestral encerrada sem pagamento: ' || p_motivo,
    jsonb_build_object('venda_id', p_venda, 'contrato_id', k.id, 'por', p_por));
  RETURN jsonb_build_object('ok', true, 'situacao', 'encerrada', 'venda_id', p_venda);
END $function$;
REVOKE ALL ON FUNCTION public.fn_semestral_encerrar_sem_pagamento(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_encerrar_sem_pagamento(uuid, text, text, uuid) TO service_role;

-- Botão "Desistir da venda" (admin e coordenador).
CREATE OR REPLACE FUNCTION public.fn_semestral_desistir(p_venda uuid, p_motivo text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'Só administrador ou coordenador desiste da venda'; END IF;
  r := public.fn_semestral_encerrar_sem_pagamento(p_venda,
         COALESCE(NULLIF(trim(p_motivo), ''), 'Desistência da venda do Plano Semestral (sem pagamento)'), 'venda_desistida', auth.uid());
  IF r->>'situacao' = 'pagamento_em_andamento' THEN RAISE EXCEPTION 'Há um pagamento em processamento para esta venda; aguarde o resultado antes de desistir'; END IF;
  IF r->>'situacao' = 'paga' THEN RAISE EXCEPTION 'A 1ª mensalidade já foi paga: use o cancelamento do Plano Semestral'; END IF;
  IF r->>'situacao' = 'nao_encontrada' THEN RAISE EXCEPTION 'Venda do Plano Semestral não encontrada'; END IF;
  RETURN r;
END $function$;
REVOKE ALL ON FUNCTION public.fn_semestral_desistir(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_semestral_desistir(uuid, text) TO authenticated, service_role;

-- Rotina diária: expira vendas abertas há mais de 7 dias; pagamento em andamento gera aviso à equipe.
CREATE OR REPLACE FUNCTION public.fn_semestral_expirar(p_data date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; x jsonb; n_exp int := 0; n_av int := 0;
BEGIN
  FOR r IN SELECT v.id, v.aluno_id FROM public.vendas v
            WHERE v.catalogo_id IN (SELECT id FROM public.planos_catalogo WHERE familia = 'semestral_2027')
              AND v.status_pagamento NOT IN ('pago','cancelado','estornado','falha')
              AND (v.created_at AT TIME ZONE 'America/Sao_Paulo')::date < p_data - 7
  LOOP
    x := public.fn_semestral_encerrar_sem_pagamento(r.id, 'Expirada: mais de 7 dias sem pagamento da 1ª mensalidade', 'venda_expirada', NULL);
    IF x->>'situacao' = 'encerrada' THEN n_exp := n_exp + 1;
    ELSIF x->>'situacao' IN ('pagamento_em_andamento','paga')
      AND NOT EXISTS (SELECT 1 FROM public.system_logs s WHERE s.modulo = 'planos-semestral' AND s.acao = 'expiracao_conferir'
                        AND s.payload->>'venda_id' = r.id::text) THEN
      PERFORM public.fn_pix_aut_avisar_equipe('Plano Semestral: conferir venda antes de expirar',
        'Venda do Plano Semestral aberta há mais de 7 dias com pagamento em andamento ou incerto. Não expirou: confira o resultado na Rede.',
        r.aluno_id, 'alta');
      INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
      VALUES ('planos-semestral', 'expiracao_conferir', 'Venda Semestral não expirada: pagamento em andamento', jsonb_build_object('venda_id', r.id, 'situacao', x->>'situacao'));
      n_av := n_av + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expiradas', n_exp, 'avisos', n_av);
END $function$;
REVOKE ALL ON FUNCTION public.fn_semestral_expirar(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_semestral_expirar(date) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_semestral_diario(p_data date DEFAULT CURRENT_DATE)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; n_enc int := 0; n_ger int := 0; v uuid; x jsonb;
BEGIN
  x := public.fn_semestral_expirar(p_data);
  FOR r IN SELECT k.id, k.plano_id FROM public.contratos k
           WHERE k.plano_tipo = 'semestral_2027' AND k.status = 'ativo' AND k.data_cancelamento IS NOT NULL AND k.data_fim <= p_data
  LOOP
    UPDATE public.contratos SET status = 'cancelado' WHERE id = r.id;
    UPDATE public.planos SET ativo = false WHERE id = r.plano_id AND ativo;
    n_enc := n_enc + 1;
  END LOOP;
  FOR r IN SELECT DISTINCT ON (m.venda_origem_id) m.venda_origem_id, m.status
           FROM public.planos_2027_mensalidades m JOIN public.contratos k ON k.id = m.contrato_id
           WHERE k.plano_tipo = 'semestral_2027' AND k.status = 'ativo' AND k.data_cancelamento IS NULL
           ORDER BY m.venda_origem_id, m.numero DESC
  LOOP
    IF r.status = 'pago' THEN
      v := public.fn_mensalidade_manual_proximo(r.venda_origem_id);
      IF v IS NOT NULL THEN n_ger := n_ger + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('data', p_data, 'encerrados', n_enc, 'mensalidades_geradas', n_ger,
    'vendas_expiradas', x->'expiradas', 'avisos_conferir', x->'avisos');
END $function$;