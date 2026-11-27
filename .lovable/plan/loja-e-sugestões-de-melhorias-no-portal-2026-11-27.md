# Loja e Sugestões de Melhorias no portal

## 1. Loja da Fortem no menu lateral
- A loja do portal já existe (`/portal/loja`, carrinho e produto). Adicionar o item "Loja da Fortem" no menu lateral do portal, antes de "Configurações do App".

## 2. Sugestões de Melhorias — aluno
- Novo item "Sugestões de Melhorias" no menu lateral → página `/portal/sugestoes`.
- Formulário: categoria (Treinos, Agenda, App, Estrutura, Atendimento, Outro), título e descrição.
- Lista "Minhas sugestões" com status (Em análise / Aprovada / Recusada) e a resposta da equipe quando houver.
- Tema do portal (claro/escuro), cantos retos, sem emoji.

## 3. Sugestões de Melhorias — equipe
- Nova aba "Sugestões" no menu do software, visível só para Coordenador e Admin.
- Lista com filtros por status e categoria, contador de pendentes, nome do aluno e data.
- Ao abrir: ler, escrever resposta e marcar como Aprovada ou Recusada (resposta obrigatória ao recusar). Registra quem respondeu e quando.
- Aviso ao aluno (central do portal + push) quando a sugestão for respondida.
- Aviso interno para coordenadores/admins quando chegar sugestão nova.

## Detalhes técnicos
- Tabela `portal_sugestoes` (aluno_id, user_id, categoria, titulo, descricao, status pendente/aprovada/recusada, resposta, respondido_por, respondido_em, timestamps), GRANTs, RLS: aluno insere/lê só as suas; coordenador/admin leem e atualizam via `has_role`. Aluno não altera status/resposta (gatilho de proteção).
- RPC `fn_responder_sugestao` SECURITY DEFINER, `search_path=public`, sem anon, gravando audit_log e o aviso ao aluno (dedupe por referência da sugestão).
- Arquivos: `PortalLayout.tsx` (menu), `PortalSugestoes.tsx`, página de equipe + rota protegida e item na sidebar, helper e teste de regras (validação, quem pode responder, recusa exige resposta).
- Vitest, ESLint e build; Publish necessário para o frontend.
