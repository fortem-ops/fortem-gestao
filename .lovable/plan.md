# Relatório — Cartões no Portal do Aluno

## 1. Já existe tela de cartões no portal?

Sim, em duas telas dentro de `RequireStudent`:

- `/portal/pagamentos` (`src/pages/portal/PortalPagamentos.tsx`) — seção de cartões: lista os cartões `ativo = true` do próprio aluno, ordenados por `is_default desc`, com **badge "Padrão"** no cartão principal, botão de estrela para tornar principal e lixeira para remover (soft delete: `ativo=false, is_default=false`).
- `/portal/perfil` (`src/pages/portal/PortalProfile.tsx`) — mesma listagem e as mesmas duas ações, porém a remoção aqui é **DELETE físico** (divergente da outra tela).

Ou seja, o item (2) do seu pedido — escolher qual cartão é o principal — **já existe funcionalmente**, mas a lógica está duplicada em dois arquivos e a UI de "Padrão" é apenas um badge discreto.

## 2. Existe cadastro de cartão dentro do portal?

Sim. `/portal/pagamentos` já abre o `CadastrarCartaoDialog` (`src/components/pagamentos/CadastrarCartaoDialog.tsx`) com `origem="portal_aluno"`. Não depende de link externo. `/portal/perfil` **não** tem esse botão — só lista.

Como a gravação passa pelo helper de substituição recém-implementado, hoje **todo cartão novo já entra como `is_default = true`** e substitui o anterior de mesmo `last4` — mas nada no diálogo informa isso ao aluno. É exatamente a lacuna do item (1).

## 3. RLS de `cartoes_salvos` para o aluno

O aluno **já tem** SELECT e UPDATE dos próprios cartões:

- `cartoes_self_select` (SELECT) — `aluno_id IN (select id from alunos where user_id = auth.uid())`
- `cartoes_self_update` (UPDATE) — mesma condição em `USING` e `WITH CHECK`
- `cartoes_self_delete` (DELETE) — mesma condição
- `cartoes_block_insert` (INSERT) — `with_check false`: nenhum insert pelo cliente; só service_role (edge functions)
- policies de admin/coordenador para leitura e gestão

O UPDATE do aluno é seguro por causa do trigger `cartoes_salvos_protect_immutable`: quando `auth.role() <> 'service_role'`, ele força de volta os valores antigos de `token_rede`, `last4`, `brand`, `holder_name`, validade, `origem`, `aluno_id` e `created_at`. Na prática, o aluno só consegue alterar `is_default` e `ativo`.

Estado atual dos dados: 6 cartões ativos, **0 alunos com mais de um `is_default = true`**, 1 aluno com dois cartões ativos.

## 4. Recomendação — RPC ou edge function?

**Nenhuma das duas.** A RLS + o trigger já cobrem o caso com segurança; criar RPC `SECURITY DEFINER` ou edge function só adicionaria superfície de ataque e latência sem ganho.

O problema real não é permissão, é **atomicidade e duplicação**: as duas telas fazem `update is_default=false` em todos os cartões do aluno e depois `is_default=true` no escolhido — duas chamadas separadas, sem transação. Se a segunda falhar, o aluno fica sem cartão principal (e a cobrança automática de recorrência escolhe cartão de forma indefinida).

Caminho recomendado, quando você autorizar a implementação:

1. Extrair um hook compartilhado (ex.: `src/hooks/usePortalCartoes.ts`) usado por `/portal/pagamentos` e `/portal/perfil`, unificando listagem, "definir principal" e remoção — e padronizando a remoção como soft delete (`ativo=false`) nas duas telas, para não perder o histórico do token usado em cobranças passadas.
2. Deixar o "definir principal" tolerante a falha parcial: aplicar o `is_default=true` primeiro e o `false` nos demais depois, e revalidar a lista ao final para o aluno ver o estado real.
3. Item (1) do pedido: aviso explícito no `CadastrarCartaoDialog` — texto do tipo "Este cartão passará a ser o principal e será usado nas próximas cobranças automáticas" — e, no sucesso, toast confirmando que o novo cartão é o principal (mencionando a substituição quando o cartão anterior de mesmo final for desativado).
4. Item (2): reforçar a UI — rótulo "Principal" mais visível no cartão atual e ação "Tornar principal" com texto (não só ícone de estrela) nos demais.

Nenhuma migração de banco, RPC ou edge function é necessária.
