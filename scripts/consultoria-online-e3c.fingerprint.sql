-- E3c: roteiro desfeito no NICOLAS TESTE (sempre termina em RAISE EXCEPTION; nada fica gravado).
-- Cenário por item do catálogo: venda manual em recorrência → cartão fictício → 1º ciclo pago (reservar/liquidar,
-- sem Rede) → fn_mensalidade_manual_gerar → 2ª mensalidade aprovada em simulação (resultado_rede, sem Rede)
-- → fn_renovar_start_2027 no fim do ciclo → próximo ciclo. Datas fixas (início 2026-11-01).
-- md5 por tabela das linhas criadas na transação (created_at >= now()), sem ids, chaves de idempotência
-- e sem qualquer valor carimbo de hora (timestamp com hora); datas puras ficam.
-- Repetir: rodar este arquivo sem mudanças antes e depois da E3c e comparar com consultoria-online-e3c.fingerprint-antes.txt.
DO $fp$
DECLARE
  aluno constant uuid := '085acf57-2dbe-464d-9acc-e1b0f5b77032';
  itens jsonb := jsonb_build_array(
    jsonb_build_object('nome','start_1x_desc50_rec','cat','7654cefc-2693-4b1e-b15a-dbd12a9c38a5','desc',50),
    jsonb_build_object('nome','consultoria_mensal','cat','c958faf4-f3ba-4b8f-960a-019b4c31aa38','desc',0));
  it jsonb; out text := ''; r jsonb; a jsonb; ren jsonb; v uuid; k uuid; pl uuid; cs uuid; tk uuid; pr uuid; s text;
  m2 planos_2027_mensalidades; tab text; h text; n int; sp text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"66aa47d0-dc40-493d-8370-7d80eb54b8d6","role":"authenticated"}', true);
  FOR it IN SELECT * FROM jsonb_array_elements(itens) LOOP
    BEGIN
      r := public.fn_venda_2027_criar(jsonb_build_object('aluno_id',aluno,'catalogo_id',it->>'cat','forma','recorrencia',
        'data_inicio','2026-11-01','servicos','[]'::jsonb,'desconto',(it->>'desc')::numeric,'desconto_recorrente',true,
        'idempotency_key', gen_random_uuid()));
      v := (r->>'venda_id')::uuid; k := (r->>'contrato_id')::uuid; pl := (r->>'plano_id')::uuid;
      INSERT INTO cartoes_salvos(aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year, ativo)
      VALUES (aluno, 'TESTE-TOKEN', 'Mastercard', '0000', 'NICOLAS TESTE', 12, 2030, true) RETURNING id INTO cs;
      INSERT INTO rede_tokenizacoes(aluno_id, tokenization_id, status, origem, cartao_salvo_id, token_code, token_expiration, cardholder_name, last4)
      VALUES (aluno, 'TESTE-TOK-E3C', 'active', 'link_cadastro', cs, 'TESTE', '12/2030', 'NICOLAS TESTE', '0000') RETURNING id INTO tk;
      UPDATE contratos SET cartao_token_id = cs WHERE id = k;
      UPDATE vendas SET origem = 'manual' WHERE id = v; -- como no ensaio recorrencia-manual-2027 (aluno de teste nasce 'teste_2027')
      a := fn_manual_primeiro_ciclo_reservar(v, 'e3c-' || (it->>'nome'), 'token');
      pr := (a->>'pagamento_id')::uuid;
      a := fn_manual_primeiro_ciclo_liquidar(v, pr, jsonb_build_object('tid','TEST-C1','nsu','1','return_code','00'));
      a := fn_mensalidade_manual_gerar(v);
      out := out || (it->>'nome') || ' gerar=' || (a - 'contrato_id')::text || ' ';
      SELECT * INTO m2 FROM planos_2027_mensalidades WHERE venda_origem_id = v AND numero = 2;
      IF m2.id IS NOT NULL THEN
        out := out || 'm2=' || m2.valor_centavos || '@' || m2.vencimento || ' ';
        PERFORM fn_recorrencia_2027_reservar(m2.id);
        s := fn_recorrencia_2027_resultado_rede(m2.id,'aprovado','SIM-TID-2','N2','A2','00','ok',NULL,'2026-12-01');
        out := out || 'm2_res=' || s || ' m3=' || COALESCE((SELECT valor_centavos || '@' || vencimento FROM planos_2027_mensalidades WHERE venda_origem_id = v AND numero = 3), '-') || ' ';
      ELSE
        out := out || 'm2=- ';
      END IF;
      ren := fn_renovar_start_2027(pl, '2026-12-01');
      out := out || 'renov=' || COALESCE(ren->>'pulado', 'ok ' || (ren->>'ciclo_inicio') || '..' || (ren->>'ciclo_fim')) || E'\n';
      FOREACH tab IN ARRAY ARRAY['vendas','planos','contratos','cobrancas','ciclos_credito','creditos_aluno','planos_2027_mensalidades','pagamentos_rede'] LOOP
        EXECUTE format($q$SELECT count(*), md5(COALESCE(string_agg(j::text, '|' ORDER BY j::text), '')) FROM (
          SELECT (SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(to_jsonb(t)) e
                  WHERE e.key <> 'id' AND e.key NOT LIKE '%%\_id' AND e.key NOT IN ('idempotency_key','criado_por','vendedor_id','registrado_por')
                    AND NOT (jsonb_typeof(e.value) = 'string' AND (e.value #>> '{}') ~ '^\d{4}-\d\d-\d\dT')) j
          FROM public.%I t WHERE t.created_at >= now()
            AND (to_jsonb(t) ? 'aluno_id' AND (to_jsonb(t)->>'aluno_id') = %L
                 OR NOT (to_jsonb(t) ? 'aluno_id'))) q$q$, tab, aluno) INTO n, h;
        out := out || '  ' || tab || '=' || n || ':' || h || E'\n';
      END LOOP;
      out := out || '  creditos_movimentos=' || (SELECT count(*) || ':' || md5(COALESCE(string_agg(x, '|' ORDER BY x), '')) FROM (
          SELECT m.tipo || '/' || m.quantidade || '/' || COALESCE(m.observacao,'') x FROM creditos_movimentos m JOIN creditos_aluno ca ON ca.id = m.credito_id
          WHERE ca.aluno_id = aluno AND ca.created_at >= now()) q) || E'\n';
      RAISE EXCEPTION 'desfaz_item';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'desfaz_item' THEN out := out || (it->>'nome') || ' ERRO: ' || SQLERRM || E'\n'; END IF;
    END;
  END LOOP;
  RAISE EXCEPTION E'E3C FINGERPRINT (desfeito)\n%', out;
END $fp$;
