# Voltar o botão de editar exercícios das Fases (Banco de Treinos)

## O que está acontecendo

Verifiquei no navegador logado como admin: ao abrir uma Fase em Banco de Treinos, a tela mostra o selo "Somente leitura" e nenhum controle de edição (troca de exercício, categoria, séries, reps, dias).

Causa confirmada: a página Banco de Treinos tem uma consulta própria de papéis usando a mesma chave de cache (`["user-roles", user.id]`) que o hook global `useUserRoles`. O hook global escreve nessa chave um objeto (`{ isAdmin, isCoordAdmin, isParceiro }`), a página espera uma lista de papéis. Como o hook global roda antes (menu/layout), a página recebe o objeto do cache, a checagem de lista falha e `canEdit` vira `false` — mesmo para admin e coordenador. Confirmei também que a permissão no banco está correta (o usuário é admin e a leitura de papéis funciona).

## Correção

Em `src/pages/BancoTreinos.tsx`:

- Remover a consulta local de papéis (`useQuery` com chave `["user-roles", ...]`).
- Passar a usar o hook existente `useUserRoles()` e definir `canEdit = !!data?.isCoordAdmin` (cobre admin e coordenador, mesma regra atual).
- Enquanto o hook estiver carregando, manter `canEdit` como falso (comportamento atual) e nada mais muda visualmente.

Nenhuma mudança de banco, SQL ou RLS é necessária.

## Verificação

Abrir `/banco-treinos` como admin, entrar em uma Fase e confirmar que o selo "Somente leitura" some e voltam: seletor de exercício, selects de categoria/subcategoria, campos de séries/reps e os botões de dias (T1–T4).
