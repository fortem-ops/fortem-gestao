-- Regressão (revertida): professor só altera status_moderacao/moderado_por/moderado_em em fotos_evento.
DO $$
DECLARE ev uuid; f uuid; prof uuid; n int; falhou boolean;
BEGIN
  SELECT ur.user_id INTO prof FROM user_roles ur WHERE role = 'professor'
    AND NOT EXISTS (SELECT 1 FROM user_roles x WHERE x.user_id = ur.user_id AND x.role IN ('admin','coordenador')) LIMIT 1;
  INSERT INTO eventos_fotos (slug, nome, data, collection_id) VALUES ('ensaio-prof', 'Ensaio', current_date, 'fortem-ensaio-prof') RETURNING id INTO ev;
  INSERT INTO fotos_evento (evento_id, storage_path, origem, largura) VALUES (ev, 'x/1', 'convidado', 100) RETURNING id INTO f;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', prof, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- permitido: moderação
  UPDATE fotos_evento SET status_moderacao = 'aprovada' WHERE id = f;
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'professor nao conseguiu moderar'; END IF;
  -- proibido: qualquer outra coluna
  falhou := false;
  BEGIN UPDATE fotos_evento SET largura = 999 WHERE id = f; EXCEPTION WHEN OTHERS THEN falhou := true; END;
  IF NOT falhou THEN RAISE EXCEPTION 'FALHA: professor alterou largura'; END IF;
  falhou := false;
  BEGIN UPDATE fotos_evento SET upload_concluido = true, storage_path = 'y' WHERE id = f; EXCEPTION WHEN OTHERS THEN falhou := true; END;
  IF NOT falhou THEN RAISE EXCEPTION 'FALHA: professor alterou caminho/upload'; END IF;
  RESET ROLE;
  RAISE EXCEPTION 'ENSAIO_OK (revertido)';
END $$;
