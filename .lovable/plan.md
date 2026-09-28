# Aviso de avaliação funcional deve abrir "Avaliações"

## Problema
Ao clicar no aviso "Você ainda não realizou a avaliação funcional..." no Início, o sistema abre a tela antiga "Novo Relatório" (hoje chamada Relatórios), que cai em Reabilitação. A avaliação agora é feita inteiramente em **Avaliações** (antiga Avaliações Premium).

## O que muda
- Clicar no aviso passa a abrir **Avaliações** já com o aluno selecionado (ex.: Marcelo Luiz Nunes Melim).
- Nada muda no texto dos avisos, em quem os vê, nem na tela de Relatórios.

## Fora do escopo (a confirmar depois, se quiser)
Outros atalhos ainda levam a "Novo Relatório": botão "Nova avaliação" em Prospects, botão no card de avaliações do perfil do aluno, e a tarefa de evolução de Reabilitação (esta é relatório de fato, fica como está).

## Detalhe técnico
`LembreteAvaliacoesPendentesBanner.tsx`: `handleClick` navega para `/avaliacoes-premium/${alunoId}` em vez de `/avaliacoes?aluno=...&new=1`.
