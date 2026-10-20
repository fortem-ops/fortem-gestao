-- Reversão da entrada da Larissa na recorrência automática. Só roda se a mensalidade 2 ainda não foi tentada.
DO $$
DECLARE m planos_2027_mensalidades;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('manual_mensalidades:8bfa4dea-faba-44c1-8f5e-70df0fa535da',0));
  SELECT * INTO m FROM planos_2027_mensalidades WHERE venda_origem_id = '8bfa4dea-faba-44c1-8f5e-70df0fa535da';
  IF m.id IS NULL THEN RAISE EXCEPTION 'Nada a reverter'; END IF;
  IF (SELECT count(*) FROM planos_2027_mensalidades WHERE venda_origem_id = m.venda_origem_id) <> 1
     OR m.numero <> 2 OR m.status <> 'pendente' OR m.tentativas <> 0
     OR EXISTS (SELECT 1 FROM pagamentos_rede WHERE mensalidade_2027_id = m.id OR cobranca_id = m.cobranca_id) THEN
    RAISE EXCEPTION 'Reversão abortada: mensalidade já processada';
  END IF;
  DELETE FROM planos_2027_mensalidades WHERE id = m.id;
  DELETE FROM cobrancas WHERE id = m.cobranca_id AND status = 'pendente' AND numero_ciclo = 2
    AND contrato_id = '9cb790f2-fbba-41e9-a20f-d23c63cf8bef';
  INSERT INTO system_logs(modulo, acao, mensagem, payload) VALUES ('planos-recorrencia', 'reversao_larissa_recorrencia',
    'Larissa removida da recorrência automática', jsonb_build_object('mensalidade_id', m.id, 'cobranca_id', m.cobranca_id));
END $$;
