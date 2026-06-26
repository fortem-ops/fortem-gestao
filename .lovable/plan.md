
## Problema

No Relatório de Ponto aparece um profissional com nome "—". A causa: as queries de `ponto_jornadas`, `ponto_eventos` e horários trazem registros cujo `usuario_id` não está mais na lista de profissionais ativos (lista derivada de `user_roles` com role `professor`/`admin` + `profiles`). Quando o usuário foi removido (caso Igor), o `profMap.get(uid)` retorna `undefined` e o código renderiza `"—"`.

## Solução

### 1. Filtrar no front (`src/pages/RelatorioPonto.tsx`)
Tratar `profissionais` como a fonte de verdade de quem deve aparecer no relatório:

- Construir `profIdsAtivos = new Set(profissionais.map(p => p.user_id))`.
- Em todos os agrupamentos/listagens que hoje usam `profMap.get(uid) ?? "—"`, ignorar registros cujo `usuario_id` não esteja em `profIdsAtivos`:
  - Agregado mensal (linhas ~320-342).
  - Linhas diárias / linhas sintéticas (jornadas, faltas, ausências) — linhas ~370-414.
  - Geração de "Faltas" a partir de `ponto_horarios_professor` (só cria falta se o usuário ainda é ativo).
- Remover o fallback `"—"` (passa a ser código morto, já que filtramos antes).
- Os Selects de filtro já usam `profissionais`, então não precisam mudar.

Isso resolve imediatamente o caso do Igor e qualquer outro usuário deletado/sem role.

### 2. Regra de desligamento no banco
Para garantir que, ao desligar/excluir um funcionário, ele pare de gerar relatório (inclusive sem depender só do filtro do front), criar trigger:

- **Trigger `trg_ponto_desligamento_usuario`** em `public.user_roles` AFTER DELETE: se o usuário não tem mais nenhuma role em (`professor`,`admin`), executar:
  - `UPDATE public.ponto_horarios_professor SET ativo = false WHERE usuario_id = OLD.user_id;`
  - Isso impede geração futura de "Faltas" sintéticas e de jornadas previstas.
- **Trigger equivalente** em `auth.users` não é permitido (schema bloqueado). Como `user_roles.user_id` tem FK `ON DELETE CASCADE` para `auth.users`, ao deletar um usuário o trigger acima dispara naturalmente via cascade.
- Histórico em `ponto_jornadas`/`ponto_eventos` é preservado (auditoria), mas deixa de aparecer no relatório por causa do filtro do passo 1.

### 3. Limpeza pontual
Rodar uma vez:
```sql
UPDATE public.ponto_horarios_professor h
SET ativo = false
WHERE ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = h.usuario_id AND r.role IN ('professor','admin')
  );
```
Para neutralizar o caso do Igor e similares já existentes.

## Arquivos / mudanças
- `src/pages/RelatorioPonto.tsx` — filtragem por `profIdsAtivos` em agregados, linhas diárias e geração de faltas.
- Migração SQL — trigger em `user_roles` + função `fn_ponto_on_role_revogada` (com `search_path = public`).
- Data fix SQL — desativar horários órfãos existentes.

## Fora do escopo
- Não alterar UI/filtros (apenas a lista de dados exibida).
- Não apagar histórico de `ponto_jornadas`/`ponto_eventos`.
