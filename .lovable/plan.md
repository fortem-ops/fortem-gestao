# Resultados: modo somente leitura

Ajuste apenas do modo "Resultados" da tela Avaliações Premium. O modo "Lançamento" permanece intacto.

## O que muda

1. O cartão lateral do aluno (avatar, idade, frequência, ID, telefone, última avaliação, avaliador) sai do modo Resultados. O conteúdo (resumo geral, mapa corporal e abas) passa a ocupar a largura toda.
2. As abas Mobilidade, Força, Composição e Pliometria dentro de Resultados passam a exibir apenas leitura: tabelas, gráficos e histórico da avaliação mais recente, sem formulário de lançamento, sem importação Kinology e sem os botões Nova avaliação / Editar / Excluir.
3. Cada uma dessas abas ganha uma nota discreta: "Somente leitura · lançamentos e correções ficam em Lançamento".
4. Evolução, Comparativo e Recomendações ficam exatamente como estão.

## Abordagem recomendada (item 2)

Prop opcional `readOnly?: boolean` (padrão `false`) em cada um dos quatro Tab components. Só o modo Resultados passa `readOnly`; Lançamento continua chamando sem a prop, então o comportamento atual não muda em lugar nenhum.

Motivo de preferir isso a componentes separados: hoje form e histórico convivem no mesmo arquivo e compartilham cálculos (percentis, curvas, séries dos gráficos). Extrair "somente histórico" para arquivos novos duplicaria essa lógica ou exigiria refatorar quatro componentes; a prop esconde só a camada de escrita, que já está bem delimitada em cada arquivo.

Pontos exatos condicionados por `readOnly`:

- `MobilidadeTab.tsx` — não renderizar o bloco de formulário/botão "Nova avaliação"; no cabeçalho do histórico manter o seletor de data e esconder os botões Editar e Excluir. Tabela de métricas e curvas de distribuição permanecem.
- `ForcaTab.tsx` — esconder `PremiumKinologyImport` e `AvaliacaoDeleteList`; manter dinamometrias, tabelas e gráficos.
- `ComposicaoTab.tsx` — esconder o bloco "Nova avaliação — Pollock 7 Dobras" e `AvaliacaoDeleteList`; manter resultados e histórico.
- `PliometriaTab.tsx` — esconder o formulário e `AvaliacaoDeleteList`; manter cards do último resultado e histórico.

A nota de somente leitura vira um pequeno componente compartilhado (`ReadOnlyHint`) renderizado no topo de cada aba quando `readOnly` estiver ativo, para não repetir markup.

## Alterações em arquivos

- `src/pages/AvaliacoesPremium.tsx`: remover `AlunoSidebarCard` do bloco Resultados (e o import, se não usado em outro ponto), simplificar o layout flex, e passar `readOnly` para as quatro abas de categoria.
- `src/components/avaliacoes-premium/tabs/MobilidadeTab.tsx`, `ForcaTab.tsx`, `ComposicaoTab.tsx`, `PliometriaTab.tsx`: adicionar a prop e os condicionais acima.
- Novo `src/components/avaliacoes-premium/ReadOnlyHint.tsx`.
- `LancamentoView.tsx`: sem alteração.

Nenhuma mudança de banco, de query ou de lógica de salvamento.
