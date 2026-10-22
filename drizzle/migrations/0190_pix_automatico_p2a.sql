ALTER TABLE public.pix_recorrencias
  ADD COLUMN proposta_id uuid REFERENCES public.propostas_planos_2027(id),
  ADD COLUMN contrato_id uuid REFERENCES public.contratos(id),
  ADD COLUMN venda_id uuid,
  ADD COLUMN origem text NOT NULL DEFAULT 'equipe',
  ADD COLUMN codigo_numero smallint,
  ADD COLUMN codigo_expira_em timestamptz;
ALTER TABLE public.pix_recorrencias
  ADD CONSTRAINT pix_recorrencias_origem_chk CHECK (origem IN ('equipe','site_2027')),
  ADD CONSTRAINT pix_recorrencias_codigo_numero_chk CHECK (codigo_numero IS NULL OR codigo_numero BETWEEN 1 AND 3),
  ADD CONSTRAINT pix_recorrencias_site_proposta_chk CHECK (origem = 'equipe' OR proposta_id IS NOT NULL);
CREATE UNIQUE INDEX pix_recorrencias_proposta_viva_uidx ON public.pix_recorrencias (proposta_id)
  WHERE proposta_id IS NOT NULL AND status NOT IN ('CANCELADA','REJEITADA','EXPIRADA');

ALTER TABLE public.propostas_planos_2027
  ADD COLUMN pix_automatico boolean NOT NULL DEFAULT false,
  ADD COLUMN pix_aut_codigos smallint NOT NULL DEFAULT 0,
  ADD COLUMN pix_aut_estado text,
  ADD COLUMN pix_aut_atualizado_em timestamptz,
  ADD COLUMN notificacao_pix_aut_id uuid;
ALTER TABLE public.propostas_planos_2027
  ADD CONSTRAINT propostas_pix_aut_codigos_chk CHECK (pix_aut_codigos BETWEEN 0 AND 3),
  ADD CONSTRAINT propostas_pix_aut_estado_chk CHECK (pix_aut_estado IS NULL OR pix_aut_estado IN
    ('criando','aguardando','autorizada','recusada','vencida','esgotada','desconhecido','cancelada_pos_autorizacao')),
  ADD CONSTRAINT propostas_pix_aut_forma_chk CHECK (NOT pix_automatico OR forma_plano = 'recorrencia');

CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_liberado(p_proposta uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valor = 'true'::jsonb FROM sistema_config WHERE chave = 'planos_pix_automatico_ativo'), false)
     AND EXISTS (SELECT 1 FROM propostas_planos_2027 pr, sistema_config c
                  WHERE pr.id = p_proposta AND c.chave = 'planos_pix_automatico_planos'
                    AND jsonb_typeof(c.valor) = 'array'
                    AND c.valor ? replace(pr.familia, '_2027', ''))
$$;

CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_marcar(p_proposta uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record;
BEGIN
  SELECT * INTO pr FROM propostas_planos_2027 WHERE id = p_proposta FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'proposta_inexistente'); END IF;
  IF NOT fn_pix_automatico_2027_liberado(p_proposta) THEN RETURN jsonb_build_object('ok', false, 'erro', 'desligado'); END IF;
  IF pr.forma_plano <> 'recorrencia' THEN RETURN jsonb_build_object('ok', false, 'erro', 'forma_invalida'); END IF;
  IF pr.pago_em IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'ja_paga'); END IF;
  UPDATE propostas_planos_2027 SET pix_automatico = true WHERE id = p_proposta AND NOT pix_automatico;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_reservar(p_proposta uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; viva record;
BEGIN
  SELECT * INTO pr FROM propostas_planos_2027 WHERE id = p_proposta FOR UPDATE;
  IF NOT FOUND OR NOT pr.pix_automatico THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_pix_automatico'); END IF;
  IF NOT fn_pix_automatico_2027_liberado(p_proposta) THEN RETURN jsonb_build_object('ok', false, 'erro', 'desligado'); END IF;
  IF pr.pago_em IS NULL OR pr.aluno_ativado_id IS NULL OR pr.contrato_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'aguardando_pagamento');
  END IF;
  SELECT id, id_rec, status, codigo_expira_em INTO viva FROM pix_recorrencias
   WHERE proposta_id = p_proposta AND status NOT IN ('CANCELADA','REJEITADA','EXPIRADA');
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'acao', 'existente', 'id_rec', viva.id_rec, 'status', viva.status); END IF;
  IF pr.pix_aut_estado IN ('criando','desconhecido') THEN RETURN jsonb_build_object('ok', false, 'erro', 'em_andamento'); END IF;
  IF pr.pix_aut_codigos >= 3 THEN
    UPDATE propostas_planos_2027 SET pix_aut_estado = 'esgotada', pix_aut_atualizado_em = now() WHERE id = p_proposta;
    RETURN jsonb_build_object('ok', false, 'erro', 'esgotada');
  END IF;
  UPDATE propostas_planos_2027 SET pix_aut_codigos = pix_aut_codigos + 1, pix_aut_estado = 'criando', pix_aut_atualizado_em = now()
   WHERE id = p_proposta;
  RETURN jsonb_build_object('ok', true, 'acao', 'criar', 'codigo_numero', pr.pix_aut_codigos + 1,
    'aluno_id', pr.aluno_ativado_id, 'contrato_id', pr.contrato_id, 'cpf_hash', pr.cpf_hash);
END $$;

CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_registrar(
  p_proposta uuid, p_id_rec text, p_valor_minimo numeric, p_data_inicio date, p_expira timestamptz, p_raw jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr record; v_id uuid;
BEGIN
  SELECT * INTO pr FROM propostas_planos_2027 WHERE id = p_proposta FOR UPDATE;
  IF NOT FOUND OR pr.pix_aut_estado IS DISTINCT FROM 'criando' THEN RETURN jsonb_build_object('ok', false, 'erro', 'sem_reserva'); END IF;
  IF p_id_rec IS NULL OR p_valor_minimo <= 0 OR p_data_inicio IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'dados_invalidos'); END IF;
  INSERT INTO pix_recorrencias (aluno_id, id_rec, status, valor_minimo, periodicidade, data_inicio, politica_retentativa,
    raw_response, proposta_id, contrato_id, venda_id, origem, codigo_numero, codigo_expira_em)
  VALUES (pr.aluno_ativado_id, p_id_rec, 'AGUARDANDO_AUTORIZACAO', p_valor_minimo, 'MENSAL', p_data_inicio, 'PERMITE_3R_7D',
    p_raw, p_proposta, pr.contrato_id, pr.venda_id, 'site_2027', pr.pix_aut_codigos, p_expira)
  RETURNING id INTO v_id;
  UPDATE propostas_planos_2027 SET pix_aut_estado = 'aguardando', pix_aut_atualizado_em = now() WHERE id = p_proposta;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_falhou(p_proposta uuid, p_desconhecido boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE propostas_planos_2027
     SET pix_aut_estado = CASE WHEN p_desconhecido THEN 'desconhecido' ELSE NULL END,
         pix_aut_codigos = CASE WHEN p_desconhecido THEN pix_aut_codigos ELSE GREATEST(pix_aut_codigos - 1, 0) END,
         pix_aut_atualizado_em = now()
   WHERE id = p_proposta AND pix_aut_estado = 'criando'
$$;

CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_aviso(p_id_rec text, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_estado text;
BEGIN
  SELECT * INTO r FROM pix_recorrencias WHERE id_rec = p_id_rec AND origem = 'site_2027' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'nao_site'); END IF;
  IF r.status = p_status THEN RETURN jsonb_build_object('ok', true, 'acao', 'repetido'); END IF;
  IF r.status IN ('CANCELADA','REJEITADA','EXPIRADA') OR p_status NOT IN ('AUTORIZADA','REJEITADA','EXPIRADA','CANCELADA') THEN
    RETURN jsonb_build_object('ok', true, 'acao', 'ignorado', 'antes', r.status);
  END IF;
  UPDATE pix_recorrencias SET status = p_status, updated_at = now() WHERE id = r.id;
  v_estado := CASE p_status WHEN 'AUTORIZADA' THEN 'autorizada' WHEN 'REJEITADA' THEN 'recusada' WHEN 'EXPIRADA' THEN 'vencida'
                WHEN 'CANCELADA' THEN CASE WHEN r.status = 'AUTORIZADA' THEN 'cancelada_pos_autorizacao' ELSE 'vencida' END END;
  UPDATE propostas_planos_2027 SET pix_aut_estado = v_estado, pix_aut_atualizado_em = now() WHERE id = r.proposta_id;
  RETURN jsonb_build_object('ok', true, 'acao', 'atualizado', 'antes', r.status, 'depois', p_status, 'estado', v_estado, 'proposta_id', r.proposta_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_pix_automatico_2027_estado(p_proposta uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('pix_automatico', pr.pix_automatico, 'estado', pr.pix_aut_estado,
    'codigos_restantes', 3 - pr.pix_aut_codigos, 'liberado', fn_pix_automatico_2027_liberado(pr.id),
    'id_rec', r.id_rec, 'status_rec', r.status, 'expira_em', r.codigo_expira_em, 'primeiro_debito', r.data_inicio)
  FROM propostas_planos_2027 pr
  LEFT JOIN LATERAL (SELECT * FROM pix_recorrencias x WHERE x.proposta_id = pr.id ORDER BY x.created_at DESC LIMIT 1) r ON true
  WHERE pr.id = p_proposta
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['fn_pix_automatico_2027_liberado(uuid)','fn_pix_automatico_2027_marcar(uuid)',
    'fn_pix_automatico_2027_reservar(uuid)','fn_pix_automatico_2027_registrar(uuid,text,numeric,date,timestamptz,jsonb)',
    'fn_pix_automatico_2027_falhou(uuid,boolean)','fn_pix_automatico_2027_aviso(text,text)','fn_pix_automatico_2027_estado(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;