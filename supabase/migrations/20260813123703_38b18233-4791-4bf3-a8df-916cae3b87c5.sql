DO $$
DECLARE a uuid;
BEGIN
  FOR a IN SELECT id FROM public.alunos WHERE email LIKE 'qa%@teste.com' AND nome = 'Teste Parcelas QA' LOOP
    DELETE FROM public.corrida_inscricoes_prova WHERE aluno_id = a;
    DELETE FROM public.cobrancas WHERE contrato_id IN (SELECT id FROM public.contratos WHERE aluno_id = a);
    DELETE FROM public.contratos_documentos WHERE contrato_id IN (SELECT id FROM public.contratos WHERE aluno_id = a);
    DELETE FROM public.contratos WHERE aluno_id = a;
    DELETE FROM public.vendas WHERE aluno_id = a;
    DELETE FROM public.cartoes_salvos WHERE aluno_id = a;
    DELETE FROM public.links_cartao WHERE aluno_id = a;
    DELETE FROM public.alunos WHERE id = a;
  END LOOP;
END $$;