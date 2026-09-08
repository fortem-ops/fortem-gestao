# Recomendação de exercícios de Aquecimento por assimetria + alerta na prescrição

## Objetivo
1. Em **Avaliações > Resultados > Recomendações**, quando uma mobilidade ou flexibilidade estiver na faixa amarela (10–20%) ou vermelha (>20%), listar exercícios de **Aquecimento** do Banco de Exercícios vinculados àquela articulação/músculo.
2. Ao **prescrever um treino** (Fases 1-4, Métodos e Corrida 1-4), mostrar um bloco com as assimetrias/déficits do aluno e os exercícios sugeridos, correlacionando as articulações demarcadas no mapa.

Força fica para uma próxima etapa (o motor já suporta, só não será exibido).

## Situação atual (verificada)
- O vínculo exercício ↔ articulação existe (`exercicio_articulacoes`), mas está **vazio** (0 linhas). Há 121 exercícios de Mobilidade Articular e 555 de Aquecimento no banco. Até os exercícios serem vinculados, as recomendações mostrarão um aviso "nenhum exercício vinculado a esta articulação ainda".
- As opções de vínculo cobrem só as 12 chaves articulares (ombro RI/RE, quadril RI/RE, tornozelo, torácica — E/D). As 3 flexibilidades (Posterior de Coxa, Quadríceps, Psoas) não têm chave.
- Assimetria por métrica já é calculada em `analyze()` (`|E−D| / max × 100`) e as faixas 10%/20% já existem (`contarAssimetriasPorFaixa`, `corGradienteAssimetria`).
- A prescrição de Fases/Métodos/Corrida passa toda pelo `ImportFromBankDialog` (tela "Prescrever — {fase}"), que recebe `alunoId`. Nenhum dado de avaliação é carregado ali hoje.

## O que será feito

### A. Vínculo de exercícios (Banco de Exercícios)
- Acrescentar às opções de vínculo 6 chaves musculares: `posterior-coxa-esquerdo/direito`, `quadriceps-esquerdo/direito`, `psoas-esquerdo/direito`.
- A caixa "Articulações / músculos relacionados" passa a aparecer para exercícios de **Mobilidade Articular** (obrigatório, como hoje) e **Liberação Miofascial** (opcional). Demais categorias não mostram a caixa.
- Sem alteração de banco de dados: a tabela já aceita qualquer chave de texto.

### B. Motor de recomendação (compartilhado)
- Nova função pura `gerarRecomendacoesAquecimento(metricas, exerciciosVinculados)` que:
  - Calcula a assimetria de cada métrica de mobilidade/flexibilidade (mesma fórmula do mapa).
  - Mantém apenas faixa amarela (≥10%) e vermelha (>20%), com prioridade **média** / **alta**.
  - Traduz a métrica para as chaves E/D (mobilidade → `MOBILIDADE_SHAPE_ARTICULATION`; flexibilidade → novas chaves musculares) e identifica o lado mais deficitário.
  - Busca exercícios vinculados a essas chaves (só Aquecimento: Mobilidade Articular e Liberação Miofascial), agrupando por articulação, sem repetir exercício.
- Novo hook `useExerciciosPorArticulacao()` que carrega uma vez `exercicio_articulacoes` + nome/categoria/vídeo do exercício.

### C. Avaliações > Resultados > Recomendações
- As recomendações de mobilidade/flexibilidade atuais passam a usar as faixas de assimetria (amarela/vermelha) em vez das classes "Fraco/Regular".
- Cada card ganha uma lista "Exercícios de aquecimento sugeridos" com chips (nome + botão de vídeo quando houver), indicando o lado deficitário e a % de assimetria.
- Estado vazio explícito: "Nenhum exercício vinculado a esta articulação. Vincule no Banco de Exercícios."
- Recomendações de força continuam como estão (sem sugestão de exercício por enquanto).

### D. Alerta na prescrição (Fases, Métodos, Corrida)
- Novo componente `AlunoDeficitsAlert` exibido no topo da tela "Prescrever — {fase}" do `ImportFromBankDialog` (cobre Fases 1-4, Métodos e Corrida 1-4).
- Conteúdo: data da última avaliação funcional, lista das assimetrias amarelas/vermelhas (métrica, lado, %, cor da faixa igual à do mapa) e, para cada uma, os exercícios de aquecimento sugeridos.
- Recolhível; se o aluno não tiver avaliação funcional, o bloco não aparece.
- Informativo: o professor escolhe manualmente os exercícios nos blocos do treino (não há inserção automática nesta etapa).

## Fora de escopo
- Sugestões para Força.
- Inserção automática dos exercícios na ficha.
- Vinculação em massa dos exercícios já existentes (será feita pela equipe no Banco de Exercícios; pode ser encomendada depois).

## Detalhes técnicos
- `shapeMuscleMapping.ts`: adicionar `FLEXIBILIDADE_SHAPE_KEYS` (E/D) e `ARTICULACAO_MUSCULO_OPTIONS` (12 + 6 chaves, com rótulos).
- `StudentExerciseBank.tsx`: caixa de vínculo visível quando categoria ∈ {Mobilidade Articular, Liberação Miofascial}; obrigatoriedade só em Mobilidade Articular.
- Novo `src/components/avaliacoes-premium/aquecimentoSugestoes.ts` (motor puro, testável) + `src/hooks/useExerciciosPorArticulacao.ts`.
- `recomendacoesEngine.ts`: `Recomendacao` ganha campo opcional `exercicios?: { id, nome, video_url, lado }[]`; itens de mobilidade/flexibilidade gerados a partir das faixas de assimetria.
- `AvaliacoesPremium.tsx`: passa o resultado do hook ao `gerarRecomendacoes`.
- `RecomendacoesTab.tsx`: renderiza a lista de exercícios dentro do card.
- Novo `src/components/student/workout/AlunoDeficitsAlert.tsx`: usa `useAlunoAvaliacoesConsolidadas(alunoId)` (funcional.latest.metricas) + motor; inserido em `ImportFromBankDialog.tsx` acima de `WorkoutDetail`.
- Teste unitário do motor (faixas, lado deficitário, agrupamento, deduplicação).
- Validação: `bunx tsgo --noEmit`, build e verificação visual em Resultados > Recomendações e na tela de prescrição com o aluno atual.
