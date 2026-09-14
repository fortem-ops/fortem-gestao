# Relatórios dos Professores (Análise > Relatórios > Técnicos)

Nova tela para coordenadores e administradores acompanharem, aluno a aluno, os relatórios técnicos preenchidos pelos professores e quais estão vencidos.

## O que a tela mostra

Uma linha por aluno ativo, com:

- Nome do aluno (link para a ficha do aluno)
- Professor responsável pelo aluno
- Último relatório técnico: data e tipo (Relatório Técnico, Reabilitação, Experimental, Pliometria etc.)
- Quem preencheu o último relatório
- Dias desde o último relatório
- Situação: Em dia, Vence em breve (faltando 15 dias ou menos) ou Em atraso
- Quantidade de relatórios do aluno no período

Alunos ativos que nunca receberam relatório aparecem como "Sem relatório" e contam como em atraso.

## Regra de atraso (por periodicidade)

O intervalo esperado entre relatórios é escolhido na própria tela (30, 60 ou 90 dias — padrão 90). Passou do intervalo desde o último relatório, está em atraso.

## Cartões de resumo no topo

- Alunos ativos acompanhados
- Em dia
- Vencendo em breve
- Em atraso
- Relatórios preenchidos nos últimos 30 dias

## Filtros

- Busca por nome do aluno
- Professor responsável
- Situação (em dia / vencendo / em atraso / sem relatório)
- Tipo de relatório
- Intervalo esperado (30/60/90 dias)
- Ordenação por dias sem relatório ou por nome

Também uma visão agrupada por professor, mostrando quantos alunos dele estão em dia e em atraso.

## Acesso

Apenas coordenadores e administradores, usando a mesma verificação já utilizada em outras telas de coordenação. Professores que abrirem a rota veem a mensagem de acesso restrito.

## Detalhes técnicos

- Nova página `src/pages/relatorios/Tecnicos.tsx`, substituindo o `EmBreve` na rota `/relatorios/tecnicos` em `src/App.tsx` (o item de menu já existe em `RelatoriosLayout`).
- Fonte de dados: tabela `avaliacoes` filtrando os tipos **não** estruturais (tudo fora de `funcional`, `funcional_v2`, `composicao_corporal`, reutilizando `TIPOS_ESTRUTURAIS` de `StudentAssessments`), cruzada com `alunos` (`status = 'ativo'`, `responsavel_id`) e `profiles` para os nomes de professor/avaliador.
- Consultas com TanStack Query, agregação e filtros feitos no cliente (volume atual: 240 alunos ativos).
- Permissão via RPC `is_coordinator_or_admin`, no mesmo padrão de `AdminPonto.tsx`.
- Sem alterações de banco, RLS ou Edge Functions; nenhuma outra aba de Relatórios é afetada.
