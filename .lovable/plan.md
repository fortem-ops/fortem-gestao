# Reverter a migração de Liberação Miofascial e migrar mantendo subcategorias

## O que aconteceu (verificado no banco)

- O grupo **Liberação Miofascial** não existe mais na tabela de categorias (foi excluído após a migração).
- Os **63 exercícios** dele estão hoje todos em **Preparação Movimento / Liberação miofascial**, todos com data de alteração 28/08 18:06 — ou seja, as subcategorias originais (Pé/Tornozelo, Perna, Joelho/Coxa, Quadril, Lombar, Torácica, Ombro/Escápula, Cervical, Cotovelo/Punho) foram achatadas em uma só.
- Não existe trilha de auditoria para a tabela de exercícios, então **a associação exercício → subcategoria original não é recuperável automaticamente**. A lista de subcategorias originais, sim (está no histórico de criação do grupo).

## Reversão proposta

1. Recriar o grupo **Liberação Miofascial** com as 9 subcategorias originais, na ordem original.
2. Devolver os 63 exercícios para esse grupo, distribuindo-os nas subcategorias por regras de nome (ex.: "panturrilha/tibial/aquiles/fáscia plantar" → Pé/Tornozelo; "lombar" → Lombar; "trapézio/escapular/peitoral/grande dorsal" → Ombro/Escápula; "nuca/cervical" → Cervical; "punho/antebraço/tríceps" → Cotovelo/Punho; "glúteo/psoas/adutor" → Quadril; "quadríceps/isquiotibiais/coxa" → Joelho/Coxa; "torácica" → Torácica; resto → Perna ou Padrão).
3. Antes de aplicar, apresento a **lista completa dos 63 exercícios com a subcategoria sugerida** para você conferir/corrigir. Nada é gravado sem seu OK.
4. Remover o vínculo com Preparação Movimento / Liberação miofascial nesses exercícios (o grupo Preparação Movimento em si permanece).

## Nova opção na migração: preservar subcategorias

Na aba **Migrar** do modal Gerenciar Categorias:

- Quando a origem for o **grupo inteiro**, passa a existir a escolha de destino:
  - **Manter subcategorias** (novo padrão): move os exercícios para o grupo de destino conservando o nome da subcategoria de cada um; as subcategorias que não existirem no destino são criadas automaticamente, respeitando a ordem da origem.
  - **Unificar em uma subcategoria**: comportamento atual (todos vão para uma subcategoria escolhida).
- Quando a origem for uma subcategoria específica, continua exigindo a subcategoria de destino (mas ela pode ser digitada como nova, em vez de só escolhida).
- A prévia passa a mostrar a contagem por subcategoria (ex.: "Lombar: 6, Quadril: 9 …") antes de confirmar.

## Detalhes técnicos

- Migração SQL: recriação das linhas em `exercicio_categorias` para o grupo e reclassificação dos 63 registros em `exercicios_personalizados` (reescrita do array `grupos` jsonb), feita em uma única transação após sua conferência da lista.
- Nova função `fn_migrar_grupo_preservando_subs(p_grupo_origem, p_grupo_destino)` — `SECURITY DEFINER`, `search_path = public`, com checagem `is_coordinator_or_admin`; ela cria as subcategorias faltantes no destino e troca apenas o `grupo` de cada par, mantendo `subcategoria`. `EXECUTE` revogado de `public`/`anon`.
- `src/hooks/useExerciseCategories.ts`: nova mutation `migrarGrupoPreservandoSubs` e prévia agrupada por subcategoria; invalida `exercicio-categorias` e `exercicios-personalizados`.
- `src/components/student/ManageCategoriesDialog.tsx`: alternância "Manter subcategorias / Unificar" na aba Migrar, campo de subcategoria de destino com criação livre e prévia detalhada.
