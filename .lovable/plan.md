## Problema

Ao criar um Lead (que faz `INSERT` em `alunos` sem plano), o trigger `aluno_clube_sync_ins` dispara `fn_clube_sync_membro`, que chama `fn_clube_nivel_por_plano`. Essa função ainda retorna valores antigos do enum (`'start'`, `'start_plus'`, `'power'`, `'pro'`, `'max'`, `'agregador'`), que foram removidos quando o enum `clube_nivel_membro` foi reestruturado para `bronze | prata | ouro | diamante | platina`. Resultado: `invalid input value for enum clube_nivel_membro: "start"`.

## Correção

Atualizar apenas a função `public.fn_clube_nivel_por_plano` para devolver valores válidos do enum atual, seguindo a mesma lógica já usada em `fn_sync_nivel_membro`:

- Sem plano ativo (caso do Lead) → `bronze`
- Plano Gympass/Wellhub/Total Pass (agregador) → `bronze`
- Plano contém `max` → `platina`
- Plano contém `pro` → `diamante`
- Plano contém `power` → `ouro`
- Demais (Start, Start+, VIP, etc.) → `prata`

Status permanece `'ativo'`.

Nenhuma outra função, trigger, tabela ou código de frontend precisa mudar — o bug é isolado nessa função.

## Detalhes técnicos

Migration única que faz `CREATE OR REPLACE FUNCTION public.fn_clube_nivel_por_plano(_aluno_id uuid)` mantendo assinatura, `SECURITY DEFINER` e `search_path` atuais, substituindo o `CASE` por mapeamento contra o enum novo e usando `bronze` como fallback. Após aplicar, criar um lead de teste deve funcionar sem o erro de enum.
