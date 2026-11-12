-- Ensaio revertido (termina em exceção): rate limit, limite de 30 fotos e lead reaproveitado.
DO $$
DECLARE ev uuid; envio uuid := gen_random_uuid(); i int; ok boolean; l1 uuid; l2 uuid;
BEGIN
  INSERT INTO eventos_fotos (slug, nome, data, collection_id) VALUES ('ensaio-rl', 'Ensaio', current_date, 'fortem-ensaio-rl') RETURNING id INTO ev;
  FOR i IN 1..10 LOOP ok := fn_fotos_rate_limit('ip-ensaio', 'busca', 10); IF NOT ok THEN RAISE EXCEPTION 'busca % bloqueada cedo', i; END IF; END LOOP;
  IF fn_fotos_rate_limit('ip-ensaio', 'busca', 10) THEN RAISE EXCEPTION '11a busca liberada'; END IF;
  FOR i IN 1..3 LOOP PERFORM fn_fotos_rate_limit('ip-ensaio', 'envio', 3); END LOOP;
  IF fn_fotos_rate_limit('ip-ensaio', 'envio', 3) THEN RAISE EXCEPTION '4o envio liberado'; END IF;
  l1 := fn_fotos_lead_registrar(ev, 'A', '5551999990000', '', true, false);
  l2 := fn_fotos_lead_registrar(ev, 'A B', '5551999990000', 'a@b.co', false, true);
  IF l1 <> l2 THEN RAISE EXCEPTION 'lead duplicado'; END IF;
  FOR i IN 1..30 LOOP INSERT INTO fotos_evento (evento_id, storage_path, origem, envio_id) VALUES (ev, 'x/' || i, 'convidado', envio); END LOOP;
  BEGIN
    INSERT INTO fotos_evento (evento_id, storage_path, origem, envio_id) VALUES (ev, 'x/31', 'convidado', envio);
    RAISE EXCEPTION '31a foto aceita';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'limite_30_fotos' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'ENSAIO_OK (revertido)';
END $$;
