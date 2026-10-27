# Aba "Treinos" na Central de Tarefas do Jonas

## O que foi conferido
- Jonas Santos Hubner é coordenador, perfil ativo.
- Ele tem 13 tarefas "Atualizar treino" em aberto, todas no nome dele, com vencimento de 29/10 a 28/12/2026. Nenhuma está atrasada.
- A tela já busca essas tarefas: os filtros (só tarefas dele + alunos da carteira, sem comerciais) devolvem 260 tarefas, incluindo as 13 de treino.
- A tela tem duas abas principais (Programadas e Atrasadas) e, dentro de cada uma, só mostra a sub-aba de um grupo quando ele tem pelo menos 1 tarefa.

## Causa provável (ainda não confirmada na tela dele)
Como nenhuma tarefa de treino do Jonas está atrasada, a sub-aba "Treinos" aparece só em **Programadas** e some em **Atrasadas**. Se ele estiver olhando a aba Atrasadas, não vê "Treinos". A outra hipótese é a tela dele ter ficado com dados antigos carregados.

## Passos
1. Abrir a Central de Tarefas entrando como Jonas (pede sua aprovação para entrar com a conta dele) e conferir as abas Programadas e Atrasadas.
2. Se for o caso acima: deixar as sub-abas de grupo (Treinos, Avaliações, Relatórios etc.) sempre visíveis nas duas abas, mostrando 0 e a mensagem de lista vazia quando não houver tarefas — assim "Treinos" nunca some.
3. Se aparecer outro motivo (erro ao carregar, tarefa filtrada), corrigir esse motivo em vez do passo 2 e informar.

## Detalhes técnicos
- Arquivo: `src/pages/TaskCenter.tsx`, `GroupedTaskTabs`: trocar o filtro `buckets[g.id].length > 0` por mostrar todos os grupos (mantendo "Vídeos" só para coordenador/admin; "Comercial" só para admin).
- Sem banco, sem mudar regras de quem vê quais tarefas.
