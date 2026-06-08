# Diagnóstico: renovação automática NÃO está acontecendo

## O que está funcionando
- Cron job `renovar-planos-mensais-daily` rodando **todo dia às 03:00 UTC**, chamando o edge function `renovar-planos-mensais`.
- Edge function tem a lógica correta: gera uma `vendas` (origem `renovacao_automatica`, status `pendente`) para cada mês vencido e atualiza `proxima_renovacao` do plano.
- Helper `isAutoRenewPlan()` em `src/lib/planTipo.ts` reconhece corretamente Start, Gympass, Wellhub e Total Pass.

## O que está quebrado (causa raiz)
O edge function filtra por:
```
.eq("renovacao_automatica", true)
.lte("proxima_renovacao", today)
```

Mas no banco, **todos** os planos Start+/Gympass/Wellhub/TotalPass ativos estão com:
- `renovacao_automatica = false`
- `proxima_renovacao = NULL`

Resultado: o cron roda, mas processa **zero planos**. Nenhuma mensalidade nova, nenhum histórico em `vendas`, nada.

Motivo: os formulários (`AddStudentDialog`, `EditStudentDialog`) e o importador (`studentImport.ts`) inserem planos sem nunca setar essas duas colunas, mesmo quando o tipo é Start/Gympass/Wellhub/TotalPass. O helper `isAutoRenewPlan` existe mas não é chamado em nenhum lugar de escrita.

---

# Plano de correção

## 1. Migration — backfill + trigger automática
Uma migration única que:

**a) Função utilitária** `public.fn_proxima_renovacao_from(data_inicio date)` — retorna o próximo aniversário mensal de `data_inicio` que seja ≥ hoje (lógica idêntica à do edge function).

**b) Trigger `BEFORE INSERT OR UPDATE` em `public.planos`:**
- Se `tipo` casa com Start / Gympass / Wellhub / Total Pass (case-insensitive), força `renovacao_automatica = true` e, quando `proxima_renovacao` estiver nula, calcula a partir de `data_inicio`.
- Para os demais tipos, mantém o comportamento atual.

**c) Backfill (UPDATE em massa):**
```
UPDATE planos
SET renovacao_automatica = true,
    proxima_renovacao = public.fn_proxima_renovacao_from(data_inicio)
WHERE ativo = true
  AND (tipo ILIKE 'start%' OR tipo ILIKE '%gympass%' 
       OR tipo ILIKE '%wellhub%' OR tipo ILIKE '%total%pass%')
  AND (renovacao_automatica = false OR proxima_renovacao IS NULL);
```

Com isso, na próxima execução do cron (ou em uma execução manual), todos os planos vencidos geram suas vendas retroativas em cadeia (o `while` do edge function já cobre múltiplos meses atrasados).

## 2. Frontend — manter consistência ao criar/editar planos
Mesmo com a trigger garantindo no banco, atualizar para enviar os campos explicitamente (clareza + previne edição manual indevida):

- `src/components/student/AddStudentDialog.tsx`: no `insert` de `planos`, se `isAutoRenewPlan(plan.tipo)` → enviar `renovacao_automatica: true`.
- `src/components/student/EditStudentDialog.tsx`: idem.
- `src/lib/studentImport.ts`: idem ao criar planos durante importação.

(A trigger é a defesa real; o front fica só alinhado.)

## 3. Validação pós-migration
- Rodar `SELECT count(*) FROM planos WHERE ativo AND renovacao_automatica AND proxima_renovacao <= current_date;` — deve retornar > 0.
- Disparar manualmente o edge function `renovar-planos-mensais` (ou aguardar 03:00 UTC) e conferir:
  - Novas linhas em `vendas` com `origem = 'renovacao_automatica'` e `status_pagamento = 'pendente'`.
  - Coluna `proxima_renovacao` do plano avançou para o próximo mês futuro.
- Conferir no perfil do aluno (`StudentProfile` → Histórico de Vendas) que a mensalidade aparece.

## Fora de escopo (não será feito agora)
- Cobrança automática no cartão (já tem plano salvo em `.lovable/plano-gateway.md`, depende de integração Rede).
- Notificações ao aluno/coordenador sobre a venda gerada (pode entrar depois).
- Alterar o status_pagamento inicial (continua `pendente` — quem confirma é o operador ou o gateway futuro).

---

# Detalhes técnicos

**Arquivos tocados:**
- Nova migration SQL (função + trigger + backfill).
- `src/components/student/AddStudentDialog.tsx`
- `src/components/student/EditStudentDialog.tsx`
- `src/lib/studentImport.ts`

**Sem mudanças em:** edge function `renovar-planos-mensais` (já está correta), cron job (já agendado), tabela `vendas`, RLS.
