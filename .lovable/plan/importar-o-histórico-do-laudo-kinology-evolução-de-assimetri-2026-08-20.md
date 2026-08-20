# Importar o histórico do laudo Kinology (Evolução de Assimetria)

Hoje o importador lê apenas a tabela "Assimetria e Indicativos de Risco" (a medição mais recente) e grava uma única avaliação. A página "Evolução de Assimetria" do laudo — que traz todas as datas anteriores por exercício — é ignorada.

No laudo da Carla, essa página contém, para cada um dos 6 exercícios, as linhas 20/03/25 e 17/08/26. É exatamente o histórico que você quer subir.

## O que muda

1. A leitura do PDF passa a extrair também a seção "Evolução de Assimetria", agrupando os valores por data.
2. Depois de ler o arquivo, aparece uma janela listando todas as datas encontradas, por exemplo:
   - 17/08/2026 — 6 exercícios (já registrado)
   - 20/03/2025 — 6 exercícios (novo)
   Cada data com uma caixa de seleção. Datas que já têm avaliação de força registrada vêm desmarcadas e marcadas como "já registrado", para evitar duplicidade.
3. Ao confirmar, cada data marcada vira um registro de força independente:
   - se já existe uma avaliação funcional daquela data aguardando força, os dados são mesclados nela (comportamento atual);
   - caso contrário, cria-se uma nova avaliação com aquela data.
4. O campo "Data da avaliação" continua existindo e segue valendo como override apenas para a medição mais recente do laudo (o comportamento de hoje). Quando você escolhe importar várias datas do histórico, cada uma usa a sua própria data.
5. Quando o laudo não tiver a página de evolução (só uma data), o fluxo segue direto como hoje, sem janela extra.

Resultado prático: no laudo da Carla você marca 20/03/2025, confirma, e o gráfico "Evolução da Assimetria" da aba Força passa a mostrar os dois pontos.

## Detalhes técnicos

- `supabase/functions/parse-kinology-pdf/index.ts`: novo parser determinístico para a seção "Evolução de Assimetria". Estrutura no texto extraído: cabeçalho com o nome do exercício seguido de linhas `dd/mm/aa  X kg  Y kg  Z%`. Ano de 2 dígitos normalizado para 20xx. Retorna um novo campo `historico: [{ data: "dd/mm/aaaa", exercicios: [{nome, direito_kg, esquerdo_kg}] }]`, ordenado por data. O retorno atual (`exercicios`, `dataEmissao`, `paciente`, `source`) permanece igual — mudança aditiva. O prompt de IA de fallback ganha o mesmo campo no schema de resposta.
- `src/lib/kinologyImport.ts`: tipar `historico` em `KinologyParseResult`; extrair de `PremiumKinologyImport` uma função `persistirForcaNaData(alunoId, avaliadorId, dataISO, forcaPayload)` que faz merge/insert (a lógica atual de `findFuncionalV2AguardandoForca` + insert), reutilizada em loop; helper `listarDatasForcaExistentes(alunoId)` para marcar as datas já registradas.
- `src/components/avaliacoes-premium/PremiumKinologyImport.tsx`: após o parse, se `historico.length > 1`, abre um `Dialog` com checkboxes por data (usando o padrão shadcn já presente no projeto); ao confirmar, roda o loop de persistência e invalida as mesmas queries de hoje. Sem histórico ou com uma única data, mantém o caminho atual sem diálogo.
- Sem migração de banco: `avaliacoes` já aceita qualquer data e o PDF é reaproveitado (mesmo `laudoPath` em todas as datas importadas).
