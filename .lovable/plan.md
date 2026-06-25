## Objetivo

No fluxo de Nova Venda de Plano, transformar a etapa "Resumo" em duas escolhas: tipo de cobrança + resumo dos valores, e introduzir uma nova **Fase 4 — Pagamento**, com fluxos diferentes para Recorrência e Tradicional.

## 1. Banco de dados (migração)

Adicionar campos para suportar a nova lógica:

- `alunos.aluno_2025` (boolean, default false) — marca alunos com isenção da taxa mensal.
- `vendas.tipo_cobranca` (text: `recorrencia` | `tradicional`).
- `vendas.taxa_mensal` (numeric, default 0) — armazena o valor da taxa aplicada (geralmente 20,00 ou 0).
- `vendas.modalidade_pagamento` (text nullable) — slug do método escolhido na Fase 4 (`cartao_credito`, `pix_automatico`, `boleto`, `dinheiro`, `debito`, `pix_avista`, `pendente`).
- `vendas.canal_pagamento` (text nullable) — `maquininha` | `online` | `manual` (para diferenciar cartão presencial vs. integração REDE).

A coluna existente `forma_pagamento` (slug livre) continua sendo gravada para compatibilidade com relatórios.

## 2. Fluxo do Wizard de Planos

O StepIndicator passa de 3 para **4 etapas**: Frequência → Plano → Resumo → Pagamento.

### Etapa 3 — Resumo (refeita)

Conteúdo:

1. Card do plano selecionado (como hoje).
2. Data de início (mantém).
3. **Tipo de cobrança** (novo, dois RadioCards):
   - **Recorrência** — cobrança mensal automática; adiciona R$ 20,00/mês de taxa de serviço (exceto Aluno 2025).
   - **Tradicional** — pagamento único/parcelado, sem taxa mensal.
4. Quando "Recorrência":
   - Checkbox **"Aluno de 2025 (sem taxa de R$ 20/mês)"**.
     - Visível apenas para Coordenador/Admin (`useUserRoles`).
     - Ao marcar, persiste em `alunos.aluno_2025 = true` no momento da venda.
     - Se o aluno já estiver marcado como 2025, vem pré-marcado.
5. Campo **Desconto (R$)** mantido (aplica sobre o valor do plano, não sobre a taxa mensal).
6. Observações (mantém).
7. **Resumo financeiro** (recalculado):
   - Valor do plano
   - Desconto
   - Subtotal do plano
   - Taxa mensal × meses do plano (apenas Recorrência sem isenção)
   - **Total a cobrar**
   - **Mensal estimado** (quando Recorrência): `(subtotal/periodo_meses) + taxa_mensal`
8. Botões: Voltar / **Continuar para Pagamento**.

A escolha de forma de pagamento sai da Etapa 3 (era feita pelo `PaymentFields` aqui).

### Etapa 4 — Pagamento (nova)

Opções renderizadas dependem do tipo de cobrança:

**Recorrência** (RadioCards):
- Cartão de Crédito (recorrente) → abre subtela com formulário de cartão + tokenização via edge function `rede-cobrar-token` (reaproveita `PagarCartaoDialog`).
- Pix Automático → chama fluxo já existente em `PixAutomaticoSection` para autorizar.
- Boleto → marca venda como aguardando geração de boleto (placeholder; integração futura).
- Finalizar com **pagamento pendente**.

**Tradicional** (RadioCards):
- Cartão de Crédito → sub-opções:
  - Parcelas: select 1x–12x.
  - Canal: **Maquininha (presencial)** ou **Online (REDE)** → este abre `PagarCartaoDialog` para cobrança imediata.
- Débito (maquininha).
- Dinheiro.
- Pix à vista.
- Finalizar com **pagamento pendente**.

Cada subtela tem **Voltar** para a lista de opções e **Confirmar venda**.

## 3. Lógica de gravação

Mutation `vender` atualizada:

- `tipo_cobranca`, `taxa_mensal`, `modalidade_pagamento`, `canal_pagamento`, `parcelas`, `desconto`, `valor`, `valor_final` (= plano − desconto; a taxa mensal é registrada à parte, não somada ao `valor_final` da venda).
- Se Recorrência com "Aluno 2025" marcado pela primeira vez, faz `update alunos set aluno_2025 = true`.
- Se Recorrência + Cartão Online ou Pix Automático: após cobrança/autorização bem-sucedida (handler já existente) seta `status_pagamento = 'pago'` ou `'autorizado'`; senão grava `pendente`.
- Se Tradicional + Cartão Online: aciona `rede-cobrar-cartao` via `PagarCartaoDialog`; sucesso → `status_pagamento = 'pago'`.
- Demais casos (maquininha, dinheiro, débito, pix à vista, boleto, finalizar pendente): grava com `status_pagamento` selecionado pelo usuário (default `pendente`, com opção rápida "Já recebido" → `pago`).

## 4. Componentização

- `src/components/student/venda/VendaDialog.tsx`: adiciona Step 4 e estados (`tipoCobranca`, `aluno2025`, `modalidade`, `canalCartao`, `parcelas`).
- Novo `src/components/student/venda/TipoCobrancaSection.tsx`: bloco visual com os dois RadioCards e o checkbox Aluno 2025.
- Novo `src/components/student/venda/PagamentoStep.tsx`: renderiza as opções conforme `tipoCobranca`, e dispatches para subtelas (cartão, pix, etc.).
- `src/lib/vendas-calc.ts`: função `calcularTotais({ valorPlano, desconto, periodoMeses, tipoCobranca, taxaMensal })` retornando `{ subtotalPlano, taxaTotal, total, mensalEstimado }`.
- `PaymentFields` deixa de ser usado no Step Resumo; só o input de Desconto é mantido inline (componente pequeno reaproveitando o trecho atual).

## 5. Constantes

- `TAXA_MENSAL_RECORRENCIA = 20` em `src/lib/vendas-calc.ts` (exportada para reuso futuro).

## 6. Permissões

- Toggle "Aluno 2025" só aparece para `admin`/`coordenador`. Demais perfis veem a taxa aplicada sem opção de remover.

## 7. Fora de escopo (não implementado agora)

- Geração efetiva de boleto (apenas placeholder com `status_pagamento = 'pendente'` e modalidade gravada).
- Recibos e contratos automáticos.
- Backfill de `aluno_2025` para alunos existentes (será marcado manualmente).
