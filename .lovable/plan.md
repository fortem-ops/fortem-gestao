# Ler o histórico do Kinology em qualquer laudo (caso Lucas Santolin)

No laudo do Lucas as datas 26/08/2025 e 09/07/2026 existem na página "Evolução de Assimetria", mas o importador não as ofereceu. Motivo confirmado ao ler o PDF: o leitor atual só aceita o histórico quando **todos** os exercícios têm exatamente as mesmas datas (foi o caso da Carla: 6 exercícios, 2 datas iguais). No Lucas cada exercício tem um conjunto próprio de datas — 09/07/2026 aparece nos 9 exercícios, 26/08/2025 em 6 deles e 18/03/2024 em 2. Como as contagens não batem, o histórico inteiro é descartado.

## O que muda

1. O leitor passa a associar cada linha de data ao **exercício certo**, mesmo quando as tabelas têm quantidades diferentes de datas. Nada mais é descartado por "contagem não bate".
2. A janela de seleção passa a listar toda data encontrada com o número real de exercícios daquela data, por exemplo:
   - 09/07/2026 — 9 exercícios (já registrado)
   - 26/08/2025 — 6 exercícios (novo)
   - 18/03/2024 — 2 exercícios (novo)
   Você marca as que quiser importar; cada uma vira uma avaliação de força independente com os exercícios que existirem naquela data.
3. Se o leitor rápido não conseguir associar com segurança, o laudo é enviado para leitura por IA, que já tem instrução para devolver o histórico — em vez de simplesmente não mostrar datas.
4. O comportamento validado no laudo da Carla continua idêntico.

## Detalhes técnicos

Arquivo: `supabase/functions/parse-kinology-pdf/index.ts` (somente ele; a UI e `kinologyImport.ts` já são genéricos e não mudam).

- Substituir `parseEvolucao` (pareamento posicional global, com a checagem `linhas.length !== atuais.length`) por um algoritmo baseado em blocos:
  - Recortar o texto a partir da última ocorrência de "Evolução de Assimetria".
  - Percorrer o trecho token a token reconhecendo dois tipos de ocorrência: rótulo de exercício (`NOME_LABELS`) e linha de dados (`EVOL_ROW_RE`).
  - A extração em duas colunas intercala as linhas das duas tabelas lado a lado (verificado: `A_lin1, B_lin1, A_lin2, B_lin2`), e os rótulos vêm em par antes do bloco. Então: para cada par de rótulos seguido de um bloco de linhas, distribuir as linhas alternadamente entre os dois exercícios do par; para rótulo isolado (última tabela ímpar), todas as linhas do bloco vão para ele.
  - **Validação obrigatória**: a linha mais recente de cada exercício do histórico deve bater com o par (direito_kg, esquerdo_kg) já extraído para esse exercício na tabela "Assimetria e Indicativos de Risco". Se qualquer exercício não bater, descartar o histórico determinístico inteiro.
- Quando o histórico determinístico for descartado mas o texto contiver a seção de evolução, seguir para a etapa de IA já existente apenas para preencher `historico` (mantendo `exercicios` do parser determinístico), reaproveitando o prompt atual e a validação de `historico` já implementada.
- Remover o requisito de datas homogêneas: `HistoricoEntrada.exercicios` pode ter menos exercícios que a medição atual.
- Logs: registrar quantas datas e quantos exercícios por data foram reconhecidos, e se houve fallback de IA para o histórico.

Sem migração de banco e sem mudança de contrato da função (o campo `historico` já existe).
