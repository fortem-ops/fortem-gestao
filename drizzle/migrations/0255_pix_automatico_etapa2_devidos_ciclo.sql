CREATE OR REPLACE FUNCTION public.fn_pix_aut_ciclos_devidos(p_hoje date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; v_venc date; v_out jsonb := '[]'; v_modo text; v_acao text; c record;
BEGIN
  IF NOT public.fn_pix_aut_eh_service() THEN RAISE EXCEPTION 'sem_permissao' USING ERRCODE = '42501'; END IF;
  FOR g IN SELECT gr.* FROM pix_aut_grupos gr JOIN pix_recorrencias r ON r.id = gr.recorrencia_id
            WHERE gr.status = 'ativa' AND r.status = 'AUTORIZADA' LOOP
    v_venc := public.fn_pix_aut_proximo_venc(g.id);
    CONTINUE WHEN v_venc IS NULL OR p_hoje < v_venc - 7;
    v_modo := public.fn_pix_aut_modo_grupo(g.id, p_hoje);
    CONTINUE WHEN v_modo = 'desligado';
    SELECT * INTO c FROM pix_aut_ciclos WHERE grupo_id = g.id AND vencimento = v_venc;
    IF p_hoje > v_venc - 3 THEN
      CONTINUE WHEN v_modo <> 'real' OR (c.id IS NOT NULL AND (c.status = 'simulado' OR coalesce(c.ultimo_erro,'') LIKE 'janela_perdida%'));
      v_acao := 'janela_perdida';
    ELSE
      v_acao := CASE WHEN v_modo = 'real' THEN 'enviar' ELSE 'simular' END;
      CONTINUE WHEN v_acao = 'simular' AND c.id IS NOT NULL;
    END IF;
    v_out := v_out || jsonb_build_object('grupo', g.id, 'aluno', g.aluno_id, 'vencimento', v_venc, 'acao', v_acao, 'modo', v_modo,
      'ciclo', c.id, 'ciclo_status', c.status, 'txid', c.txid, 'composicao', public.fn_pix_aut_composicao(g.id, v_venc));
  END LOOP;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_ciclos_devidos(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pix_aut_ciclos_devidos(date) TO service_role;