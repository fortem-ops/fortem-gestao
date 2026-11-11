-- Regressão: elegibilidade do Plano Semestral. Roda como bloco privilegiado e termina com
-- exceção ENSAIO_OK (tudo revertido). Qualquer outra mensagem = falha.
DO $$
DECLARE w uuid; t uuid; n uuid; tmp uuid; v text;
BEGIN
  SELECT aluno_id INTO w FROM planos p WHERE ativo AND tipo='Gympass/Wellhub' AND NOT EXISTS (SELECT 1 FROM planos q WHERE q.aluno_id=p.aluno_id AND q.ativo AND q.tipo='Total Pass') LIMIT 1;
  SELECT aluno_id INTO t FROM planos p WHERE ativo AND tipo='Total Pass' AND NOT EXISTS (SELECT 1 FROM planos q WHERE q.aluno_id=p.aluno_id AND q.ativo AND q.tipo='Gympass/Wellhub') LIMIT 1;
  SELECT a.id INTO n FROM alunos a WHERE NOT EXISTS (SELECT 1 FROM planos q WHERE q.aluno_id=a.id AND q.ativo AND q.tipo IN ('Gympass/Wellhub','Total Pass')) LIMIT 1;
  UPDATE planos_catalogo SET ativo = true WHERE familia='semestral_2027';
  SELECT string_agg(codigo, ',' ORDER BY codigo) INTO v FROM fn_semestral_itens_elegiveis(w);
  IF v IS DISTINCT FROM 'pro_semestral_wellhub_3x,start_semestral_wellhub_3x' THEN RAISE EXCEPTION 'FALHA wellhub: %', v; END IF;
  SELECT string_agg(codigo, ',' ORDER BY codigo) INTO v FROM fn_semestral_itens_elegiveis(t);
  IF v IS DISTINCT FROM 'pro_semestral_totalpass_3x,start_semestral_totalpass_3x' THEN RAISE EXCEPTION 'FALHA totalpass: %', v; END IF;
  IF (SELECT count(*) FROM fn_semestral_itens_elegiveis(n)) <> 0 THEN RAISE EXCEPTION 'FALHA sem agregadora'; END IF;
  IF (fn_semestral_elegivel(w,'pro_semestral_totalpass_3x')->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHA cruzada'; END IF;
  IF (fn_semestral_elegivel(w,'start_semestral_wellhub_3x','2027-01-01')->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHA data'; END IF;
  INSERT INTO planos (aluno_id, tipo, ativo, data_inicio, valor) VALUES (w, 'Total Pass', true, current_date, 0) RETURNING id INTO tmp;
  IF (fn_semestral_elegivel(w,'start_semestral_wellhub_3x')->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHA duas agregadoras'; END IF;
  UPDATE planos SET ativo = false WHERE id = tmp;
  INSERT INTO vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, valor_final)
    SELECT w, 'plano', id, 'ensaio', 439, 439 FROM planos_catalogo WHERE codigo='start_semestral_wellhub_3x' RETURNING id INTO tmp;
  UPDATE vendas SET status_pagamento='cancelado', observacao_cancelamento='ensaio', data_cancelamento=current_date,
    motivo_cancelamento_id=(SELECT id FROM cancelamento_motivos LIMIT 1) WHERE id = tmp;
  -- Etapa 4C: venda desistida/expirada nunca paga não conta como contratação.
  IF NOT (fn_semestral_elegivel(w,'pro_semestral_wellhub_3x')->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHA CPF: venda nunca paga contou'; END IF;
  -- Paga e depois estornada/cancelada: conta para sempre.
  UPDATE vendas SET status_pagamento='estornado' WHERE id = tmp;
  IF (fn_semestral_elegivel(w,'pro_semestral_wellhub_3x')->>'elegivel')::boolean THEN RAISE EXCEPTION 'FALHA CPF'; END IF;
  BEGIN
    INSERT INTO vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, valor_final)
      SELECT n, 'plano', id, 'ensaio2', 439, 439 FROM planos_catalogo WHERE codigo='start_semestral_wellhub_3x';
    RAISE EXCEPTION 'FALHA trava de gravação';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Plano Semestral não permitido%' THEN RAISE; END IF;
  END;
  RAISE EXCEPTION 'ENSAIO_OK';
END $$;
