UPDATE public.historico_profissional h
SET notificacao_id = n.id
FROM public.notificacoes n
WHERE h.notificacao_id IS NULL
  AND h.categoria = 'observacao'
  AND h.aluno_id = n.aluno_id
  AND h.descricao LIKE '📩 Notificação: ' || n.titulo || '%'
  AND ABS(EXTRACT(EPOCH FROM (h.created_at - n.created_at))) < 60;