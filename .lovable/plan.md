## Objetivo

Quando o usuário fechar uma venda de plano com **Tipo de Cobrança = Recorrência**, o sistema deve, além de registrar a venda, criar automaticamente:

1. **1 contrato** vinculado ao aluno (12 meses, com forma de pagamento e cartão tokenizado quando aplicável).
2. **12 cobranças mensais** (`cobrancas`) — a 1ª referente ao mês atual e as outras 11 pendentes nos vencimentos futuros (+1, +2, … +11 meses).
3. A 1ª cobrança é marcada como **paga** quando o pagamento inicial é confirmado (cartão online via REDE aprovado, Pix à vista confirmado, dinheiro, débito etc.). Caso o usuário escolha "finalizar com pagamento pendente", a 1ª cobrança nasce como **pendente**.
4. As 11 cobranças seguintes ficam sempre **pendentes** e serão processadas automaticamente pelo job diário existente (`renovar-planos-mensais` / `pg_cron`) usando o cartão tokenizado, Pix Automático ou Boleto definidos na venda.

Vendas **Tradicional** continuam sem gerar contrato/cobranças automáticas (comportamento atual preservado).

## Mudanças

### 1. Backend — função SQL `fn_criar_contrato_recorrencia`

Criar função `security definer` que recebe:
- `p_venda_id`, `p_aluno_id`, `p_plano_id`
- `p_valor_mensal` (valor do plano para 1 mês — calculado pelo front)
- `p_taxa_mensal` (R$ 20 ou 0 se Aluno 2025)
- `p_data_inicio`
- `p_forma_pagamento` (cartao_credito / pix_automatico / boleto / pendente)
- `p_cartao_token_id` (uuid opcional)
- `p_primeira_paga` (boolean — define status da cobrança #1)

Comportamento:
- Insere 1 linha em `contratos` (vigencia_tipo='mensal', 12 ciclos, frequencia/plano_tipo herdados de `planos_catalogo`).
- Insere 12 linhas em `cobrancas` (`numero_ciclo` 1..12, vencimentos `data_inicio + (n-1) mês`, valor = `valor_mensal + taxa_mensal`, gateway/forma herdados).
- Marca `cobrancas.status='pago'` e `data_pagamento=hoje` na #1 quando `p_primeira_paga=true`; caso contrário, status='pendente'.
- Retorna `contrato_id`.

`GRANT EXECUTE ... TO authenticated, service_role`.

### 2. Edge function `rede-cobrar-cartao`

Após aprovar a transação inicial vinculada a uma venda de Recorrência (`vendas.tipo_cobranca='recorrencia'`):
- Salva o cartão tokenizado em `cartoes_salvos` (já existe rotina) e obtém `cartao_token_id`.
- Chama `fn_criar_contrato_recorrencia(..., p_primeira_paga := true, p_cartao_token_id := <id>)`.

### 3. Front — `VendaDialog.tsx` (mutation `venderPlano`)

Quando `tipoCobranca === 'recorrencia'` e a modalidade **não** for `cartao_credito` (que é tratado pela edge function após aprovação), após inserir a venda, chamar o RPC:

```ts
await supabase.rpc('fn_criar_contrato_recorrencia', {
  p_venda_id, p_aluno_id, p_plano_id: planoSelecionado.id,
  p_valor_mensal: totaisPlano.valorMensalEstimado,
  p_taxa_mensal: totaisPlano.taxaMensal,
  p_data_inicio: format(dataInicio, 'yyyy-MM-dd'),
  p_forma_pagamento: modalidade,
  p_cartao_token_id: null,
  p_primeira_paga: modalidade !== 'pendente' && modalidade !== 'pix_automatico' && modalidade !== 'boleto'
});
```

Para `pix_automatico` / `boleto`: 1ª cobrança nasce **pendente** (será paga via webhook futuro). Para `dinheiro`/`pix_avista`/`debito`: 1ª cobrança nasce **paga**.

Invalida caches de `contratos` e perfil financeiro.

### 4. UI — Resumo (Fase 3) e Pagamento (Fase 4)

- Adicionar nota informativa no Resumo quando Recorrência estiver selecionada: *"Será criado um contrato de 12 meses com cobranças automáticas mensais."*
- Sem novas telas/etapas.

## Detalhes técnicos

- O job `renovar-planos-mensais` já varre `cobrancas` pendentes e dispara cobrança via REDE/Pix/Boleto conforme `contratos.forma_pagamento` e `cartao_token_id`. Nenhuma alteração necessária nesse job.
- `contratos.parcelas` = 12, `contratos.valor_base` = `valor_mensal`, `contratos.valor_cobrado` = `valor_mensal + taxa_mensal`, `contratos.taxa_recorrencia` = `taxa_mensal`.
- `cobrancas.meio_registro` = 'automatico' (cartão/pix_auto/boleto) ou 'manual' (dinheiro/pendente).
- Vigência: `data_fim = data_inicio + 12 meses`.

## Fora de escopo

- Reagendamento manual de cobranças, alteração de cartão durante o ciclo, parcelamento customizado (≠ 12), webhooks Pix/Boleto (ficam para próxima etapa).
