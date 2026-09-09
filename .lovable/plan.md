# Corrigir plano exibido de Juliana Leote Ribeiro

## O que está acontecendo

No cadastro dela aparece "Corrida - Power + Corrida" em vez do plano POWER.

Causa confirmada nos dados:

- O contrato POWER está ativo e vale até **25/10/2026**.
- Mas o registro do plano POWER dela foi alterado em 20/08/2026 e a data final passou de
  **25/10/2026 para 01/09/2026** (confirmado no histórico de alterações).
- Como essa data já passou, a tela entende que o plano POWER venceu e passa a mostrar
  o plano de Corrida no lugar dele — daí o nome "Corrida - Power" mais a etiqueta "+ Corrida".

Verificação: ela é **o único caso** hoje com plano vencido enquanto o contrato segue ativo.

## Correção proposta

1. Corrigir a data final do plano POWER dela para 25/10/2026, igual ao contrato ativo.
2. Limpar o plano de Corrida antigo (vigência 02/08 a 01/09/2026), cujo contrato já foi
   encerrado mas o plano continuou marcado como ativo. Fica ativo apenas a Corrida
   vigente (02/09/2026 a 02/09/2027).
3. Conferir a tela do cadastro: deve mostrar "Power" com a etiqueta "+ Corrida" e status Ativo.

Nada de preços, contratos de Corrida (Somente Provas, MIPOA, Kit, Avaliação) ou regras
de cobrança é alterado.

## Prevenção (será feita junto)

Hoje esse desencontro só é percebido por reclamação. A prevenção teria três partes:

1. Uma verificação no banco que compara, todos os dias, a data final de cada plano ativo
   com a data final do contrato ativo daquele aluno e lista os que estão diferentes.
2. Uma rotina automática diária que roda essa verificação e, quando encontrar diferenças,
   gera um alerta interno para a coordenação (mesmo canal dos alertas já existentes),
   dizendo o nome do aluno e as duas datas.
3. Um cartão em Relatórios mostrando a lista atual dessas divergências, com botão para
   alinhar a data do plano à do contrato em um clique.

Se preferir começar pequeno, dá para fazer só os itens 1 e 3 agora e deixar o alerta
automático para depois.

## Detalhes técnicos

- `planos.id = 2bfc8f4a-c0d9-421b-af15-6b2ac44e6cf5` → `data_fim = '2026-10-25'`
  (contrato `e2eea4ee-51b6-48cd-a8c1-6e82312b5e64`, status ativo, `data_fim 2026-10-25`).
- `planos.id = 8bdcc304-50c4-48ce-be60-de18e949f944` (atividade `corrida`, contrato
  `06736d97` já `encerrado`) → `ativo = false`.
- Migration de dados apenas; sem mudança de schema, RLS ou grants.
- `selecionarPlanoExibicao` em `src/lib/planoPrincipal.ts` já está correto — ele prioriza
  o principal vigente; o problema era o dado, não a lógica. Nenhuma alteração de código
  de exibição é necessária.
- Prevenção: consulta/relatório comparando `planos.data_fim` com `contratos.data_fim`
  para contratos `ativo` da atividade `treinamento_funcional`.
