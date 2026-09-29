# Divergência plano × contrato — o que é e ajuste do cartão

## O que o cartão mostra
Lista alunos cujo plano ativo tem **data final diferente** da data final do contrato ativo. Ele foi criado para pegar casos como o da Juliana Leote (plano "vencido" com contrato ainda valendo).

## Caso da Andreza de Oliveira Pereira
- Plano Start: início 11/09/2026, **sem data final** (renovação mensal automática), próxima renovação 11/10/2026.
- Contrato ativo: 11/09 a **11/10/2026**.
- Está tudo certo. O cartão acusa só porque "sem data final" é diferente de "11/10". É um **falso alerta**.

## Situação geral hoje
Todos os 28 casos da lista são planos sem data final:
- **20** com renovação mensal automática: falsos alertas, como o da Andreza.
- **8** sem renovação automática e sem data final: esses podem ser problema de verdade (plano sem término e sem renovar).

## Correção proposta
1. Para planos com renovação automática, comparar a **próxima renovação** do plano com a data final do contrato (em vez da data final do plano). Andreza e os outros 19 saem da lista quando as datas batem.
2. Os 8 casos sem renovação e sem data final continuam no cartão, com o motivo "Plano sem data final".
3. O botão "Alinhar" passa a acertar a próxima renovação nos planos com renovação automática, sem colocar data final neles (para não aparecer "Cancelamento agendado").
4. Depois de aplicar, mostro a você os casos restantes para decidir o que fazer com cada um.

Nada de valores, cobranças ou contratos é alterado.

## Detalhes técnicos
- `fn_planos_divergencia_contrato`: quando `p.renovacao_automatica`, comparar `p.proxima_renovacao` com `c.data_fim`; senão manter `data_fim`. Adicionar coluna `motivo` (`renovacao_diferente` / `data_fim_diferente` / `plano_sem_fim`).
- `fn_alinhar_plano_ao_contrato`: ramo de renovação automática atualiza `proxima_renovacao = c.data_fim`, mantendo `data_fim` nulo.
- Cartão em `src/pages/relatorios/Planos.tsx`: exibir o motivo e a data comparada.
