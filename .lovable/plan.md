# Refatorar VendaDialog para wizard 3 passos

Inspirado no estilo radio-card do projeto "Your Wellness Choice", transformar o dialog de Nova Venda em um fluxo guiado com indicador de progresso.

## Estrutura

Dialog mantém as **tabs Planos / Serviços** no topo. Cada tab abre um wizard independente.

### Tab "Planos" — wizard 3 passos

**Passo 1 — Frequência**
- Stepper visual no topo (1. Frequência · 2. Plano · 3. Resumo) com bolinha ativa em verde primary.
- Lista radio-card (estilo do projeto referenciado): borda + ring quando selecionado, ícone à esquerda.
- Opções: 1x semana, 2x semana, 3x semana, Livre.
- Botão "Continuar" desabilitado até selecionar.

**Passo 2 — Plano**
- Filtra `planos_catalogo.ativo=true` pela frequência escolhida no passo 1.
- Cards radio (visual igual passo 1): bolinha de cor do plano + nome + período + créditos calculados + valor à direita.
- Se nenhum plano daquela frequência, mostra empty-state com link "voltar e escolher outra frequência".
- Botões "Voltar" + "Continuar".

**Passo 3 — Resumo**
- Card único consolidando: aluno, frequência, plano, período, créditos, valor total formatado em BRL grande.
- Status pagamento (select: pendente/pago) — default pendente.
- Campo opcional Observações (textarea).
- Botões "Voltar" + "Confirmar venda" (verde, full-width).
- Ao confirmar: mesma mutation atual (`vendas.insert` com `status_pagamento`, `observacoes`), trigger gera plano + créditos.

### Tab "Serviços" — wizard 2 passos (sem frequência)

**Passo 1 — Serviço**: cards radio dos serviços ativos.
**Passo 2 — Resumo**: idem planos (sem campo frequência/período).

## Implementação técnica

Editar apenas `src/components/student/venda/VendaDialog.tsx`:
- Estado local: `step` (1|2|3), `frequencia`, `selectedPlanoId`, `selectedServicoId`, `statusPagamento`, `observacoes`.
- Resetar estado ao trocar de tab e ao fechar dialog.
- Componente interno `<StepIndicator steps={[...]} current={step} />` reusando tokens (primary, muted-foreground).
- Componente interno `<RadioCard selected={} onClick={} icon valor right>...</RadioCard>` reaproveitado nos passos.
- Mutation `vendas.insert` agora envia `observacoes` e `status_pagamento` selecionados.
- Sem mudanças de schema (colunas `observacoes` e `status_pagamento` já existem em `vendas`).

## Fora do escopo
- Mudanças no trigger `fn_processar_venda`, nas tabelas, no histórico de vendas ou em outros componentes.
- Comissão, recorrência, alertas (já marcados como fora de escopo no plano original).
