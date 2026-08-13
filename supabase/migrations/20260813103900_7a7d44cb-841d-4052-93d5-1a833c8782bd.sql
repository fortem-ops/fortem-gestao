DO $$
DECLARE a uuid := 'cbeb7c57-9331-4520-a46e-848a3deebe99';
BEGIN
  DELETE FROM contratos_documentos WHERE aluno_id = a;
  DELETE FROM links_cartao WHERE aluno_id = a;
  DELETE FROM vendas WHERE aluno_id = a;
  DELETE FROM contratos WHERE aluno_id = a;
  DELETE FROM creditos_movimentos WHERE credito_id IN (SELECT id FROM creditos_aluno WHERE aluno_id = a);
  DELETE FROM creditos_aluno WHERE aluno_id = a;
  DELETE FROM planos WHERE aluno_id = a;
  DELETE FROM pipeline_movements WHERE aluno_id = a;
  DELETE FROM pipeline_metadata WHERE aluno_id = a;
  DELETE FROM clube_fortem_membros WHERE aluno_id = a;
  DELETE FROM alunos WHERE id = a;
END $$;