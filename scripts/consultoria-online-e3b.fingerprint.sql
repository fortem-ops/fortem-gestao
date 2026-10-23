-- E3b: impressão digital de Start/Power/Pro no NICOLAS TESTE. Sempre termina em RAISE EXCEPTION (desfaz tudo).
-- Roteiro para repetir: rodar ESTE arquivo sem mudanças, antes e depois da E3b; comparar a mensagem final
-- com scripts/consultoria-online-e3b.fingerprint-antes.txt. Datas fixas (início 2026-11-01); ids, chaves e
-- carimbos de criação/atualização ficam fora do md5.
DO $fp$
DECLARE
  aluno constant uuid := '085acf57-2dbe-464d-9acc-e1b0f5b77032';
  r jsonb; out text := ''; nome text; v uuid; ids uuid[]; pl uuid; k uuid;
  casos jsonb := jsonb_build_array(
    jsonb_build_object('nome','start_1x_desc_rec','p', jsonb_build_object('aluno_id',aluno,'catalogo_id','7654cefc-2693-4b1e-b15a-dbd12a9c38a5',
      'forma','recorrencia','data_inicio','2026-11-01','servicos','[]'::jsonb,'desconto',50,'desconto_recorrente',true)),
    jsonb_build_object('nome','power_1x_anual_12x_serv','p', jsonb_build_object('aluno_id',aluno,'catalogo_id','f39c77e8-a05c-4e20-8f0a-4f2f3b4d37f0',
      'forma','cartao_parcelado','parcelas',12,'data_inicio','2026-11-01','servicos',jsonb_build_array('2a94db5b-2662-4ec4-aabd-a35a73fd988c'))),
    jsonb_build_object('nome','pro_livre_recorrencia','p', jsonb_build_object('aluno_id',aluno,'catalogo_id','7ce709c3-1ff3-4fa9-84ca-548ced634b72',
      'forma','recorrencia','data_inicio','2026-11-01','servicos','[]'::jsonb)));
  cs jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"66aa47d0-dc40-493d-8370-7d80eb54b8d6","role":"authenticated"}', true);
  FOR cs IN SELECT * FROM jsonb_array_elements(casos) LOOP
    nome := cs->>'nome';
    r := public.fn_venda_2027_criar((cs->'p') || jsonb_build_object('idempotency_key', gen_random_uuid()));
    v := (r->>'venda_id')::uuid; pl := (r->>'plano_id')::uuid; k := (r->>'contrato_id')::uuid;
    ids := ARRAY[v] || ARRAY(SELECT (x)::uuid FROM jsonb_array_elements_text(r->'servico_venda_ids') x);
    out := out || nome
      || ' venda=' || (SELECT md5(string_agg(j::text, '|' ORDER BY j::text)) FROM (SELECT (SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(to_jsonb(t)) e
           WHERE e.key <> 'id' AND e.key NOT LIKE '%\_id' AND e.key NOT LIKE '%\_at' AND e.key NOT IN ('idempotency_key','vendedor_id')) j FROM public.vendas t WHERE t.id = ANY(ids)) q)
      || ' plano=' || (SELECT md5(string_agg(j::text, '|' ORDER BY j::text)) FROM (SELECT (SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(to_jsonb(t)) e
           WHERE e.key <> 'id' AND e.key NOT LIKE '%\_id' AND e.key NOT LIKE '%\_at') j FROM public.planos t WHERE t.id = pl) q)
      || ' contrato=' || (SELECT md5(string_agg(j::text, '|' ORDER BY j::text)) FROM (SELECT (SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(to_jsonb(t) - 'servicos_inclusos') e
           WHERE e.key <> 'id' AND e.key NOT LIKE '%\_id' AND e.key NOT LIKE '%\_at' AND e.key <> 'criado_por') j FROM public.contratos t WHERE t.id = k) q)
      || ' cobrancas=' || COALESCE((SELECT md5(string_agg(j::text, '|' ORDER BY j::text)) FROM (SELECT (SELECT jsonb_object_agg(e.key, CASE WHEN e.key = 'composicao' THEN e.value - 'servicos_vendas' ELSE e.value END) FROM jsonb_each(to_jsonb(t)) e
           WHERE e.key <> 'id' AND e.key NOT LIKE '%\_id' AND e.key NOT LIKE '%\_at') j FROM public.cobrancas t WHERE t.contrato_id = k) q), '-')
      || ' n_cob=' || (SELECT count(*) FROM public.cobrancas WHERE contrato_id = k)
      || ' creditos=' || COALESCE((SELECT md5(string_agg(j::text, '|' ORDER BY j::text)) FROM (SELECT (SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(to_jsonb(t)) e
           WHERE e.key <> 'id' AND e.key NOT LIKE '%\_id' AND e.key NOT LIKE '%\_at') j FROM public.creditos_aluno t WHERE t.origem_id IN (SELECT unnest(ids) UNION SELECT pl)) q), '-')
      || ' movs=' || COALESCE((SELECT md5(string_agg(j::text, '|' ORDER BY j::text)) FROM (SELECT (SELECT jsonb_object_agg(e.key, e.value) FROM jsonb_each(to_jsonb(t)) e
           WHERE e.key <> 'id' AND e.key NOT LIKE '%\_id' AND e.key NOT LIKE '%\_at' AND e.key <> 'registrado_por') j FROM public.creditos_movimentos t
           WHERE t.credito_id IN (SELECT id FROM public.creditos_aluno WHERE origem_id IN (SELECT unnest(ids) UNION SELECT pl))) q), '-')
      || ' resp=' || md5((r - 'venda_id' - 'plano_id' - 'contrato_id' - 'servico_venda_ids')::text)
      || E'\n';
  END LOOP;
  RAISE EXCEPTION E'FINGERPRINT (desfeito)\n%', out;
END $fp$;
