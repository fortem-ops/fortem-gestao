## Adicionar desconto e forma de pagamento na Nova Venda

### 1. Banco de dados (migration)
Adicionar à tabela `vendas`:
- `desconto` (numeric, default 0) — valor em R$ do desconto
- `valor_final` (numeric, default 0) — valor após desconto
- `forma_pagamento` (text, nullable) — ex.: `pix`, `cartao_debito`, `cartao_credito`, `boleto`, `dinheiro`, ou customizada
- `parcelas` (integer, default 1) — 1 a 12, aplicável quando crédito

Adicionar à tabela `planos` (para renovação automática):
- `desconto_recorrente` (numeric, default 0) — desconto aplicado em cada renovação
- `forma_pagamento_padrao` (text, nullable)
- `parcelas_padrao` (integer, default 1)

Criar tabela `formas_pagamento` (catálogo gerenciável):
- `id`, `nome`, `slug` (único), `permite_parcelamento` (bool), `ativo`, `ordem`, `created_at`
- Seed: Pix, Cartão de Débito, Cartão de Crédito (parcelamento), Boleto, Dinheiro
- RLS: leitura para autenticados, escrita só coord/admin

### 2. UI — `VendaDialog.tsx` (Nova Venda)
Etapa "Resumo" (Planos e Serviços) ganha:

**Forma de pagamento** (Select)
- Carrega de `formas_pagamento` ativas
- Última opção: "+ Adicionar forma de pagamento" → mini-dialog (coord/admin) com nome + permite parcelamento
- Se `permite_parcelamento = true`: mostra **Parcelas** (1x a 12x)

**Desconto** (Input R$)
- Aceita 0 a `valor`
- Resumo: Subtotal, Desconto, **Total** (= valor − desconto)
- Crédito parcelado: mostra "12x de R$ X,XX" informativo

No insert: `desconto`, `valor_final`, `forma_pagamento`, `parcelas`. Validar `desconto <= valor` e parcelas obrigatórias quando crédito.

### 3. Edição da forma de pagamento após venda criada
Em `HistoricoVendas.tsx`, cada linha de venda ganha botão **Editar pagamento** (coord/admin) que abre dialog para alterar:
- Forma de pagamento
- Parcelas (quando aplicável)
- Desconto e valor final (recalcula)
- Status do pagamento

Update na tabela `vendas`. Registra em `audit_log` (operação `update_venda`) com dados antes/depois.

### 4. Desconto em renovação automática
Em `StudentPlan.tsx` (dialog Editar Plano), adicionar bloco "Configuração de cobrança recorrente" (visível quando `renovacao_automatica = true`):
- Desconto recorrente (R$)
- Forma de pagamento padrão (Select de `formas_pagamento`)
- Parcelas padrão (quando crédito)

Persistir em `planos.desconto_recorrente`, `forma_pagamento_padrao`, `parcelas_padrao`.

Edge function `renovar-planos-mensais` passa a ler esses campos do plano e gravar na nova venda:
- `valor` = valor do plano
- `desconto` = `desconto_recorrente`
- `valor_final` = `valor − desconto`
- `forma_pagamento` = `forma_pagamento_padrao`
- `parcelas` = `parcelas_padrao`

### 5. Histórico — `HistoricoVendas.tsx`
- Badge da forma de pagamento + `12x` quando parcelado
- `valor_final` em destaque; `valor` riscado ao lado quando há desconto
- Botão "Editar pagamento" (coord/admin)

### Fora de escopo
- Integração real com gateway de pagamento

Quer que eu siga com essa implementação?