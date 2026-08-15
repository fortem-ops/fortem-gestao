delete from corrida_inscricoes_prova where cpf_hash='teste-hash-email-interno';
delete from creditos_movimentos where credito_id in (select id from creditos_aluno where aluno_id in (select id from alunos where nome='TESTE EMAIL INTERNO'));
delete from creditos_aluno where aluno_id in (select id from alunos where nome='TESTE EMAIL INTERNO');
delete from vendas where aluno_id in (select id from alunos where nome='TESTE EMAIL INTERNO');
delete from planos where aluno_id in (select id from alunos where nome='TESTE EMAIL INTERNO');
delete from alunos where nome='TESTE EMAIL INTERNO';