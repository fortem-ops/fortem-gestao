with a as (
  insert into alunos (nome, email, telefone, status) values ('TESTE EMAIL INTERNO','contatofortem@gmail.com','(51) 99999-0000','ativo') returning id
), v as (
  insert into vendas (aluno_id, tipo, catalogo_id, nome_snapshot, valor, valor_final, desconto, forma_pagamento, parcelas, tipo_cobranca, origem, status_pagamento, observacoes)
  select a.id, 'plano', '1c1df271-e6fe-4762-bc11-a92e5ea7bca5', 'Plano Corrida Anual (teste)', 1200, 1200, 0, 'cartao_credito', 3, 'tradicional', 'corrida_publico', 'pago',
   '{"rota":"prospect","tier":null,"pedidoResumo":{"linhas":[{"label":"Plano Corrida Anual","valor":1000},{"label":"Kit New Balance","valor":200},{"label":"Inscricao MIPOA 21k","valor":0,"nota":"Cortesia"}],"total":1200}}'
  from a returning id, aluno_id
)
insert into corrida_inscricoes_prova (rota, aluno_id, nome, sobrenome, email, telefone, data_nascimento, provas, pedido_resumo, venda_id, inscricao_prova_completa, status, cpf_hash, cpf_encrypted, cpf_ultimos3)
select 'prospect', v.aluno_id, 'TESTE','EMAIL INTERNO','contatofortem@gmail.com','(51) 99999-0000','1990-01-01',
 '[{"prova":"MIPOA","nome":"MIPOA","distancia":"21k"}]'::jsonb,
 '{"linhas":[{"label":"Plano Corrida Anual","valor":1000},{"label":"Kit New Balance","valor":200},{"label":"Inscricao MIPOA 21k","valor":0,"nota":"Cortesia"}],"total_hoje":1200}'::jsonb,
 v.id, false, 'pago', 'teste-hash-email-interno', '\x00'::bytea, '000'
from v