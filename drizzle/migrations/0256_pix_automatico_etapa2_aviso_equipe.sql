-- Aviso interno nunca derruba baixa/reserva: criado_por = primeiro admin; falha vira registro em system_logs.
CREATE OR REPLACE FUNCTION public.fn_pix_aut_avisar_equipe(p_titulo text, p_descricao text, p_aluno uuid, p_prioridade text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n uuid; v_autor uuid;
BEGIN
  SELECT user_id INTO v_autor FROM user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1;
  INSERT INTO notificacoes (titulo, descricao, categoria, tipo, prioridade, status, aluno_id, criado_por)
  VALUES (p_titulo, p_descricao, 'financeiro', 'simples', p_prioridade::notif_prioridade, 'nao_visualizada', p_aluno, v_autor)
  RETURNING id INTO v_n;
  INSERT INTO notificacao_destinatarios (notificacao_id, usuario_id)
  SELECT DISTINCT v_n, ur.user_id FROM user_roles ur WHERE ur.role IN ('admin','coordenador');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO system_logs (modulo, acao, mensagem, payload)
  VALUES ('pix-automatico-grupo', 'aviso_falhou', left(SQLERRM, 300), jsonb_build_object('titulo', p_titulo, 'aluno', p_aluno));
END $$;
REVOKE ALL ON FUNCTION public.fn_pix_aut_avisar_equipe(text, text, uuid, text) FROM PUBLIC, anon, authenticated;