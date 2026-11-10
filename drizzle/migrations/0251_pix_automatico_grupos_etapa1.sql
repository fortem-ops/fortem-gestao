-- Pix Automático Etapa 1: uma autorização (pix_recorrencias) cobrindo 1+ itens do mesmo aluno.
-- Sem cobrança: nada aqui cria pix_cobrancas nem débito. Fluxo 2027 (fn_pix_automatico_2027_*) intocado.

CREATE TABLE IF NOT EXISTS public.pix_aut_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','aguardando_autorizacao','ativa','falha','cancelada')),
  recorrencia_id uuid REFERENCES public.pix_recorrencias(id),
  valor_soma numeric(12,2) NOT NULL CHECK (valor_soma > 0),
  valor_teto numeric(12,2) NOT NULL CHECK (valor_teto > 0),
  dia_debito date,
  codigos_gerados smallint NOT NULL DEFAULT 0 CHECK (codigos_gerados BETWEEN 0 AND 3),
  codigo_expira_em timestamptz,
  motivo text,
  criado_por uuid,
  autorizado_em timestamptz,
  cancelado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pix_aut_grupos_aluno_idx ON public.pix_aut_grupos(aluno_id);
CREATE UNIQUE INDEX IF NOT EXISTS pix_aut_grupos_rec_uidx ON public.pix_aut_grupos(recorrencia_id) WHERE recorrencia_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pix_aut_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.pix_aut_grupos(id) ON DELETE CASCADE,
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  item_tipo text NOT NULL CHECK (item_tipo IN ('contrato','plano')),
  contrato_id uuid REFERENCES public.contratos(id),
  plano_id uuid REFERENCES public.planos(id),
  descricao text,
  valor numeric(12,2) NOT NULL CHECK (valor > 0),
  forma_anterior text,
  ativo_desde timestamptz NOT NULL DEFAULT now(),
  ativo_ate timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pix_aut_itens_tipo_chk CHECK (
    (item_tipo = 'contrato' AND contrato_id IS NOT NULL AND plano_id IS NULL)
    OR (item_tipo = 'plano' AND plano_id IS NOT NULL AND contrato_id IS NULL))
);
CREATE INDEX IF NOT EXISTS pix_aut_itens_grupo_idx ON public.pix_aut_itens(grupo_id);
-- Um item só pode estar em um vínculo ativo (impede cobrança dupla por duas autorizações).
CREATE UNIQUE INDEX IF NOT EXISTS pix_aut_itens_contrato_ativo_uidx ON public.pix_aut_itens(contrato_id) WHERE ativo_ate IS NULL AND contrato_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pix_aut_itens_plano_ativo_uidx ON public.pix_aut_itens(plano_id) WHERE ativo_ate IS NULL AND plano_id IS NOT NULL;

-- Reserva do mês: preenchida só na Etapa 2 ao enviar a cobrança Pix; cartão deve ignorar linhas reservadas.
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS pix_aut_grupo_id uuid REFERENCES public.pix_aut_grupos(id);
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS pix_aut_grupo_id uuid REFERENCES public.pix_aut_grupos(id);
COMMENT ON COLUMN public.cobrancas.pix_aut_grupo_id IS 'Reserva Pix Automático do ciclo: quando preenchido, nenhum caminho de cartão cobra esta linha.';
COMMENT ON COLUMN public.vendas.pix_aut_grupo_id IS 'Reserva Pix Automático do ciclo (plano adicional sem contrato): quando preenchido, cartão não cobra.';

GRANT SELECT ON public.pix_aut_grupos TO authenticated;
GRANT SELECT ON public.pix_aut_itens TO authenticated;
GRANT ALL ON public.pix_aut_grupos TO service_role;
GRANT ALL ON public.pix_aut_itens TO service_role;

ALTER TABLE public.pix_aut_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_aut_itens ENABLE ROW LEVEL SECURITY;

-- Leitura: admin, coordenador e o próprio aluno. Escrita só pelas funções abaixo.
DROP POLICY IF EXISTS "pix_aut_grupos_select" ON public.pix_aut_grupos;
CREATE POLICY "pix_aut_grupos_select" ON public.pix_aut_grupos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador')
  OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.user_id = auth.uid()));
DROP POLICY IF EXISTS "pix_aut_itens_select" ON public.pix_aut_itens;
CREATE POLICY "pix_aut_itens_select" ON public.pix_aut_itens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador')
  OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_pix_aut_eh_service() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(auth.jwt()->>'role','') = 'service_role' OR current_user IN ('service_role','postgres')
$$;

-- Próximo vencimento de um item (contrato: cobrança pendente/atrasada; plano adicional: venda pendente ou renovação).
CREATE OR REPLACE FUNCTION public.fn_pix_aut_item_vencimento(p_tipo text, p_id uuid) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN p_tipo = 'contrato' THEN
    (SELECT min(b.data_vencimento) FROM cobrancas b WHERE b.contrato_id = p_id AND b.status IN ('pendente','atrasado'))
  ELSE
    coalesce((SELECT min(v.data_venda) FROM vendas v WHERE v.plano_id = p_id AND v.status_pagamento = 'pendente'),
             (SELECT p.proxima_renovacao FROM planos p WHERE p.id = p_id))
  END
$$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_item_vencimento(text, uuid) FROM PUBLIC, anon;

-- Itens que a equipe pode ligar ao Pix Automático (admin/coordenador leem).
CREATE OR REPLACE FUNCTION public.fn_pix_aut_itens_disponiveis(p_aluno uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordenador') OR public.fn_pix_aut_eh_service()) THEN
    RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'vencimento' NULLS LAST) FROM (
      SELECT jsonb_build_object(
        'tipo','contrato','id',c.id,
        'descricao', coalesce(p.tipo, c.plano_tipo),
        'valor', c.valor_cobrado,
        'forma_pagamento', c.forma_pagamento,
        'vencimento', public.fn_pix_aut_item_vencimento('contrato', c.id),
        'vinculado_grupo', (SELECT i.grupo_id FROM pix_aut_itens i WHERE i.contrato_id = c.id AND i.ativo_ate IS NULL)
      ) x
      FROM contratos c LEFT JOIN planos p ON p.id = c.plano_id
      WHERE c.aluno_id = p_aluno AND c.status IN ('ativo','inadimplente') AND coalesce(c.valor_cobrado,0) > 0
      UNION ALL
      SELECT jsonb_build_object(
        'tipo','plano','id',p.id,
        'descricao', p.tipo,
        'valor', p.valor,
        'forma_pagamento', p.forma_pagamento_padrao,
        'vencimento', public.fn_pix_aut_item_vencimento('plano', p.id),
        'vinculado_grupo', (SELECT i.grupo_id FROM pix_aut_itens i WHERE i.plano_id = p.id AND i.ativo_ate IS NULL)
      )
      FROM planos p
      WHERE p.aluno_id = p_aluno AND p.ativo = true AND coalesce(p.renovacao_automatica,false) = true
        AND coalesce(p.valor,0) > 0
        AND NOT EXISTS (SELECT 1 FROM contratos c WHERE c.plano_id = p.id)
    ) s
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_itens_disponiveis(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_itens_disponiveis(uuid) TO authenticated, service_role;

-- Cria o rascunho (só admin). Valores e vencimento vêm do banco, nunca da tela.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_grupo_criar(p_aluno uuid, p_itens jsonb, p_teto numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_grupo uuid; v_soma numeric := 0; v_dia date; v_it jsonb; v_tipo text; v_id uuid;
  v_valor numeric; v_desc text; v_venc date; v_n int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'itens_vazios';
  END IF;

  INSERT INTO pix_aut_grupos (aluno_id, status, valor_soma, valor_teto, criado_por)
  VALUES (p_aluno, 'rascunho', 0.01, 0.01, auth.uid()) RETURNING id INTO v_grupo;

  FOR v_it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_tipo := v_it->>'tipo'; v_id := (v_it->>'id')::uuid;
    IF v_tipo = 'contrato' THEN
      SELECT c.valor_cobrado, coalesce(p.tipo, c.plano_tipo) INTO v_valor, v_desc
      FROM contratos c LEFT JOIN planos p ON p.id = c.plano_id
      WHERE c.id = v_id AND c.aluno_id = p_aluno AND c.status IN ('ativo','inadimplente') FOR UPDATE OF c;
    ELSIF v_tipo = 'plano' THEN
      SELECT p.valor, p.tipo INTO v_valor, v_desc FROM planos p
      WHERE p.id = v_id AND p.aluno_id = p_aluno AND p.ativo = true
        AND NOT EXISTS (SELECT 1 FROM contratos c WHERE c.plano_id = p.id) FOR UPDATE;
    ELSE
      RAISE EXCEPTION 'tipo_invalido';
    END IF;
    IF v_valor IS NULL OR v_valor <= 0 THEN RAISE EXCEPTION 'item_invalido: %', v_id; END IF;

    BEGIN
      INSERT INTO pix_aut_itens (grupo_id, aluno_id, item_tipo, contrato_id, plano_id, descricao, valor)
      VALUES (v_grupo, p_aluno, v_tipo, CASE WHEN v_tipo='contrato' THEN v_id END, CASE WHEN v_tipo='plano' THEN v_id END, v_desc, v_valor);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'item_ja_vinculado: %', coalesce(v_desc, v_id::text);
    END;
    v_soma := v_soma + v_valor; v_n := v_n + 1;
    v_venc := public.fn_pix_aut_item_vencimento(v_tipo, v_id);
    IF v_venc IS NOT NULL AND (v_dia IS NULL OR v_venc < v_dia) THEN v_dia := v_venc; END IF;
  END LOOP;

  IF p_teto IS NULL OR p_teto < v_soma THEN RAISE EXCEPTION 'teto_abaixo_da_soma'; END IF;
  UPDATE pix_aut_grupos SET valor_soma = v_soma, valor_teto = round(p_teto, 2), dia_debito = v_dia WHERE id = v_grupo;

  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'criado', 'Rascunho criado', jsonb_build_object('grupo', v_grupo, 'aluno', p_aluno, 'itens', v_n, 'soma', v_soma, 'teto', p_teto));
  RETURN jsonb_build_object('grupo_id', v_grupo, 'soma', v_soma, 'teto', round(p_teto,2), 'dia_debito', v_dia, 'itens', v_n);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_grupo_criar(uuid, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_grupo_criar(uuid, jsonb, numeric) TO authenticated;

-- Reserva um novo código (até 3) — só o servidor, depois de conferir admin.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_grupo_reservar_codigo(p_grupo uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_old text;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'grupo_nao_encontrado'); END IF;
  IF g.status NOT IN ('rascunho','aguardando_autorizacao','falha') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'status_' || g.status);
  END IF;
  IF g.codigos_gerados >= 3 THEN RETURN jsonb_build_object('ok', false, 'erro', 'limite_codigos'); END IF;
  SELECT id_rec INTO v_old FROM pix_recorrencias WHERE id = g.recorrencia_id AND status IN ('CRIADA','AGUARDANDO_AUTORIZACAO');
  UPDATE pix_aut_grupos SET codigos_gerados = codigos_gerados + 1, updated_at = now() WHERE id = p_grupo;
  RETURN jsonb_build_object('ok', true, 'aluno_id', g.aluno_id, 'teto', g.valor_teto, 'dia_debito', g.dia_debito,
    'codigo_numero', g.codigos_gerados + 1, 'id_rec_anterior', v_old,
    'vinculo_ref', 'G' || replace(g.id::text, '-', ''));
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_grupo_reservar_codigo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_grupo_reservar_codigo(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_pix_aut_grupo_registrar_rec(p_grupo uuid, p_rec uuid, p_codigo smallint, p_expira timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  UPDATE pix_recorrencias SET codigo_numero = p_codigo, codigo_expira_em = p_expira WHERE id = p_rec;
  UPDATE pix_aut_grupos SET recorrencia_id = p_rec, status = 'aguardando_autorizacao', codigo_expira_em = p_expira, updated_at = now()
  WHERE id = p_grupo AND status IN ('rascunho','aguardando_autorizacao','falha');
  RETURN jsonb_build_object('ok', FOUND);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_grupo_registrar_rec(uuid, uuid, smallint, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_grupo_registrar_rec(uuid, uuid, smallint, timestamptz) TO service_role;

-- Libera itens e devolve a forma de pagamento anterior (só se ainda estiver em Pix Automático).
CREATE OR REPLACE FUNCTION public.fn_pix_aut_grupo_encerrar_interno(p_grupo uuid, p_status text, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE contratos c SET forma_pagamento = i.forma_anterior
  FROM pix_aut_itens i
  WHERE i.grupo_id = p_grupo AND i.ativo_ate IS NULL AND i.item_tipo = 'contrato'
    AND c.id = i.contrato_id AND c.forma_pagamento = 'pix_automatico' AND i.forma_anterior IS NOT NULL;
  UPDATE pix_aut_itens SET ativo_ate = now() WHERE grupo_id = p_grupo AND ativo_ate IS NULL;
  UPDATE pix_aut_grupos SET status = p_status, motivo = coalesce(p_motivo, motivo), cancelado_em = now(), updated_at = now() WHERE id = p_grupo;
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_grupo_encerrar_interno(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Aviso de status da recorrência (webhook, service_role). Idempotente; sem grupo não faz nada.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_rec_status(p_id_rec text, p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT gr.* INTO g FROM pix_aut_grupos gr JOIN pix_recorrencias r ON r.id = gr.recorrencia_id
  WHERE r.id_rec = p_id_rec FOR UPDATE OF gr;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'acao', 'sem_grupo'); END IF;
  IF g.status = 'cancelada' THEN RETURN jsonb_build_object('ok', true, 'acao', 'ignorado', 'grupo', g.id); END IF;

  IF p_status = 'AUTORIZADA' THEN
    IF g.status = 'ativa' THEN RETURN jsonb_build_object('ok', true, 'acao', 'repetido', 'grupo', g.id); END IF;
    UPDATE pix_aut_itens i SET forma_anterior = c.forma_pagamento
    FROM contratos c WHERE i.grupo_id = g.id AND i.ativo_ate IS NULL AND i.item_tipo = 'contrato' AND c.id = i.contrato_id
      AND c.forma_pagamento <> 'pix_automatico';
    UPDATE contratos c SET forma_pagamento = 'pix_automatico'
    FROM pix_aut_itens i WHERE i.grupo_id = g.id AND i.ativo_ate IS NULL AND i.item_tipo = 'contrato' AND c.id = i.contrato_id;
    UPDATE pix_aut_grupos SET status = 'ativa', autorizado_em = now(), updated_at = now() WHERE id = g.id;
  ELSIF p_status = 'CANCELADA' AND g.status = 'ativa' THEN
    PERFORM public.fn_pix_aut_grupo_encerrar_interno(g.id, 'cancelada', 'Cancelada pelo pagador ou banco');
  ELSIF p_status IN ('CANCELADA','REJEITADA','EXPIRADA') THEN
    UPDATE pix_aut_grupos SET status = 'falha', motivo = 'Autorização ' || lower(p_status), updated_at = now() WHERE id = g.id;
  ELSE
    RETURN jsonb_build_object('ok', true, 'acao', 'ignorado', 'grupo', g.id);
  END IF;
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'status', p_id_rec || ': ' || g.status || ' -> ' || p_status, jsonb_build_object('grupo', g.id, 'antes', g.status, 'aviso', p_status));
  RETURN jsonb_build_object('ok', true, 'acao', 'atualizado', 'grupo', g.id);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_rec_status(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_rec_status(text, text) TO service_role;

-- Cancelamento pela equipe (só admin). O cancelamento no Inter, se houver recorrência, é feito antes pela tela.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_grupo_cancelar(p_grupo uuid, p_motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_rec_status text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM pix_aut_grupos WHERE id = p_grupo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'grupo_nao_encontrado'; END IF;
  IF g.status = 'cancelada' THEN RETURN jsonb_build_object('ok', true, 'acao', 'repetido'); END IF;
  SELECT status INTO v_rec_status FROM pix_recorrencias WHERE id = g.recorrencia_id;
  IF v_rec_status IN ('CRIADA','AGUARDANDO_AUTORIZACAO','AUTORIZADA') THEN
    RAISE EXCEPTION 'cancelar_no_banco_primeiro';
  END IF;
  PERFORM public.fn_pix_aut_grupo_encerrar_interno(p_grupo, 'cancelada', coalesce(p_motivo, 'Cancelada pela equipe'));
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'cancelado_equipe', coalesce(p_motivo,''), jsonb_build_object('grupo', p_grupo, 'por', auth.uid()));
  RETURN jsonb_build_object('ok', true, 'acao', 'cancelado');
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_grupo_cancelar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_grupo_cancelar(uuid, text) TO authenticated;
