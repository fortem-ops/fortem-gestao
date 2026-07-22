## Plano: Criar usuário de teste Pro

### Objetivo
Preparar a aluna BRUNA MEYER como usuário de teste do plano Pro, ajustando seu email e garantindo que não tenha vínculo de auth.user.

### Alterações no banco de dados
1. **Atualizar email** da aluna BRUNA MEYER para `teste.pro@fortem.app`.
2. **Garantir `user_id = NULL`** no registro dela, para que possa ser vinculada a um novo login de teste posteriormente.
3. **Confirmar** os dados atualizados com SELECT de validação.

### SQL a ser executado
```sql
-- 1. Atualizar email da Bruna Meyer para email de teste
UPDATE public.alunos 
SET email = 'teste.pro@fortem.app'
WHERE id = (SELECT id FROM public.alunos WHERE nome = 'BRUNA MEYER' AND status = 'ativo' LIMIT 1);

-- 2. Garantir user_id NULL
UPDATE public.alunos 
SET user_id = NULL
WHERE nome = 'BRUNA MEYER' AND status = 'ativo';

-- 3. Confirmar
SELECT a.id, a.nome, a.email, a.user_id, p.tipo, a.frequencia_semanal
FROM public.alunos a
JOIN public.planos p ON p.aluno_id = a.id AND p.ativo = true
WHERE a.nome = 'BRUNA MEYER' AND a.status = 'ativo';
```

### Impacto
- Apenas o registro da aluna BRUNA MEYER será alterado.
- Nenhuma mudança de schema será feita.
- A confirmação final mostrará os dados atualizados.