## Aluno encontrado

- **Nome:** Frederico Luiz Lanziotti Muller
- **ID:** `ab510e94-1993-48b9-bd31-1aa3e0e8bfcf`
- **Email atual (guardar para restaurar depois):** `fredmuller51@hotmail.com`

Observação: o nome no banco está como "Muller" (uma letra `l`), não "Mueller". É o único registro que bate — os demais Fredericos têm sobrenomes diferentes.

## Migration proposta

Um único UPDATE, escopado por `id` para eliminar risco de atingir outro aluno:

```sql
UPDATE public.alunos
SET email = 'teste.frederico@fortem.app'
WHERE id = 'ab510e94-1993-48b9-bd31-1aa3e0e8bfcf';
```

Nada mais é alterado: sem mexer em contratos, planos, `user_id`, avaliações ou qualquer outro campo. O vínculo em si acontece quando você fizer login pelo portal — a RPC `fn_portal_link_aluno` casa pelo email e preenche o `user_id` do aluno.

## Passos para você depois da migration

1. Criar o usuário no painel de auth com:
   - Email: `teste.frederico@fortem.app`
   - Senha: `Fortem@2025`
   - Confirmar o email (auto-confirm) para poder logar direto.
2. Logar no `/portal/login` com essas credenciais — o `StudentPortalProvider` chama `fn_portal_link_aluno` automaticamente e vincula o `user_id` ao aluno.
3. Para restaurar depois do teste, rodo uma migration inversa devolvendo o email para `fredmuller51@hotmail.com` (e, se quiser, limpando o `user_id` do aluno para desfazer o vínculo).

Me confirme para eu aplicar a migration.
