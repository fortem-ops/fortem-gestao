# Trocar número do WhatsApp do funil /planos

## Objetivo
Alterar o destino do CTA do WhatsApp na landing page pública `/planos` para o número **5135199451**.

## Alteração
- **Arquivo:** `src/data/planosPricing.ts`
- **Mudança:** atualizar a constante `WHATSAPP_NUMERO` de `"5551991519640"` para `"5135199451"`.

## Impacto
O novo número será usado automaticamente por:
- `src/components/planos/WhatsAppCta.tsx` (montagem do link `wa.me` e mensagem)
- `src/components/planos/StepSummary.tsx` (texto de redirecionamento)

## Validação
Após a alteração, o link gerado no botão "COMEÇAR A TREINAR AGORA" deve apontar para `https://wa.me/5135199451?text=...`.
