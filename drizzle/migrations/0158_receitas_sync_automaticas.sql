ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS origem_tabela text, ADD COLUMN IF NOT EXISTS origem_id text;
CREATE UNIQUE INDEX IF NOT EXISTS receitas_origem_uniq ON public.receitas(origem_tabela, origem_id) WHERE origem_tabela IS NOT NULL;
ALTER TABLE public.receitas DROP CONSTRAINT IF EXISTS receitas_origem_check;
ALTER TABLE public.receitas ADD CONSTRAINT receitas_origem_check CHECK (origem = ANY (ARRAY['manual','importado_historico','recorrente','automatico']));

CREATE OR REPLACE FUNCTION public.fn_receitas_sync_automaticas()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid := '6b6af174-7f42-4b9c-80ce-1dc706982d76';
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _rs(ot text, oid text, descr text, valor numeric, data date, status text, forma text) ON COMMIT DROP;
  TRUNCATE _rs;
  -- parcelas de cartão parcelado (planos e serviços)
  INSERT INTO _rs
  SELECT 'cartao_parcela', v.cobranca_id::text,
         coalesce(v.aluno_nome,'Aluno')||' — '||coalesce(v.plano_tipo,'Cartão')||' parcela '||v.numero_parcela||'/'||v.total_parcelas,
         v.valor_liquido, v.data_recebimento_prevista,
         CASE WHEN v.data_recebimento_prevista <= CURRENT_DATE THEN 'recebido' ELSE 'previsto' END, 'CARTÃO DE CRÉDITO'
  FROM (SELECT cobranca_id, aluno_nome, plano_tipo, numero_parcela, total_parcelas, valor_liquido, data_recebimento_prevista FROM vw_recebiveis_previstos_cartao_parcelado
        UNION SELECT cobranca_id, aluno_nome, plano_tipo, numero_parcela, total_parcelas, valor_liquido, data_recebimento_prevista FROM vw_recebiveis_previstos_futuros_cartao) v
  WHERE v.data_recebimento_prevista >= DATE '2026-10-01' AND v.valor_liquido > 0;
  -- demais cobranças pagas
  INSERT INTO _rs
  SELECT 'cobranca', c.id::text,
         coalesce(a.nome,'Aluno')||' — '||coalesce(c.descricao,'Mensalidade'),
         c.valor, c.data_pagamento, 'recebido',
         CASE WHEN c.forma_pagamento ILIKE 'pix%' THEN 'PIX'
              WHEN c.forma_pagamento ILIKE '%debito%' THEN 'CARTÃO DE DÉBITO'
              WHEN c.forma_pagamento ILIKE 'cartao%' THEN 'CARTÃO DE CRÉDITO'
              WHEN c.forma_pagamento = 'dinheiro' THEN 'DINHEIRO'
              WHEN c.forma_pagamento ILIKE 'boleto%' THEN 'BOLETO' END
  FROM cobrancas c LEFT JOIN alunos a ON a.id = c.aluno_id
  WHERE c.status = 'pago' AND c.data_pagamento >= DATE '2026-10-01' AND c.valor > 0
    AND coalesce(c.numero_ciclo,0) <> 999 AND coalesce(c.origem,'') <> 'teste_2027'
    AND NOT EXISTS (SELECT 1 FROM vw_recebiveis_previstos_cartao_parcelado p WHERE p.cobranca_id = c.id);

  DELETE FROM receitas r WHERE r.origem = 'automatico' AND r.conciliado = false
    AND NOT EXISTS (SELECT 1 FROM _rs s WHERE s.ot = r.origem_tabela AND s.oid = r.origem_id);

  INSERT INTO receitas (categoria_id, descricao, valor, valor_recebido, data_competencia, data_recebimento, status, origem, forma_recebimento, conta_bancaria, conciliado, origem_tabela, origem_id)
  SELECT v_cat, s.descr, s.valor, CASE WHEN s.status='recebido' THEN s.valor END, s.data, s.data, s.status, 'automatico', s.forma,
         CASE WHEN s.forma IN ('PIX','CARTÃO DE CRÉDITO','CARTÃO DE DÉBITO','BOLETO') THEN 'BANCO INTER' END, false, s.ot, s.oid
  FROM _rs s
  ON CONFLICT (origem_tabela, origem_id) WHERE origem_tabela IS NOT NULL DO UPDATE
    SET descricao = EXCLUDED.descricao, valor = EXCLUDED.valor, valor_recebido = EXCLUDED.valor_recebido,
        data_competencia = EXCLUDED.data_competencia, data_recebimento = EXCLUDED.data_recebimento,
        status = EXCLUDED.status, forma_recebimento = EXCLUDED.forma_recebimento, updated_at = now()
    WHERE receitas.conciliado = false;
END $$;
REVOKE ALL ON FUNCTION public.fn_receitas_sync_automaticas() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_cobrancas_sync_receitas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.fn_receitas_sync_automaticas(); RETURN NULL; END $$;

DROP TRIGGER IF EXISTS trg_cobrancas_sync_receitas ON public.cobrancas;
CREATE TRIGGER trg_cobrancas_sync_receitas AFTER INSERT OR UPDATE OR DELETE ON public.cobrancas
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_cobrancas_sync_receitas();

SELECT public.fn_receitas_sync_automaticas();
SELECT cron.schedule('receitas-sync-diario', '15 3 * * *', 'select public.fn_receitas_sync_automaticas()');