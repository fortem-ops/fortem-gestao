INSERT INTO public.alunos (id, nome, email, telefone, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'TESTE EMAIL QP', 'contatofortem@gmail.com', '51999990000', 'ativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vendas (id, aluno_id, tipo, catalogo_id, nome_snapshot, valor_final, parcelas, forma_pagamento, observacoes)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'plano', '1c1df271-e6fe-4762-bc11-a92e5ea7bca5', 'Plano Corrida Teste', 1200.00, 3, 'cartao_credito',
 '{"rota":"prospect","tier":null,"pedidoResumo":{"linhas":[{"label":"Plano Corrida Mensal","valor":1200},{"label":"Kit Corrida","valor":0,"nota":"Cortesia"}]}}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.corrida_inscricoes_prova (id, venda_id, cpf_hash, cpf_encrypted, cpf_ultimos3, data_nascimento, nome, sobrenome, email, telefone, rota, provas, pedido_resumo, inscricao_prova_completa)
VALUES ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'teste-hash-email-qp', 'teste-enc', '000', '1990-01-01', 'Teste', 'QP', 'contatofortem@gmail.com', '51999990000', 'prospect',
 '[{"nome":"MIPOA 2026","distancia":"21k"}]'::jsonb,
 '{"linhas":[{"label":"Plano Corrida Mensal","valor":1200},{"label":"Kit Corrida","valor":0,"nota":"Cortesia"}]}'::jsonb,
 false)
ON CONFLICT (id) DO NOTHING;