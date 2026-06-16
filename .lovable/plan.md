## Problema

Em **Carteira de Alunos → filtro "Filtrar por professor"**, só aparecem: o professor logado, "Todos os professores" e "Sem professor". Os demais professores ficam ocultos.

**Causa:** A consulta `professors-carteira` em `src/pages/CarteiraAlunos.tsx` busca a lista pela tabela `user_roles`, cuja política RLS é "Self or admin can view roles". Ou seja, um professor (não-admin) só enxerga a própria linha em `user_roles`, então o `.in("user_id", roles…)` que alimenta o select de profiles retorna apenas ele mesmo.

A tabela `alunos`, por outro lado, tem política que permite a qualquer staff (professor/nutri/fisio/coord/admin) ler todos os registros — então podemos derivar a lista de professores a partir dos `responsavel_id` distintos de `alunos`, sem depender de `user_roles`.

## Mudança

Arquivo: `src/pages/CarteiraAlunos.tsx`

Substituir a query `professors-carteira` por uma que:
1. Busca todos os `responsavel_id` distintos (não nulos) da tabela `alunos`.
2. Busca em `profiles` os `full_name` desses ids.
3. Retorna a lista ordenada por nome para alimentar o `<Select>` de filtro e o dialog de transferência.

Resultado: o professor logado passa a ver todos os profissionais que possuem alunos sob responsabilidade, podendo filtrar a carteira de qualquer um deles. As opções "Todos os professores" e "Sem professor" permanecem.

Nenhuma alteração de RLS, schema ou lógica de negócio — apenas a fonte da lista de professores no filtro.