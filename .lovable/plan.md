# Gerenciar, migrar e reordenar categorias do Banco de Exercícios

Ampliar o modal "Gerenciar Categorias" (Banco de Exercícios) para que Coordenador e Admin possam, além de criar/renomear/excluir:

1. **Migrar (mover)** exercícios de um Grupo/Subcategoria para outro, em lote.
2. **Reordenar (posicionamento)** grupos e subcategorias por arrastar e soltar.

## Migrar

- Nova aba "Migrar" no modal, com:
  - Origem: Grupo + (opcional) Subcategoria — quando a subcategoria fica em branco, migra o grupo inteiro.
  - Destino: Grupo + Subcategoria.
  - Prévia da quantidade de exercícios afetados antes de confirmar.
  - Opção "Excluir a categoria de origem após migrar" (desmarcada por padrão).
- Ao confirmar, todos os exercícios vinculados à origem passam a apontar para o destino. Se um exercício já estiver no destino, não é duplicado.
- Depois da migração, a exclusão da categoria de origem deixa de ser bloqueada (hoje ela é bloqueada quando existem exercícios vinculados).

## Reordenar

- Nas abas Grupos e Subcategorias, cada linha ganha alça de arrastar (mesmo padrão já usado na lista de exercícios).
- Ao soltar, a nova ordem é salva e passa a valer em todo o sistema (lista lateral do banco, selects de edição de exercício, filtros).

## Permissões

Somente Coordenador e Admin veem e usam essas ações — as regras de acesso do banco já restringem alterações a esses papéis; a interface segue o mesmo critério (botão de gerenciar já é condicionado a coordenador/admin).

## Detalhes técnicos

- **Banco**: nova função `fn_migrar_exercicio_categoria(p_grupo_origem, p_sub_origem, p_grupo_destino, p_sub_destino)` — `SECURITY DEFINER`, `search_path = public`, com checagem `is_coordinator_or_admin(auth.uid())`. Ela reescreve o array `grupos` (jsonb) de `exercicios_personalizados`, substituindo os pares de origem pelo destino e removendo duplicatas, e retorna a quantidade de exercícios afetados. `EXECUTE` revogado de `public`/`anon`.
- **Hook** `src/hooks/useExerciseCategories.ts`: novas mutations `migrar` (RPC acima), `reorderGrupos` e `reorderSubs` (atualizam `ordem_grupo` / `ordem_sub` em lote na tabela `exercicio_categorias`), todas invalidando as queries `exercicio-categorias` e `exercicios-personalizados`.
- **UI** `src/components/student/ManageCategoriesDialog.tsx`: terceira aba "Migrar" com selects de origem/destino, contagem prévia (query `head/count` com filtro `cs` em `grupos`, igual ao `countExerciciosNoGrupo` atual) e confirmação; drag-and-drop nas listas de grupos e subcategorias usando os handlers HTML5 já empregados em `StudentExerciseBank.tsx`.
- Nenhuma alteração no schema de `exercicios_personalizados`; nenhum dado é apagado sem confirmação explícita.
