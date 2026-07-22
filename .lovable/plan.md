## Plano: Criar usuário auth e vincular à Bruna Meyer

### Objetivo
Garantir que a aluna Bruna Meyer (email `teste.pro@fortem.app`) tenha um usuário de autenticação correspondente e que o `user_id` em `public.alunos` esteja corretamente vinculado.

### Passos

1. **Verificar existência do usuário auth**
   - Executar: `SELECT id, email FROM auth.users WHERE email = 'teste.pro@fortem.app';`
   - Se já existir, prosseguir para o vínculo.

2. **Criar usuário auth (se não existir)**
   - Inserir na tabela `auth.users` com o email `teste.pro@fortem.app`.
   - Usar senha temporária segura ou deixar para reset posterior.
   - Confirmar criação com `SELECT id, email FROM auth.users WHERE email = 'teste.pro@fortem.app';`.

3. **Vincular `user_id` na tabela `public.alunos`**
   - Atualizar o registro da Bruna Meyer com o `id` do usuário auth criado/encontrado.
   - Query: `UPDATE public.alunos SET user_id = '<auth_user_id>' WHERE email = 'teste.pro@fortem.app';`

4. **Confirmar vínculo**
   - Executar: `SELECT a.id, a.nome, a.email, a.user_id, p.tipo, a.frequencia_semanal FROM public.alunos a JOIN public.planos p ON p.aluno_id = a.id AND p.ativo = true WHERE a.email = 'teste.pro@fortem.app';`

### Notas
- Não serão feitas alterações em arquivos do projeto.
- As operações serão executadas via ferramenta de query/migração do backend.