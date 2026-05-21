## Problema

1. Após a "Indicação da Aula Experimental" vincular um treino (fase / personalizado / etc.), ao reabrir o treino na ficha do aluno, ele aparece em modo **somente leitura** — o `ExerciseSelector` mostra apenas texto e não permite trocar exercícios.
2. Mesmo destravando a UI, a política RLS de `treinos` só permite UPDATE para o **autor** do treino ou coord/admin. Como a prescrição automática usa o `autor_id` de quem disparou, qualquer outro professor recebe erro ao tentar salvar.

## Causa

- `src/components/student/StudentWorkouts.tsx` (linha 162) abre o `WorkoutDetail` com `readOnly` **fixo**, sem opção de edição.
- `WorkoutDetail` não repassa `readOnly` para o `PersonalizadoEditor` (já é editável), mas o caminho de templates (fases) fica travado.
- Política RLS `Author or coord/admin can update treinos` impede edição por outros profissionais.

## Mudanças

### 1. UI — habilitar edição direta na ficha do aluno
`src/components/student/StudentWorkouts.tsx`
- Remover o atributo fixo `readOnly` do `<WorkoutDetail />`.
- Manter o diálogo atual; o usuário entra direto em modo edição (com botão **Salvar** visível).

### 2. RLS — liberar edição para todos os autenticados
Migration em `treinos`:
- Substituir a policy de UPDATE por uma que permita qualquer usuário autenticado (`USING true`), preservando DELETE restrito a admin e INSERT exigindo `autor_id = auth.uid()`.
- A nova versão salvará atualizando `updated_at`; o `autor_id` original é preservado (já é o comportamento atual do `handleSave`).

```sql
DROP POLICY "Author or coord/admin can update treinos" ON public.treinos;
CREATE POLICY "Authenticated can update treinos"
ON public.treinos FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);
```

## Fora de escopo

- Não alterar o módulo Avaliações Premium.
- Não mexer no `ExerciseSelector` em si — ele já funciona corretamente quando `readOnly=false`.
- Não alterar políticas de INSERT/DELETE de `treinos`.
- Não tocar no portal do aluno (`PortalWorkouts` permanece somente leitura).
