# Corrigir plano de Corrida duplicado e permitir editar início/término

## O que está acontecendo

O checkout público da corrida cria o plano junto com o contrato do pedido. Depois, ao registrar a venda, um gatilho do banco cria **outro** plano automaticamente, mesmo quando a venda já veio com plano vinculado. Resultado: dois planos de Corrida idênticos na aba Plano/Serviços.

Confirmado nas duas alunas:

- Juliana Leote Ribeiro: plano do pedido de 20/08 (com contrato e valor R$ 1.800) + cópia criada 2 segundos depois pela venda.
- Gabrieli Anay Pivetta Clerice: plano do pedido de 19/08 (com contrato e valor R$ 1.920) + cópia criada 3 segundos depois pela venda.

Em ambos os casos o contrato assinado aponta para o plano do pedido; a cópia não tem contrato. Cada aluna também tem o plano de Corrida anterior ainda ativo (Juliana: 02/08–01/09; Gabrieli: 01/12/2025–01/12/2026), que é o plano sendo renovado antecipadamente.

## O que será feito

**1. Limpeza dos dados das duas alunas**
- Manter o plano do pedido (o que tem contrato e cobranças) e desativar a cópia criada pela venda.
- Transferir o cartão vinculado da cópia para o plano mantido e reapontar a venda para ele, para não perder o vínculo de pagamento.

**2. Evitar que aconteça de novo**
- Ajustar o gatilho de processamento de venda para só criar plano novo quando a venda **não** vier com plano já vinculado. Vendas manuais continuam funcionando igual.

**3. Editar início e término do plano de Corrida**
- O cartão "Plano adicional · Corrida" ganha botão de editar (visível para Coordenação e Administração), com data de início, data de término e valor.
- Ao salvar, as datas do contrato correspondente também são atualizadas, mantendo contrato e plano coerentes.
- Isso permite ajustar manualmente a renovação antecipada: encerrar o plano anterior na data desejada e iniciar o novo a partir dali.

## Detalhes técnicos

- Correção de dados: `UPDATE` em `planos` (desativar duplicata, mover `cartao_token_id`) e em `vendas.plano_id`, para os IDs identificados.
- Migração: `fn_processar_venda` passa a envolver o bloco de `INSERT INTO public.planos` (ramo `tipo = 'plano'`) em `IF NEW.plano_id IS NULL THEN ... END IF`; criação de créditos permanece inalterada.
- `src/components/student/StudentPlan.tsx`: `PlanoCorridaCard` recebe props `isCoordAdmin` e `alunoId`, um diálogo de edição (data_inicio, data_fim, valor) que grava em `planos` e sincroniza `contratos.data_inicio/data_fim` do contrato daquele plano, invalidando os caches via `invalidatePlanoCaches` + `planos_corrida_ativos`.
