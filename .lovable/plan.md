## Mudanças

### 1) Duplicar modelo do Banco de Treinos para "Meus Modelos"

Em `src/pages/BancoTreinos.tsx`, nos cards de modelos personalizados (loop `modelosPorAutor`, ~linha 1211), adicionar um botão **Duplicar** (ícone `Copy` do lucide-react) sempre visível ao lado dos botões Editar / Excluir.

Comportamento: insere uma nova linha em `banco_treinos_personalizados` com:
- `criado_por = user.id` (sempre o usuário logado, mesmo duplicando o modelo de outro professor)
- `nome = "{nome original} (cópia)"`
- `conteudo` = mesmo `conteudo` do modelo original

Em caso de sucesso: toast "Modelo duplicado em Meus Modelos" e `refetchModelos()`. A cópia aparece automaticamente na seção "Meus Modelos" do próprio usuário.

### 2) Restringir exclusão ao autor (e coord/admin)

Reverter a permissão de exclusão liberada anteriormente — voltar para "apenas o autor (ou coord/admin) pode excluir":

**Migração SQL** — restaurar a política DELETE original:

```sql
DROP POLICY IF EXISTS "Staff can delete personalizados" ON public.banco_treinos_personalizados;
CREATE POLICY "Author or coord/admin can delete personalizados"
  ON public.banco_treinos_personalizados
  FOR DELETE TO authenticated
  USING ((auth.uid() = criado_por) OR is_coordinator_or_admin(auth.uid()));
```

**UI** — em `BancoTreinos.tsx`, voltar a exibir o botão Excluir apenas quando `isOwner || canEdit` (mesma regra do botão Editar). Concretamente, juntar Editar e Excluir de novo sob `{canManage && (…)}`. O botão Duplicar continua sempre visível.

### Arquivos

- `src/pages/BancoTreinos.tsx` — adicionar botão Duplicar + mutação de duplicação; restringir botão Excluir a `canManage`.
- Migração: restaurar política DELETE para autor ou coord/admin em `banco_treinos_personalizados`.