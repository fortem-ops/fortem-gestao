ALTER TABLE public.despesas DROP CONSTRAINT despesas_origem_check;
ALTER TABLE public.despesas ADD CONSTRAINT despesas_origem_check CHECK (origem = ANY (ARRAY['manual','importado_historico','recorrente','automatico']));

CREATE OR REPLACE FUNCTION public.fn_pascoa(p_ano int) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int; mes int; dia int;
BEGIN
  a := p_ano % 19; b := p_ano / 100; c := p_ano % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19*a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2*e + 2*i - h - k) % 7; m := (a + 11*h + 22*l) / 451;
  mes := (h + l - 7*m + 114) / 31; dia := ((h + l - 7*m + 114) % 31) + 1;
  RETURN make_date(p_ano, mes, dia);
END $$;

CREATE OR REPLACE FUNCTION public.fn_feriados_nacionais(p_ini date, p_fim date) RETURNS SETOF date LANGUAGE sql STABLE SET search_path = public AS $$
  WITH anos AS (SELECT generate_series(extract(year from p_ini)::int, extract(year from p_fim)::int) y),
  fixos AS (
    SELECT make_date(y, md[1], md[2]) d FROM anos,
      unnest(ARRAY[ARRAY[1,1],ARRAY[4,21],ARRAY[5,1],ARRAY[9,7],ARRAY[10,12],ARRAY[11,2],ARRAY[11,15],ARRAY[12,25]]) WITH ORDINALITY AS t(x, o)
      CROSS JOIN LATERAL (SELECT ARRAY[ (ARRAY[1,4,5,9,10,11,11,12])[o], (ARRAY[1,21,1,7,12,2,15,25])[o] ] md) z
    WHERE o % 2 = 1 OR true
    UNION SELECT make_date(y, 11, 20) FROM anos WHERE y >= 2024
    UNION SELECT public.fn_pascoa(y) - 2 FROM anos
    UNION SELECT data FROM public.ponto_feriados WHERE tipo = 'nacional'
  )
  SELECT DISTINCT d FROM fixos WHERE d BETWEEN p_ini AND p_fim
$$;

CREATE OR REPLACE FUNCTION public.fn_comissao_gerar_despesa() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_forn uuid; v_aluno text; v_tipo text;
BEGIN
  IF NEW.status::text <> 'pago' OR (TG_OP = 'UPDATE' AND OLD.status::text = 'pago') THEN RETURN NEW; END IF;
  SELECT id INTO v_forn FROM fornecedores WHERE profissional_user_id = NEW.profissional_id ORDER BY ativo DESC LIMIT 1;
  IF v_forn IS NULL THEN
    INSERT INTO system_logs(modulo, acao, mensagem, payload)
    VALUES ('despesas_comissoes', 'fornecedor_nao_encontrado',
      'Comissão paga sem fornecedor vinculado ao profissional — despesa não gerada',
      jsonb_build_object('comissionamento_id', NEW.id, 'profissional_id', NEW.profissional_id, 'valor', NEW.valor));
    RETURN NEW;
  END IF;
  SELECT nome INTO v_aluno FROM alunos WHERE id = NEW.aluno_id;
  v_tipo := CASE NEW.tipo::text WHEN 'treino_experimental' THEN 'Treino Experimental'
    WHEN 'avaliacao_funcional' THEN 'Avaliação Funcional' WHEN 'carteira_ativa' THEN 'Carteira Ativa' ELSE NEW.tipo::text END;
  INSERT INTO despesas(categoria_id, fornecedor_id, descricao, valor, valor_pago, data_competencia, data_pagamento,
    tipo, status, origem, origem_tabela, origem_id)
  VALUES ('fb292895-bc41-474a-9e57-58f6777748df', v_forn,
    'Comissão ' || v_tipo || COALESCE(' — ' || v_aluno, ''), NEW.valor, NEW.valor,
    NEW.data_referencia, COALESCE(NEW.data_pagamento, CURRENT_DATE), 'variavel', 'pago', 'automatico',
    'comissionamentos', NEW.id)
  ON CONFLICT (origem_tabela, origem_id) WHERE origem_tabela IS NOT NULL DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO system_logs(modulo, acao, mensagem, payload)
  VALUES ('despesas_comissoes', 'erro_gerar_despesa', SQLERRM, jsonb_build_object('comissionamento_id', NEW.id));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_comissao_gerar_despesa
AFTER INSERT OR UPDATE OF status ON public.comissionamentos
FOR EACH ROW EXECUTE FUNCTION public.fn_comissao_gerar_despesa();

CREATE OR REPLACE FUNCTION public.fn_calcular_dsr_comissoes(p_mes date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ini date := date_trunc('month', p_mes)::date; v_fim date; v_desc int; v_uteis int;
  r record; v_forn uuid; v_valor numeric; v_id uuid; v_rot text;
  criadas int := 0; existentes int := 0; sem_forn jsonb := '[]'::jsonb; total numeric := 0;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  v_fim := (v_ini + interval '1 month - 1 day')::date;
  v_rot := to_char(v_ini, 'MM/YYYY');
  SELECT count(*) FILTER (WHERE extract(dow FROM d) = 0 OR d IN (SELECT public.fn_feriados_nacionais(v_ini, v_fim))),
         count(*) FILTER (WHERE extract(dow FROM d) <> 0 AND d NOT IN (SELECT public.fn_feriados_nacionais(v_ini, v_fim)))
    INTO v_desc, v_uteis FROM generate_series(v_ini, v_fim, '1 day') g(d);
  FOR r IN SELECT c.profissional_id, sum(c.valor) tot FROM comissionamentos c
    WHERE c.status::text = 'pago' AND c.data_pagamento BETWEEN v_ini AND v_fim GROUP BY 1 LOOP
    v_valor := round(r.tot * v_desc / NULLIF(v_uteis, 0), 2);
    IF COALESCE(v_valor, 0) <= 0 THEN CONTINUE; END IF;
    SELECT id INTO v_forn FROM fornecedores WHERE profissional_user_id = r.profissional_id ORDER BY ativo DESC LIMIT 1;
    IF v_forn IS NULL THEN
      sem_forn := sem_forn || jsonb_build_object('profissional_id', r.profissional_id,
        'nome', (SELECT nome FROM profiles WHERE user_id = r.profissional_id LIMIT 1), 'valor_dsr', v_valor);
      CONTINUE;
    END IF;
    INSERT INTO despesas(categoria_id, fornecedor_id, descricao, valor, valor_pago, data_competencia, data_pagamento,
      tipo, status, origem, origem_tabela, origem_id, observacao, created_by, updated_by)
    VALUES ('5c86da2d-6ecd-4b85-ba33-56b3ea0e6687', v_forn, 'DSR de Comissões — ' || v_rot, v_valor, NULL, v_fim, NULL,
      'variavel', 'pendente', 'automatico', 'dsr_comissoes', md5('dsr|' || r.profissional_id || '|' || v_ini)::uuid,
      format('Comissões pagas: R$ %s × %s domingos/feriados ÷ %s dias úteis', r.tot, v_desc, v_uteis), auth.uid(), auth.uid())
    ON CONFLICT (origem_tabela, origem_id) WHERE origem_tabela IS NOT NULL DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN existentes := existentes + 1; ELSE criadas := criadas + 1; total := total + v_valor; END IF;
    v_id := NULL;
  END LOOP;
  RETURN jsonb_build_object('mes', v_rot, 'domingos_feriados', v_desc, 'dias_uteis', v_uteis,
    'criadas', criadas, 'ja_existentes', existentes, 'total_criado', total, 'sem_fornecedor', sem_forn);
END $$;

REVOKE ALL ON FUNCTION public.fn_calcular_dsr_comissoes(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_calcular_dsr_comissoes(date) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_comissao_gerar_despesa() FROM PUBLIC, anon, authenticated;