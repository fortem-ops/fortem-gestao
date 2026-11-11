ALTER TABLE public.pix_cobrancas ADD COLUMN IF NOT EXISTS pix_aut_imediata_id uuid REFERENCES public.pix_aut_imediatas(id);
ALTER TABLE public.pix_cobrancas DROP CONSTRAINT IF EXISTS pix_cobrancas_origem_check;
ALTER TABLE public.pix_cobrancas ADD CONSTRAINT pix_cobrancas_origem_check CHECK (
  id_rec IS NOT NULL OR pedido_id IS NOT NULL OR corrida_venda_id IS NOT NULL OR proposta_id IS NOT NULL OR pix_aut_imediata_id IS NOT NULL);

CREATE OR REPLACE FUNCTION public.fn_pix_aut_primeira_ativar(p_id uuid, p_copia text, p_expira timestamptz, p_raw jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_desc text;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM pix_aut_imediatas WHERE id = p_id FOR UPDATE;
  IF c.status <> 'reservado' THEN RETURN jsonb_build_object('ok', false, 'motivo', 'status_' || c.status); END IF;
  SELECT 'FORTEM 1ª mensalidade: ' || string_agg((x->>'descricao') || ' R$ ' || (x->>'valor'), ' + ') INTO v_desc FROM jsonb_array_elements(c.composicao->'itens') x;
  INSERT INTO pix_cobrancas (aluno_id, txid, valor, status, descricao, raw_response, pix_aut_imediata_id)
  SELECT c.aluno_id, c.txid, c.valor, 'ATIVA', v_desc, coalesce(p_raw, '{}'::jsonb) || jsonb_build_object('_imediata', c.id, '_grupo', c.grupo_id), c.id
  WHERE NOT EXISTS (SELECT 1 FROM pix_cobrancas WHERE txid = c.txid);
  UPDATE pix_aut_imediatas SET status = 'ativa', pix_copia_cola = p_copia, expira_em = p_expira, ultimo_erro = NULL, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_primeira_ativar(uuid, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_primeira_ativar(uuid, text, timestamptz, jsonb) TO service_role;