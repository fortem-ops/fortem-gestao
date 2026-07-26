## Bug: edições no 5-3-1 não persistem ao reabrir

### Causa raiz (confirmada)
O autosave em `Prescricao531Editor.saveDraft` grava no banco corretamente (confirmei via query: `updated_at` da linha do treino é atualizado a cada mudança). O problema está no consumidor:

- `StudentWorkouts.tsx` mantém a lista `treinos` em `useQuery(["treinos", student.id])` e só chama `refetch()` via `onSaved`.
- `WorkoutDetail` só encaminha `onSaved` para `PersonalizadoEditor`; **não passa nada para `Prescricao531Editor`**, e o editor 5-3-1 nem aceita esse prop.
- Ao fechar o dialog e reabrir, o card clicado ainda é o objeto `Treino` do cache antigo → `viewing.conteudo` sem o exercício que foi salvo.

### Correções

1. **`Prescricao531Editor.tsx`**
   - Adicionar `onSaved?: () => void` na interface `Props`.
   - Chamar `onSaved?.()` ao final do `saveDraft` bem-sucedido (tanto no update quanto no insert) e também em `handlePublish`.

2. **`WorkoutDetail.tsx`**
   - Repassar `onSaved={onSaved}` no `<Prescricao531Editor …/>` (linha ~93).

3. **`StudentWorkouts.tsx`**
   - No `onSaved` do `WorkoutDetail`, além de `refetch()`, atualizar o `viewing` para o item recarregado (buscar pelo `id` no resultado do refetch) — garante que a próxima abertura mostre o conteúdo mais novo mesmo sem fechar/reabrir.

### Fora de escopo
- Layout do PDF, RLS, shape do JSON, editor Personalizado, ajustes visuais.

### Verificação
- `tsgo` sem novos erros.
- Editar uma prescrição 5-3-1 da Bruna Meyer, adicionar acessório, fechar dialog, reabrir — o acessório aparece.
