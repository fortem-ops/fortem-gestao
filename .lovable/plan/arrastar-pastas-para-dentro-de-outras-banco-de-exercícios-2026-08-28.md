# Arrastar pastas para dentro de outras (Banco de Exercícios)

Hoje a migração move apenas os exercícios: o grupo de origem continua existindo (ou some), mas a "pasta" em si nunca é aninhada. A ideia agora é poder pegar uma pasta inteira e soltá-la dentro de outra, direto na lista, sem passar pela aba Migrar.

## Comportamento

**Arrastar um grupo para cima de outro grupo**
- O grupo arrastado deixa de existir como grupo.
- Cada subcategoria dele passa a ser subcategoria do grupo de destino, com o mesmo nome (sem prefixo), na ordem original, logo após as subcategorias já existentes no destino.
- Se já existir uma subcategoria de mesmo nome no destino, os exercícios são unidos nela (sem duplicar).
- Todos os exercícios acompanham a subcategoria correspondente.
- Antes de aplicar, aparece uma confirmação com o resumo: "Mover 63 exercícios de Liberação Miofascial (9 subcategorias) para dentro de Preparação Movimento?".

**Arrastar uma subcategoria para outro grupo**
- Na aba Subcategorias, além de reordenar dentro do grupo atual, a lista de grupos fica visível como alvos de soltura.
- Ao soltar a subcategoria sobre outro grupo, ela muda de grupo levando junto todos os seus exercícios; se o nome já existir no destino, os exercícios são unidos.
- Confirmação com contagem antes de aplicar.

**Reordenar continua igual**
- Soltar sobre a alça de arraste / metade superior de uma linha reordena (comportamento atual).
- Soltar sobre o corpo da linha (com destaque visual "soltar dentro") aninha. As linhas de destino ganham realce enquanto o item é arrastado, para deixar claro qual ação vai acontecer.

**Permissões**: somente Coordenador e Admin, como já é hoje.

## Detalhes técnicos

- Banco: nova função `fn_mover_grupo_para_grupo(p_grupo_origem, p_grupo_destino)` — `SECURITY DEFINER`, `search_path = public`, checagem `is_coordinator_or_admin(auth.uid())`. Reaproveita a lógica de `fn_migrar_grupo_preservando_subs` (reescrita do array jsonb `grupos` em `exercicios_personalizados`, criação das subcategorias faltantes no destino, deduplicação) e, ao final, remove as linhas do grupo de origem em `exercicio_categorias`. Retorna a quantidade de exercícios afetados. `EXECUTE` revogado de `public`/`anon`.
- Banco: nova função `fn_mover_sub_para_grupo(p_grupo_origem, p_sub, p_grupo_destino)` com as mesmas garantias — troca o par (grupo, sub) nos exercícios, cria a linha da subcategoria no destino, remove a linha de origem.
- `src/hooks/useExerciseCategories.ts`: mutations `moverGrupoParaGrupo` e `moverSubParaGrupo`, invalidando `exercicio-categorias` e `exercicios-personalizados`.
- `src/components/student/ManageCategoriesDialog.tsx`: estados de drag passam a distinguir `modo: "reordenar" | "aninhar"` conforme a zona de soltura; realce visual (`ring`) na linha alvo; `AlertDialog` de confirmação com a prévia por subcategoria (usa `contarPorSubcategoria`/`contarExercicios` já existentes). Na aba Subcategorias, uma faixa com os demais grupos serve de alvo de soltura.
- Nenhuma mudança no schema de `exercicios_personalizados`; nada é apagado sem confirmação explícita.
