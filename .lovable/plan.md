## Objetivo
1. Inserir uma nova etapa **"Serviços do plano"** no wizard de venda de Plano, com pré-seleção automática conforme o plano escolhido.
2. Corrigir o erro `contratos_forma_pagamento_check` quando a venda em **Recorrência** é finalizada com pagamento **pendente**.
3. Garantir que, após finalizar a venda em Recorrência, o contrato apareça em **Perfil do Aluno > Contrato**.

---

## 1) Nova etapa "Serviços do plano"

### Wizard
Passos do Plano passam a ser:
`["Frequência", "Plano", "Serviços", "Resumo", "Pagamento"]`

A etapa "Serviços" é **pulada automaticamente** para planos sem benefícios (Start, VIP, Gympass/Wellhub, Total Pass).

### Regras de pré-seleção (por nome do plano)

| Plano | Avaliação Funcional | Opções de Consulta (escolha única) |
|-------|---------------------|------------------------------------|
| Start | — | — |
| Start+ | 1× (fixo) | — |
| Power | 1× (fixo) | • 2× Nutrição<br>• 2× Reabilitação<br>• Definir depois |
| Pro | 2× (fixo) | • 4× Nutrição<br>• 4× Reabilitação<br>• 2× Nutrição + 2× Reabilitação<br>• Definir depois |
| Max | 3× (fixo) | 5× Nutrição + 5× Reabilitação (fixo) |

A UI exibe um resumo dos serviços já incluídos (chips/checks) e, quando aplicável, cards de escolha. Botão "Continuar" só habilita após a escolha (para Power/Pro). "Definir depois" é uma opção válida.

### Persistência
- Novo campo **`contratos.servicos_inclusos jsonb`** com a estrutura:
  ```json
  { "avaliacao_funcional": 2, "nutricao": 4, "reabilitacao": 0, "definir_depois": false }
  ```
- Após criação do contrato (ou da venda, no caso de planos com benefícios sem recorrência), criar registros em **`creditos_aluno`** para cada serviço escolhido (usando os `servicos_catalogo` já existentes: Avaliação Funcional, Nutrição, Reabilitação). Se "Definir depois" estiver marcado, nenhum crédito é criado e o contrato fica marcado como pendente de definição.
- A criação dos créditos será incluída na função `fn_criar_contrato_recorrencia` (que recebe o JSON `p_servicos_inclusos`). Para vendas **tradicionais** (não recorrência), os créditos são criados pelo front após o `INSERT` da venda.

---

## 2) Corrigir erro de constraint `contratos_forma_pagamento_check`

### Causa
O valor `"pendente"` (modalidade da UI) é enviado direto para `contratos.forma_pagamento`, que aceita apenas `cartao_recorrencia | cartao_parcelado | pix_automatico | boleto | maquina_debito | maquina_credito | dinheiro`.

### Correção
- **Migração**: estender o CHECK para incluir `'pendente'` (mantendo os valores existentes). Aplica-se somente a `contratos` (a tabela `cobrancas` não tem CHECK em `forma_pagamento`).
- **Frontend** (`VendaDialog.tsx`): adicionar `mapModalidadeParaContrato(modalidade)` antes de chamar `fn_criar_contrato_recorrencia`:
  - `cartao_credito` → `cartao_recorrencia`
  - `pix_automatico` → `pix_automatico`
  - `boleto` → `boleto`
  - `debito` → `maquina_debito`
  - `dinheiro` → `dinheiro`
  - `pix_avista` → `dinheiro` (à vista, registro manual)
  - `pendente` → `pendente`

---

## 3) Contrato não aparece em "Contrato"

### Diagnóstico
O motivo principal era o erro do item 2: o `INSERT` em `contratos` falhava e nenhum contrato era criado. Após corrigir, validar:

- `ContratoFinanceiro.tsx` já consulta `["contratos-aluno", alunoId]`.
- `VendaDialog.tsx` já invalida `["contratos"]` e `["contratos-aluno", alunoId]` no `onSuccess`. **Adicionar também** `qc.invalidateQueries({ queryKey: ["cobrancas-contrato"] })` para refrescar a lista de cobranças.
- Garantir que, no fluxo **cartão online + recorrência**, a edge function `rede-cobrar-cartao` continue criando o contrato após aprovação (já implementado). Após o `onSuccess` do `PagarCartaoDialog`, invalidar também `["contratos-aluno", alunoId]`.

---

## Arquivos afetados

**Migração SQL**
- Adicionar coluna `servicos_inclusos jsonb` em `contratos`.
- Estender CHECK `contratos_forma_pagamento_check` com `'pendente'`.
- Atualizar `fn_criar_contrato_recorrencia` para aceitar `p_servicos_inclusos jsonb` e criar entradas em `creditos_aluno` (Avaliação Funcional / Nutrição / Reabilitação) conforme o JSON.

**Frontend**
- `src/components/student/venda/VendaDialog.tsx` — novo step "Serviços", mapeamento `modalidade → forma_pagamento`, invalidações extras, passar `servicos_inclusos` para a RPC; para vendas tradicionais com benefícios, criar créditos após o insert.
- `src/components/student/venda/ServicosPlanoStep.tsx` *(novo)* — UI da etapa com a matriz de regras acima.
- `src/lib/vendas-servicos.ts` *(novo)* — função `getServicosBase(nomePlano)` retornando os defaults e opções permitidas; helper `montarServicosInclusos(...)`.

## Fora de escopo
- Renegociar serviços de contratos já existentes.
- Tela de "definir depois" (será um simples filtro no perfil — não incluído agora).
