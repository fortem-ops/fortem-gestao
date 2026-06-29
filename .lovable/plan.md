## Objetivo

1. Remover do **Plano/Serviços > Plano Contratado** o botão "Cancelar Contrato" — a ação passa a viver só em **Pagamentos**.
2. Em **Pagamentos**, evoluir o fluxo de cancelamento para incluir **data agendada** e **tratamento de multa** integrado.
3. Manter integração com Plano/Serviços (a tela de Plano Contratado reflete o agendamento/cancelamento feito em Pagamentos).

## Mudanças por arquivo

### 1. `src/components/student/StudentPlan.tsx` — desativar entrada de cancelamento
- Remover (ou desabilitar com tooltip "Disponível em Pagamentos") o botão `Cancelar Contrato` (linhas ~425-440).
- Manter o `CancelDialog` existente importado, mas sem trigger. Como a tela ainda precisa **refletir** cancelamento agendado, adicionar um banner/badge no card do plano quando existir `contratos.data_cancelamento` ou `data_fim` futuro com `motivo_cancelamento` preenchido:
  - "Cancelamento agendado para dd/mm/aaaa" com link "Ver em Pagamentos" (muda a aba via `?tab=contrato`).
- A leitura desses campos vem do contrato vigente (já consultado em outros pontos via `contratos-aluno`), reaproveitando `useQuery` com a mesma chave usada em `ContratoFinanceiro.tsx`.

### 2. `src/components/contratos/RescisaoDialog.tsx` — agendamento + multa editável + tratamento por forma
Refatorar para:
- Adicionar campo **Data efetiva do cancelamento** (`Input type="date"`, default = hoje). Datas futuras = agendamento; data atual/passada = cancelamento imediato.
- Após o bloco de resumo (multa calculada por `calcRescisao`), inserir um campo editável **"Ajustar multa (R$)"** pré-preenchido com `r.total_devido` (recorrência) ou `r.saldo_devedor` (parcelado). O valor digitado sobrescreve o calculado.
- Adicionar uma seção **"Como tratar a multa"** com lógica automática segundo `contrato.forma_pagamento`:
  - Formas **tradicionais** (`cartao_parcelado`, `dinheiro`, `maquina_*`, `boleto`): exibir "Será gerado **estorno** de R$ X" (sempre). Sem opção alternativa.
  - Formas **recorrência** (`cartao_recorrencia`, `pix_automatico`): exibir "Será criada **nova cobrança de multa** com vencimento em [data]" com `Input type="date"` para o vencimento (default = hoje + 7 dias).
- O callback `onConfirmar` passa a receber `{ dataCancelamento, valorMulta, tratamento: 'estorno' | 'nova_cobranca', vencimentoMulta? }` em vez de não receber argumentos.

### 3. `src/pages/alunos/ContratoFinanceiro.tsx` — orquestrar persistência
Atualizar `handleCancelar` (linha 126) para receber o payload do dialog e executar:
1. **Update do contrato**:
   - `status = 'cancelado'` somente se `dataCancelamento <= hoje`; senão mantém `ativo` e grava `data_cancelamento`/`data_fim = dataCancelamento` + `motivo_cancelamento` (cancelamento agendado).
2. **Cobranças futuras**: cancelar pendentes com `data_vencimento > dataCancelamento`.
3. **Multa**:
   - `tratamento === 'estorno'`: inserir registro em `cobrancas` com `valor = -valorMulta`, `status = 'pago'`, `meio_registro = 'estorno_cancelamento'`, `data_pagamento = hoje`, `gateway` espelhando o do contrato. (Mantemos histórico financeiro consistente sem nova tabela.)
   - `tratamento === 'nova_cobranca'`: inserir em `cobrancas` com `valor = valorMulta`, `status = 'pendente'`, `data_vencimento = vencimentoMulta`, `meio_registro = 'multa_cancelamento'`.
4. Suspender ciclos ativos como já é feito.
5. Invalidar caches: `contratos-aluno`, `cobrancas-contrato`, `ciclo-ativo` + `plano-aluno-*` (para a aba Plano/Serviços refletir).

### 4. (Opcional, sem schema novo)
Não é necessária migração — todos os campos usados (`data_cancelamento`, `data_fim`, `motivo_cancelamento`, `cobrancas.meio_registro`, valor negativo) já existem.

## Pontos de UX

- Resumo de cancelamento agora termina em três blocos claros: **Data efetiva**, **Multa (editável)**, **Tratamento da multa** (estorno automático ou nova cobrança com vencimento).
- Botão final: "Confirmar cancelamento" quando imediato, "Agendar cancelamento" quando data futura.
- Toast: "Cancelamento agendado para dd/mm" ou "Contrato cancelado".

## Fora de escopo
- Disparo automático real do estorno no gateway (Rede/PIX). Aqui só registramos a `cobranca` de estorno; integração com `rede-cancelar`/`pix-cancelar-recorrencia` permanece como já existe e pode ser plugada num passo posterior se desejado.
- Job que processa cancelamentos agendados na data efetiva — pode ser adicionado depois (hoje a flag `data_fim` + status já bloqueia renovação).
