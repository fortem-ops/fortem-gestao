# Promover subcategoria a categoria (e categoria a grupo)

## Situação atual (verificada no banco)

- **LPO** hoje é uma **subcategoria** de `Parte Principal > Força > LPO`.
- A taxonomia tem 3 níveis: Grupo > Categoria > Subcategoria > exercícios.
- Os movimentos existentes só "descem" ou andam de lado:
  - Grupo vira Categoria de outro grupo
  - Categoria muda de Grupo
  - Subcategoria muda de Categoria
- Não existe o caminho inverso ("retroceder"): **subir uma subcategoria para virar Categoria**, nem **subir uma categoria para virar Grupo**. Por isso arrastar LPO para "Parte Principal" não funciona — o sistema só aceita soltá-la dentro de outra categoria.

## O que será adicionado

**1. Promover Subcategoria → Categoria**
- Arrastar uma subcategoria e soltar sobre o nome de um **Grupo** (não sobre uma categoria) a transforma em Categoria daquele grupo, levando todos os exercícios junto.
- Os exercícios passam a ter `categoria = LPO` e uma subcategoria padrão com o mesmo nome (`LPO`), para continuarem navegáveis no 4º nível.
- Exemplo do pedido: `Parte Principal > Força > LPO` passa a `Parte Principal > LPO > LPO > exercícios`.

**2. Promover Categoria → Grupo**
- Arrastar uma categoria e soltar na área "Promover a grupo" (nova zona no topo da lista de Grupos) cria um Grupo com o mesmo nome, mantendo suas subcategorias e exercícios.

**3. Confirmação e contagem**
- Igual aos movimentos atuais: diálogo de confirmação mostrando quantos exercícios serão afetados antes de aplicar, e mensagem de sucesso ao final.
- Nada é apagado; a origem deixa de existir apenas no nível antigo.

**Permissões**: continua restrito a Coordenador e Admin.

## Detalhes técnicos

- Novas funções SQL (`SECURITY DEFINER`, `search_path = public`, checagem `is_coordinator_or_admin`, `EXECUTE` revogado de `public`/`anon`):
  - `fn_promover_sub_para_categoria(p_grupo, p_categoria_origem, p_sub, p_grupo_destino)` — reescreve o array `grupos` (jsonb) de `exercicios_personalizados` trocando `{grupo, categoria, subcategoria}` por `{grupo: destino, categoria: sub, subcategoria: sub}`, cria a linha correspondente em `exercicio_categorias` (com `ordem_categoria` no fim do destino) e remove a linha antiga; retorna a quantidade de exercícios afetados.
  - `fn_promover_categoria_para_grupo(p_grupo_origem, p_categoria)` — cria o grupo com o nome da categoria, remapeia as linhas de `exercicio_categorias` e o jsonb dos exercícios mantendo as subcategorias.
- `src/hooks/useExerciseCategories.ts`: mutations `promoverSubParaCategoria` e `promoverCategoriaParaGrupo`, invalidando `exercicio-categorias` e `exercicios-personalizados`.
- `src/components/student/ManageCategoriesDialog.tsx`: nas abas Subcategorias e Categorias, novas zonas de soltura (grupo como alvo de subcategoria; faixa "Promover a grupo" para categoria), reaproveitando `hoverAlvo`, a contagem prévia e o `AlertDialog` de confirmação já existentes.
- Sem alteração de schema; treinos já salvos continuam válidos graças ao resolvedor de níveis em `src/lib/exerciseMapping.ts`.
- Suíte de testes executada ao final.
