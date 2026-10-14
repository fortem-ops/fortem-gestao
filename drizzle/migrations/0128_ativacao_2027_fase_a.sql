CREATE OR REPLACE FUNCTION public.fn_venda_2027_gravar(p jsonb, p_uid uuid, p_teste boolean, p_origem text, p_canal text, p_sem_cobrancas boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := p_uid;
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_forma text := p->>'forma';
  v_n int := COALESCE((p->>'parcelas')::int, 1);
  v_forma_s text := COALESCE(p->>'forma_servicos', 'pix_vista');
  v_n_s int := COALESCE((p->>'parcelas_servicos')::int, 1);
  v_ini date := COALESCE((p->>'data_inicio')::date, CURRENT_DATE);
  v_venc date;
  v_idem text := NULLIF(p->>'idempotency_key', '');
  v_substituir boolean := COALESCE((p->>'substituir')::boolean, false);
  v_obs text := NULLIF(btrim(COALESCE(p->>'observacoes', '')), '');
  v_teste boolean;
  v_origem text;
  c record;
  s record;
  v_ehstart boolean; v_ehmensal boolean;
  v_valor_c bigint; v_taxa_c bigint := 0; v_serv_c bigint := 0; v_mensal_c bigint;
  v_plano_total_c bigint; v_total_c bigint; v_base bigint; v_pbase bigint; v_parc bigint; v_pparc bigint;
  v_embutir boolean;
  v_venda_id uuid; v_plano_id uuid; v_contrato_id uuid;
  v_serv_vendas jsonb := '[]'::jsonb;
  v_serv_ids uuid[] := ARRAY[]::uuid[];
  v_sid uuid; v_comp jsonb; v_cred uuid;
  v_fim_plano date; v_fim_ciclo date; v_valid12 date;
  v_freq smallint; v_qtd int; i int; m int; k int;
  v_forma_venda text; v_forma_contrato text;
  v_existente uuid;
BEGIN
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;

  IF v_idem IS NOT NULL THEN
    SELECT id INTO v_existente FROM public.vendas WHERE idempotency_key = v_idem AND tipo = 'plano' LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RETURN jsonb_build_object('venda_id', v_existente, 'repetida', true);
    END IF;
  END IF;

  SELECT * INTO c FROM public.planos_catalogo WHERE id = (p->>'catalogo_id')::uuid AND versao = 2027;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item 2027 não encontrado'; END IF;

  v_teste := COALESCE(p_teste, false);
  v_origem := p_origem;

  IF NOT v_teste AND NOT (c.ativo AND (c.vendavel_desde IS NULL OR c.vendavel_desde <= CURRENT_DATE)
                          AND (c.vendavel_ate IS NULL OR c.vendavel_ate >= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Plano 2027 ainda não liberado para venda';
  END IF;

  v_ehstart := c.familia = 'start_2027';
  v_ehmensal := c.modalidade_cobranca = 'recorrencia_mensal';

  IF v_ehstart AND NOT v_ehmensal THEN RAISE EXCEPTION 'Start 2027 é só recorrência mensal'; END IF;
  IF v_ehmensal AND v_forma <> 'recorrencia' THEN RAISE EXCEPTION 'Item mensal só pode ser vendido em recorrência'; END IF;
  IF NOT v_ehmensal AND v_forma NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF v_forma = 'cartao_parcelado' AND (v_n < 1 OR v_n > 12) THEN RAISE EXCEPTION 'Parcelas devem ser entre 1 e 12'; END IF;
  IF v_forma = 'pix_vista' THEN v_n := 1; END IF;
  IF v_forma = 'recorrencia' THEN v_n := CASE WHEN v_ehstart THEN 1 ELSE 12 END; END IF;
  IF v_forma_s NOT IN ('cartao_parcelado','pix_vista') THEN RAISE EXCEPTION 'Forma de pagamento dos serviços inválida'; END IF;
  IF v_forma_s = 'pix_vista' THEN v_n_s := 1; END IF;
  IF v_n_s < 1 OR v_n_s > 6 THEN RAISE EXCEPTION 'Parcelas dos serviços devem ser entre 1 e 6'; END IF;

  v_venc := COALESCE((p->>'primeiro_vencimento')::date, v_ini);
  IF v_venc < v_ini THEN RAISE EXCEPTION 'Primeiro vencimento não pode ser antes do início'; END IF;

  v_valor_c := round(c.valor * 100);
  IF v_ehmensal AND NOT v_ehstart THEN v_taxa_c := round(COALESCE(c.taxa_recorrencia, 0) * 100); END IF;
  IF jsonb_array_length(COALESCE(p->'servicos', '[]'::jsonb)) <> (
       SELECT count(*) FROM jsonb_array_elements_text(COALESCE(p->'servicos', '[]'::jsonb)) x(id)
       JOIN public.servicos_catalogo sc ON sc.id = x.id::uuid AND sc.versao = 2027) THEN
    RAISE EXCEPTION 'Serviço 2027 não encontrado';
  END IF;
  SELECT COALESCE(sum(round(sc.valor * 100)), 0) INTO v_serv_c
  FROM jsonb_array_elements_text(COALESCE(p->'servicos', '[]'::jsonb)) x(id)
  JOIN public.servicos_catalogo sc ON sc.id = x.id::uuid AND sc.versao = 2027;
  v_embutir := NOT v_ehmensal;
  v_mensal_c := v_valor_c + v_taxa_c;
  v_plano_total_c := CASE WHEN v_ehstart THEN v_mensal_c WHEN v_ehmensal THEN v_mensal_c * 12 ELSE v_valor_c END;

  v_fim_plano := CASE WHEN v_ehstart THEN (v_ini + interval '1 month')::date ELSE (v_ini + interval '12 months')::date END;
  v_fim_ciclo := (v_ini + interval '1 month' - interval '1 day')::date;
  v_valid12 := (v_ini + interval '12 months')::date;
  v_freq := CASE WHEN c.frequencia::text = 'livre' THEN 5 ELSE NULLIF(regexp_replace(c.frequencia::text, '\D', '', 'g'), '')::smallint END;
  v_qtd := COALESCE(c.quantidade_creditos, 0);

  v_forma_venda := CASE v_forma WHEN 'recorrencia' THEN 'cartao_recorrencia' WHEN 'cartao_parcelado' THEN 'cartao_credito' ELSE 'pix' END;
  v_forma_contrato := CASE v_forma WHEN 'recorrencia' THEN 'cartao_recorrencia' WHEN 'cartao_parcelado' THEN 'cartao_parcelado' ELSE 'dinheiro' END;

  IF v_substituir THEN
    UPDATE public.contratos SET status = 'encerrado',
      observacoes = COALESCE(observacoes || ' | ', '') || 'Encerrado: substituído por venda 2027 em ' || CURRENT_DATE
    WHERE aluno_id = v_aluno AND status IN ('ativo','suspenso')
      AND plano_id IN (SELECT id FROM public.planos WHERE aluno_id = v_aluno AND ativo AND atividade = 'treinamento_funcional');
    UPDATE public.planos SET ativo = false
    WHERE aluno_id = v_aluno AND ativo AND atividade = 'treinamento_funcional';
  END IF;

  INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
    forma_pagamento, parcelas, vendedor_id, status_pagamento, observacoes, data_venda,
    tipo_cobranca, taxa_mensal, modalidade_pagamento, canal_pagamento, origem, idempotency_key)
  VALUES (v_aluno, 'plano', c.id, COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
    v_plano_total_c / 100.0, 0, v_plano_total_c / 100.0,
    v_forma_venda, v_n, v_uid, 'pendente', v_obs, v_ini,
    CASE WHEN v_forma = 'recorrencia' THEN 'recorrencia' ELSE 'tradicional' END,
    v_taxa_c / 100.0, v_forma, p_canal, v_origem, v_idem)
  RETURNING id INTO v_venda_id;

  INSERT INTO public.planos (aluno_id, tipo, data_inicio, duracao_meses, valor, ativo, servicos, atividade,
    data_fim, catalogo_id, plano_codigo, forma_pagamento_padrao, parcelas_padrao, renovacao_automatica, observacoes)
  VALUES (v_aluno, c.nome, v_ini, CASE WHEN v_ehstart THEN 1 ELSE 12 END, v_plano_total_c / 100.0, true, ARRAY[]::text[], 'treinamento_funcional',
    v_fim_plano, c.id, c.codigo, v_forma_venda, v_n, v_ehstart,
    CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_plano_id;
  UPDATE public.vendas SET plano_id = v_plano_id WHERE id = v_venda_id;
  IF v_ehstart THEN UPDATE public.planos SET proxima_renovacao = v_fim_plano WHERE id = v_plano_id; END IF;

  FOR s IN
    SELECT sc.*, x.ord FROM jsonb_array_elements_text(COALESCE(p->'servicos', '[]'::jsonb)) WITH ORDINALITY x(id, ord)
    JOIN public.servicos_catalogo sc ON sc.id = x.id::uuid ORDER BY x.ord
  LOOP
    INSERT INTO public.vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, desconto, valor_final,
      forma_pagamento, parcelas, vendedor_id, status_pagamento, data_venda, tipo_cobranca,
      modalidade_pagamento, canal_pagamento, origem, plano_id, idempotency_key)
    VALUES (v_aluno, 'servico', s.id, s.nome, s.valor, 0, s.valor,
      CASE WHEN v_embutir THEN v_forma_venda WHEN v_forma_s = 'pix_vista' THEN 'pix' ELSE 'cartao_credito' END,
      CASE WHEN v_embutir THEN v_n ELSE v_n_s END, v_uid, 'pendente', v_ini, 'tradicional',
      CASE WHEN v_embutir THEN v_forma ELSE v_forma_s END, p_canal, v_origem, v_plano_id,
      CASE WHEN v_idem IS NOT NULL THEN v_idem || ':s' || s.ord END)
    RETURNING id INTO v_sid;
    v_serv_ids := v_serv_ids || v_sid;
    v_serv_vendas := v_serv_vendas || jsonb_build_object('venda_id', v_sid, 'codigo', s.codigo, 'valor', s.valor);

    FOR v_comp IN SELECT * FROM jsonb_array_elements(COALESCE(s.composicao, jsonb_build_array(jsonb_build_object('atividade', s.atividade, 'quantidade', s.quantidade_sessoes))))
    LOOP
      INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado, data_validade)
      VALUES (v_aluno, 'servico', v_sid, v_comp->>'atividade', (v_comp->>'quantidade')::int, false,
              (v_ini + make_interval(months => COALESCE(s.validade_meses, 12)))::date)
      RETURNING id INTO v_cred;
      INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
      VALUES (v_cred, 'compra', (v_comp->>'quantidade')::int, v_uid, 'Serviço 2027: ' || s.nome);
    END LOOP;
  END LOOP;

  DELETE FROM public.cobrancas WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano_id);
  DELETE FROM public.ciclos_credito WHERE contrato_id IN (SELECT id FROM public.contratos WHERE plano_id = v_plano_id);
  DELETE FROM public.contratos WHERE plano_id = v_plano_id;

  v_total_c := v_plano_total_c + CASE WHEN v_embutir THEN v_serv_c ELSE 0 END;

  INSERT INTO public.contratos (aluno_id, plano_id, plano_tipo, frequencia_semanal, creditos_total,
    vigencia_tipo, data_inicio, data_fim, forma_pagamento, valor_base, valor_cobrado, taxa_recorrencia,
    parcelas, status, criado_por, servicos_inclusos, catalogo_id, observacoes)
  VALUES (v_aluno, v_plano_id, c.familia, v_freq, v_qtd,
    CASE WHEN v_ehstart THEN 'mensal' ELSE 'anual' END, v_ini, v_fim_plano, v_forma_contrato,
    v_plano_total_c / 100.0, v_total_c / 100.0, v_taxa_c / 100.0,
    v_n, 'ativo', v_uid, jsonb_build_object('servicos_2027', v_serv_vendas), c.id,
    CASE WHEN v_teste THEN 'TESTE 2027' END)
  RETURNING id INTO v_contrato_id;

  INSERT INTO public.ciclos_credito (contrato_id, creditos_liberados, data_inicio, data_fim, status)
  VALUES (v_contrato_id, v_qtd, v_ini, CASE WHEN v_ehstart THEN v_fim_ciclo ELSE v_fim_plano END, 'ativo');

  IF p_sem_cobrancas THEN
    NULL; -- venda do site: cobranças espelho ficam para a fase B
  ELSIF v_ehmensal THEN
    FOR i IN 1..(CASE WHEN v_ehstart THEN 1 ELSE 12 END) LOOP
      INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
        forma_pagamento, meio_registro, descricao, composicao)
      VALUES (v_contrato_id, v_aluno, i, v_mensal_c / 100.0, (v_venc + make_interval(months => i - 1))::date, 'pendente',
        v_forma_venda, 'manual_admin', CASE WHEN v_ehstart THEN 'Mensalidade ciclo ' || to_char(v_ini, 'DD/MM/YYYY') ELSE 'Mensalidade ' || i || '/12' END || ' — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text,
        jsonb_build_object('plano', v_mensal_c / 100.0, 'servicos', 0, 'servicos_vendas', '[]'::jsonb));
    END LOOP;
  ELSE
    v_base := (v_plano_total_c + v_serv_c) / v_n;
    v_pbase := v_plano_total_c / v_n;
    FOR i IN 1..v_n LOOP
      v_parc := CASE WHEN i = v_n THEN (v_plano_total_c + v_serv_c) - v_base * (v_n - 1) ELSE v_base END;
      v_pparc := CASE WHEN i = v_n THEN v_plano_total_c - v_pbase * (v_n - 1) ELSE v_pbase END;
      INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
        forma_pagamento, meio_registro, descricao, composicao)
      VALUES (v_contrato_id, v_aluno, i, v_parc / 100.0, (v_venc + make_interval(months => i - 1))::date, 'pendente',
        v_forma_venda, 'manual_admin',
        'Parcela ' || i || '/' || v_n || ' — ' || COALESCE(c.nome_exibicao, c.nome) || ' ' || c.frequencia::text
          || CASE WHEN v_serv_c > 0 THEN ' + serviços' ELSE '' END,
        jsonb_build_object('plano', v_pparc / 100.0, 'servicos', (v_parc - v_pparc) / 100.0, 'servicos_vendas', v_serv_vendas));
    END LOOP;
  END IF;

  IF NOT p_sem_cobrancas AND NOT v_embutir AND v_serv_c > 0 THEN
    v_base := v_serv_c / v_n_s;
    FOR i IN 1..v_n_s LOOP
      v_parc := CASE WHEN i = v_n_s THEN v_serv_c - v_base * (v_n_s - 1) ELSE v_base END;
      INSERT INTO public.cobrancas (contrato_id, aluno_id, numero_ciclo, valor, data_vencimento, status,
        forma_pagamento, meio_registro, descricao, composicao)
      VALUES (v_contrato_id, v_aluno, 100 + i, v_parc / 100.0, (v_venc + make_interval(months => i - 1))::date, 'pendente',
        CASE WHEN v_forma_s = 'pix_vista' THEN 'pix' ELSE 'cartao_credito' END, 'manual_admin',
        'Serviços ' || i || '/' || v_n_s,
        jsonb_build_object('plano', 0, 'servicos', v_parc / 100.0, 'servicos_vendas', v_serv_vendas));
    END LOOP;
  END IF;

  IF v_ehstart THEN
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (v_aluno, 'plano', v_venda_id, 'Treino', v_qtd, COALESCE(c.ilimitado, false), v_fim_ciclo, v_ini, 0)
    RETURNING id INTO v_cred;
  ELSE
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, reposicao_pct)
    VALUES (v_aluno, 'plano', v_venda_id, 'Treino', v_qtd, COALESCE(c.ilimitado, false), v_valid12,
      CASE WHEN COALESCE(c.ilimitado, false) THEN 0 ELSE COALESCE(c.reposicao_saldo_pct, 0) END)
    RETURNING id INTO v_cred;
  END IF;
  INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
  VALUES (v_cred, 'compra', v_qtd, v_uid, 'Plano 2027: ' || c.codigo);

  k := 0;
  FOR m IN SELECT unnest(COALESCE(c.avaliacoes_funcionais_meses, '{}'::int[])) LOOP
    k := k + 1;
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (v_aluno, 'plano', CASE WHEN k = 1 THEN v_venda_id ELSE v_plano_id END, 'Avaliação Funcional', 1, false,
      v_valid12, (v_ini + make_interval(months => m - 1))::date, 0)
    RETURNING id INTO v_cred;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (v_cred, 'compra', 1, v_uid, 'Avaliação Funcional ' || m || 'º mês — ' || c.codigo);
  END LOOP;

  IF COALESCE(c.bota_compressao_mes, 0) > 0 THEN
    INSERT INTO public.creditos_aluno (aluno_id, origem_tipo, origem_id, atividade, quantidade_inicial, ilimitado,
      data_validade, competencia, reposicao_pct)
    VALUES (v_aluno, 'plano', v_venda_id, 'Bota de compressão', c.bota_compressao_mes, false, v_fim_ciclo, v_ini, 0)
    RETURNING id INTO v_cred;
    INSERT INTO public.creditos_movimentos (credito_id, tipo, quantidade, registrado_por, observacao)
    VALUES (v_cred, 'compra', c.bota_compressao_mes, v_uid, 'Bota de compressão — ' || c.codigo);
  END IF;

  RETURN jsonb_build_object('venda_id', v_venda_id, 'plano_id', v_plano_id, 'contrato_id', v_contrato_id,
    'servico_venda_ids', to_jsonb(v_serv_ids), 'teste', v_teste);
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_venda_2027_gravar(jsonb, uuid, boolean, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_venda_2027_gravar(jsonb, uuid, boolean, text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_venda_2027_criar(p jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_aluno uuid := (p->>'aluno_id')::uuid;
  v_teste boolean;
BEGIN
  IF v_uid IS NULL OR NOT (public.is_admin(v_uid) OR public.has_role(v_uid, 'coordenador'::app_role) OR public.has_role(v_uid, 'professor'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para vender planos 2027';
  END IF;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Aluno não informado'; END IF;
  v_teste := EXISTS (
    SELECT 1 FROM public.sistema_config sc
    WHERE sc.chave = 'vendas_2027_teste_aluno_ids'
      AND jsonb_typeof(sc.valor) = 'array'
      AND sc.valor ? v_aluno::text
  );
  RETURN public.fn_venda_2027_gravar(p, v_uid, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'manual' END, 'manual', false);
END;
$function$;

ALTER TABLE public.propostas_planos_2027
  ADD COLUMN IF NOT EXISTS aluno_ativado_id uuid,
  ADD COLUMN IF NOT EXISTS venda_id uuid,
  ADD COLUMN IF NOT EXISTS contrato_id uuid,
  ADD COLUMN IF NOT EXISTS ativada_em timestamptz,
  ADD COLUMN IF NOT EXISTS ativacao_vinculo text,
  ADD COLUMN IF NOT EXISTS ativacao_erro text,
  ADD COLUMN IF NOT EXISTS ativacao_erro_em timestamptz,
  ADD COLUMN IF NOT EXISTS notificacao_ativacao_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS propostas_planos_2027_venda_uidx ON public.propostas_planos_2027(venda_id) WHERE venda_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_ativar(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r public.propostas_planos_2027; c public.planos_catalogo; ac public.propostas_2027_aceites;
  v_teste boolean; v_aluno uuid; v_vinc text; v_cnt int; v_forma text; v_servs jsonb; v_res jsonb;
  v_ini date; v_ct jsonb; v_contrato uuid; v_venda uuid; v_status text;
BEGIN
  SELECT * INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF r.ativada_em IS NOT NULL THEN
    RETURN jsonb_build_object('ja_ativada', true, 'venda_id', r.venda_id, 'contrato_id', r.contrato_id, 'aluno_id', r.aluno_ativado_id);
  END IF;
  IF r.pago_em IS NULL THEN RAISE EXCEPTION 'Proposta sem pagamento confirmado'; END IF;
  v_teste := r.teste_admin OR public.fn_checkout_2027_teste(r.id);
  v_ct := coalesce(r.contratante, '{}'::jsonb);

  IF v_teste THEN
    SELECT a.id INTO v_aluno FROM public.alunos a, public.sistema_config sc
     WHERE a.nome = 'NICOLAS TESTE' AND sc.chave = 'vendas_2027_teste_aluno_ids' AND sc.valor ? a.id::text
     ORDER BY a.created_at LIMIT 1;
    IF v_aluno IS NULL THEN RAISE EXCEPTION 'Cadastro de teste não encontrado'; END IF;
    v_vinc := 'teste';
  ELSIF r.aluno_id IS NOT NULL AND r.verificacao_id IS NOT NULL THEN
    v_aluno := r.aluno_id; v_vinc := 'verificado';
  ELSIF r.cpf_hash IS NOT NULL AND EXISTS (SELECT 1 FROM public.alunos WHERE cpf_hash = r.cpf_hash) THEN
    SELECT count(*), min(id::text)::uuid INTO v_cnt, v_aluno FROM public.alunos WHERE cpf_hash = r.cpf_hash;
    IF v_cnt > 1 THEN RAISE EXCEPTION 'CPF em mais de um cadastro: vincular manualmente'; END IF;
    v_vinc := 'cpf';
  ELSE
    IF r.cpf_hash IS NULL THEN RAISE EXCEPTION 'Proposta sem CPF do contratante'; END IF;
    INSERT INTO public.alunos (nome, email, telefone, data_nascimento, status, cep, logradouro, numero, complemento,
      bairro, cidade, uf, rg, cpf_hash, cpf_ultimos3, observacoes)
    VALUES (coalesce(nullif(v_ct->>'nome',''), r.nome), coalesce(nullif(v_ct->>'email',''), r.email), r.whatsapp,
      nullif(v_ct->>'data_nascimento','')::date, 'ativo', v_ct->>'cep', v_ct->>'logradouro', v_ct->>'numero',
      v_ct->>'complemento', v_ct->>'bairro', v_ct->>'cidade', v_ct->>'uf', nullif(v_ct->>'rg',''),
      r.cpf_hash, r.cpf_ultimos3, 'Cadastro criado pela compra no site (/planos)')
    RETURNING id INTO v_aluno;
    v_vinc := 'novo';
  END IF;

  IF NOT v_teste THEN
    SELECT status INTO v_status FROM public.alunos WHERE id = v_aluno;
    IF v_status IS DISTINCT FROM 'ativo' THEN UPDATE public.alunos SET status = 'ativo' WHERE id = v_aluno; END IF;
  END IF;

  SELECT * INTO c FROM public.planos_catalogo WHERE codigo = r.plano_codigo AND versao = 2027;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item 2027 da proposta não encontrado'; END IF;
  SELECT coalesce(jsonb_agg(sc.id ORDER BY x.ord), '[]'::jsonb), count(*) INTO v_servs, v_cnt
    FROM unnest(coalesce(r.servicos_codigos, ARRAY[]::text[])) WITH ORDINALITY x(cod, ord)
    JOIN public.servicos_catalogo sc ON sc.codigo = x.cod AND sc.versao = 2027;
  IF v_cnt <> coalesce(array_length(r.servicos_codigos, 1), 0) THEN RAISE EXCEPTION 'Serviço 2027 da proposta não encontrado'; END IF;

  v_forma := CASE WHEN r.pagamento_tipo = 'pix' THEN 'pix_vista' ELSE r.forma_plano END;
  v_ini := (r.pago_em AT TIME ZONE 'America/Sao_Paulo')::date;

  v_res := public.fn_venda_2027_gravar(jsonb_build_object(
      'aluno_id', v_aluno, 'catalogo_id', c.id, 'forma', v_forma,
      'parcelas', coalesce(r.pagamento_parcelas, r.parcelas_plano, 1),
      'servicos', v_servs, 'forma_servicos', coalesce(r.forma_servicos, 'pix_vista'),
      'parcelas_servicos', coalesce(r.parcelas_servicos, 1),
      'data_inicio', v_ini, 'idempotency_key', 'planos:' || r.id,
      'observacoes', 'Venda do site /planos — proposta ' || left(r.id::text, 8)),
    NULL, v_teste, CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END, 'online', true);

  v_venda := (v_res->>'venda_id')::uuid;
  v_contrato := coalesce((v_res->>'contrato_id')::uuid, (SELECT k.id FROM public.contratos k JOIN public.vendas v ON v.plano_id = k.plano_id WHERE v.id = v_venda ORDER BY k.created_at DESC LIMIT 1));

  IF r.aceite_id IS NOT NULL THEN
    SELECT * INTO ac FROM public.propostas_2027_aceites WHERE id = r.aceite_id;
    IF FOUND THEN
      INSERT INTO public.contratos_documentos (contrato_id, aluno_id, template_id, template_versao, regulamento_versao,
        conteudo_gerado, variaveis_utilizadas, aceite, data_aceite, formato_aceite, ip_aceite, hash_texto, user_agent, origem, proposta_id)
      VALUES (v_contrato, v_aluno, ac.template_id, ac.template_versao, ac.regulamento_versao, ac.conteudo_html,
        ac.variaveis, true, ac.aceito_em, 'site', ac.ip, ac.hash_texto, ac.user_agent,
        CASE WHEN v_teste THEN 'teste_2027' ELSE 'site_2027' END, r.id)
      ON CONFLICT (proposta_id) WHERE proposta_id IS NOT NULL DO NOTHING;
    END IF;
  END IF;

  UPDATE public.planos_2027_mensalidades SET contrato_id = v_contrato WHERE proposta_id = r.id AND contrato_id IS NULL;

  UPDATE public.propostas_planos_2027 SET aluno_ativado_id = v_aluno, venda_id = v_venda, contrato_id = v_contrato,
    ativada_em = now(), ativacao_vinculo = v_vinc, ativacao_erro = NULL, ativacao_erro_em = NULL,
    aluno_id = CASE WHEN v_teste THEN aluno_id ELSE coalesce(aluno_id, v_aluno) END
  WHERE id = r.id;

  RETURN jsonb_build_object('ativada', true, 'aluno_id', v_aluno, 'vinculo', v_vinc, 'venda_id', v_venda,
    'contrato_id', v_contrato, 'teste', v_teste, 'corrida_pendente', coalesce(r.corrida, false));
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_ativar_seguro(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_msg text; v_criador uuid; v_notif uuid; r record;
BEGIN
  BEGIN
    RETURN public.fn_checkout_2027_ativar(p_proposta_id);
  EXCEPTION WHEN OTHERS THEN
    v_msg := left(SQLERRM, 300);
  END;
  UPDATE public.propostas_planos_2027 SET ativacao_erro = v_msg, ativacao_erro_em = now() WHERE id = p_proposta_id;
  INSERT INTO public.system_logs (modulo, acao, mensagem, payload)
  VALUES ('planos-ativacao', 'ativacao_falhou', v_msg, jsonb_build_object('proposta_id', p_proposta_id));
  SELECT id, nome, teste_admin, notificacao_ativacao_id INTO r FROM public.propostas_planos_2027 WHERE id = p_proposta_id;
  IF FOUND AND r.notificacao_ativacao_id IS NULL THEN
    SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
    IF v_criador IS NOT NULL THEN
      INSERT INTO public.notificacoes (titulo, descricao, categoria, prioridade, tipo, criado_por)
      VALUES (CASE WHEN r.teste_admin THEN '[TESTE] ' ELSE '' END || 'Compra do site paga — ativação pendente: ' || coalesce(r.nome, 'sem nome'),
        'O pagamento está confirmado, mas o cadastro do plano não foi criado automaticamente.' || E'\n'
        || 'Motivo: ' || v_msg || E'\n' || 'Use "Ativar agora" na lista de propostas do site.',
        'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
      INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
      SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
      UPDATE public.propostas_planos_2027 SET notificacao_ativacao_id = v_notif WHERE id = p_proposta_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('erro', v_msg);
END $function$;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_ativar_admin(p_proposta_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  RETURN public.fn_checkout_2027_ativar_seguro(p_proposta_id);
END $function$;

REVOKE ALL ON FUNCTION public.fn_checkout_2027_ativar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_ativar_seguro(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_ativar(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_ativar_seguro(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fn_checkout_2027_ativar_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_checkout_2027_ativar_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_checkout_2027_pos_pagamento(p_proposta_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d jsonb; v_criador uuid; v_notif uuid; v_titulo text; v_desc text; v_forma text; v_vinc text; v_teste boolean;
BEGIN
  -- Ativação automática logo após a baixa (falha nunca desfaz o pagamento).
  IF EXISTS (SELECT 1 FROM public.propostas_planos_2027 WHERE id = p_proposta_id AND pago_em IS NOT NULL AND ativada_em IS NULL) THEN
    PERFORM public.fn_checkout_2027_ativar_seguro(p_proposta_id);
  END IF;
  IF EXISTS (SELECT 1 FROM public.propostas_planos_2027 WHERE id = p_proposta_id AND (pago_em IS NULL OR notificacao_pagamento_id IS NOT NULL)) THEN
    RETURN NULL;
  END IF;
  d := public.fn_checkout_2027_email_dados(p_proposta_id);
  IF d IS NULL THEN RETURN NULL; END IF;
  SELECT ur.user_id INTO v_criador FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1;
  IF v_criador IS NULL THEN RETURN NULL; END IF;
  v_teste := coalesce((d->>'teste_admin')::boolean, false) OR public.fn_checkout_2027_teste(p_proposta_id);
  v_forma := CASE WHEN d->>'pagamento_tipo' = 'pix' THEN 'Pix à vista' ELSE 'Cartão em ' || (d->>'parcelas') || 'x' END;
  v_vinc := CASE d->>'vinculo' WHEN 'aluno' THEN 'aluno vinculado (verificado por e-mail)'
    WHEN 'suspeito' THEN 'possível cadastro existente, confira' ELSE 'novo cadastro' END;
  v_titulo := CASE WHEN v_teste THEN '[TESTE] ' ELSE '' END
    || 'Nova compra do site — pagamento aprovado: ' || coalesce(d->>'nome', 'sem nome');
  v_desc := coalesce(d->>'plano','') || ' ' || coalesce(d->>'frequencia','') || ' · ' || coalesce(d->>'servicos', 'sem serviços') || E'\n'
    || 'Pagamento: ' || v_forma || ' · Total R$ ' || translate(to_char((d->>'total_centavos')::numeric / 100, 'FM999,999,990.00'), ',.', '.,')
    || ' · aprovado em ' || to_char(((d->>'pago_em')::timestamptz) AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || E'\n'
    || 'Vínculo: ' || v_vinc || E'\n'
    || 'CPF final ' || coalesce(d->>'cpf_ultimos3', '---') || ' · WhatsApp ' || coalesce(d->>'whatsapp', '-') || E'\n\n'
    || CASE WHEN EXISTS (SELECT 1 FROM public.propostas_planos_2027 WHERE id = p_proposta_id AND ativada_em IS NOT NULL)
         THEN CASE WHEN v_teste THEN 'Teste: ativado no cadastro NICOLAS TESTE (plano, contrato e créditos de teste).'
                   ELSE E'Ativado automaticamente: aluno, plano, contrato e créditos criados.\nConfira o vínculo e a reposição (Pro/Treino).' END
       ELSE 'Ativação automática pendente: use "Ativar agora" na lista de propostas do site.' END
    || E'\nVeja em Leads > Propostas do site.';
  INSERT INTO public.notificacoes(titulo, descricao, categoria, prioridade, tipo, criado_por)
  VALUES (v_titulo, v_desc, 'comercial', 'alta', 'simples', v_criador) RETURNING id INTO v_notif;
  INSERT INTO public.notificacao_destinatarios(notificacao_id, usuario_id)
  SELECT DISTINCT v_notif, ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin', 'coordenador');
  UPDATE public.propostas_planos_2027 SET notificacao_pagamento_id = v_notif WHERE id = p_proposta_id;
  RETURN v_notif;
END $function$;