# Terceiro nível na taxonomia do Banco de Exercícios

Hoje a taxonomia tem 2 níveis: **Grupo > Subcategoria > exercícios**. Por isso, ao arrastar "Mobilidade Articular" para dentro de "Preparação Movimento", o grupo de origem precisa desaparecer — não existe onde encaixá-lo.

O pedido é passar para 3 níveis:

```text
Grupo            Preparação Movimento
 └ Categoria      Mobilidade Articular
    └ Subcategoria  Quadril, Ombro, Tornozelo, ...
       └ Exercícios
```

## Comportamento

**Navegação (Banco de Exercícios)**
- A lista lateral passa a ter três níveis expansíveis: Grupo > Categoria > Subcategoria; os exercícios aparecem ao selecionar a subcategoria.
- Ao selecionar uma Categoria, mostra os exercícios de todas as subcategorias dela; ao selecionar um Grupo, de todas as categorias.

**Mover uma pasta para dentro de outra**
- Arrastar um **Grupo** para dentro de outro Grupo: o grupo arrastado vira **Categoria** do destino, mantendo o nome, e todas as suas subcategorias e exercícios vão junto. Nada é apagado. É exatamente o caso "Mobilidade Articular vira categoria dentro de Preparação Movimento".
- Arrastar uma **Categoria** para outro Grupo: ela muda de grupo levando subcategorias e exercícios.
- Arrastar uma **Subcategoria** para outra Categoria: leva os exercícios junto.
- Reordenar continua funcionando dentro de cada nível (soltar na metade superior reordena; soltar no corpo aninha), com confirmação e contagem antes de aplicar.

**Gerenciar Categorias**
- O modal ganha três abas de estrutura: Grupos, Categorias e Subcategorias, cada uma com criar, renomear, excluir, reordenar e mover.
- Renomear e excluir continuam propagando para os exercícios; excluir só é permitido quando não há exercícios abaixo.

**Edição de exercício e seletores**
- Onde hoje se escolhe Grupo + Subcategoria (editor de exercício, seletor de exercícios, prescrições 5-3-1 / M102 / Plan Strong / Personalizado / Auxiliares), passa a haver Grupo + Categoria + Subcategoria encadeados.

**Compatibilidade com o que já existe**
- Todos os dados atuais são preservados: cada grupo existente passa a ter uma categoria com o mesmo nome do grupo (nível intermediário implícito), e as subcategorias ficam sob ela. Nada muda visualmente para quem não reorganizar nada, além do nível a mais na árvore.

**Permissões**: criar/mover/excluir continua restrito a Coordenador e Admin.

## Detalhes técnicos

- `exercicio_categorias`: nova coluna `categoria text not null` e `ordem_categoria int not null default 0`; a chave única passa a ser `(grupo, categoria, subcategoria)`. Backfill: `categoria = grupo` em todas as linhas existentes.
- `exercicios_personalizados.grupos` (jsonb): cada item passa a ter `{ grupo, categoria, subcategoria }`. Migração de dados preenche `categoria` com o valor de `grupo` nos registros existentes. Leitura no frontend usa fallback `item.categoria ?? item.grupo` para não quebrar registros antigos.
- Funções SQL (todas `SECURITY DEFINER`, `search_path = public`, checagem `is_coordinator_or_admin`, `EXECUTE` revogado de `public`/`anon`):
  - `fn_mover_grupo_como_categoria(p_grupo_origem, p_grupo_destino)` — converte o grupo em categoria do destino, reescrevendo o jsonb e as linhas de `exercicio_categorias`; sem exclusão de conteúdo.
  - `fn_mover_categoria_para_grupo(p_grupo_origem, p_categoria, p_grupo_destino)`.
  - `fn_mover_sub_para_categoria(p_grupo_origem, p_categoria_origem, p_sub, p_grupo_destino, p_categoria_destino)`.
  - Ajuste de `rename_exercicio_categoria`, `fn_migrar_exercicio_categoria` e das funções de mover já existentes para o novo formato de 3 níveis (as antigas de 2 níveis são substituídas).
- `src/hooks/useExerciseCategories.ts`: modelo passa a `{ grupo, categorias: [{ nome, subcategorias: [] }] }`; novas mutations de mover/reordenar por nível; `contarExercicios` aceita os três parâmetros.
- `src/components/student/ManageCategoriesDialog.tsx`: três abas de estrutura + drag-and-drop entre níveis com `AlertDialog` de confirmação.
- `src/components/student/StudentExerciseBank.tsx` e `src/pages/BancoTreinos.tsx`: árvore de três níveis na navegação e nos filtros.
- Selects encadeados em `ExerciseSelector.tsx`, `AuxiliaresBlock.tsx`, `Prescricao531Editor.tsx`, `PrescricaoM102Editor.tsx`, `PrescricaoPlanStrongEditor.tsx`, `PersonalizadoEditor.tsx` e `src/lib/exerciseMapping.ts`.
- A suíte de testes é executada ao final.
