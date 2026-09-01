# Ajustes no funil /planos

## Objetivo
Sincronizar a landing page pública `/planos` com a versão de referência do "Fortem Plan Builder": trocar o WhatsApp e simplificar o texto de recorrência.

## Alterações

### 1. Trocar número do WhatsApp
- **Arquivo:** `src/data/planosPricing.ts`
- **Mudança:** atualizar a constante `WHATSAPP_NUMERO` de `"5551991519640"` para `"5135199451"`.
- **Impacto:** `WhatsAppCta.tsx` e `StepSummary.tsx` passam a usar o novo número no link `wa.me`.

### 2. Simplificar label de recorrência
- **Arquivo:** `src/components/planos/StepSummary.tsx`
- **Mudança:** alterar o texto do `Label` de
  `"Quero recorrência mensal (sem fidelidade de 12 meses)"`
  para
  `"Quero recorrência mensal"`.

## Validação
- Link do CTA deve apontar para `https://wa.me/5135199451?text=...`.
- Label deve exibir apenas "Quero recorrência mensal".
