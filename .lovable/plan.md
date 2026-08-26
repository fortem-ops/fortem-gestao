# Corrigir resposta de rede-salvar-cartao para informar substituição

## Diagnóstico (confirmado)
- Caminho de sucesso 200 retorna apenas `{ success: true, last4, brand }` (linha 451).
- O helper `salvarCartaoComSubstituicao` já retorna `substituiuId` (id do cartão antigo desativado), mas a function o descarta.
- Consequência: o toast "substituiu o cartão anterior final XXXX" em `CadastrarCartaoDialog.tsx` nunca dispara, mesmo quando a substituição ocorre.
- Como a deduplicação é por `last4`, o cartão substituído tem o mesmo final do novo — o campo pode simplesmente ecoar o próprio `last4`.

## Mudanças

### 1. `supabase/functions/rede-salvar-cartao/index.ts`
Na resposta de sucesso (linha 451), incluir campo de substituição derivado de `resultadoCartao.substituiuId`:

```ts
return new Response(JSON.stringify({
  success: true,
  last4,
  brand,
  substituiu_last4: resultadoCartao.substituiuId ? last4 : null,
}), { status: 200, headers });
```

(Como a chave é `last4`, o final substituído é o mesmo; manter o nome do campo que o diálogo já consome.)

### 2. `CadastrarCartaoDialog.tsx`
Sem mudanças — já lê `data?.substituiu_last4`. Apenas verificar que o ramo passa a disparar.

### 3. Teste
Adicionar 1 teste no `_shared` (ou ajustar existente) garantindo que quando `substituiuId` é não-nulo o payload final inclui `substituiu_last4`. Se o teste exigir tocar a function inteira, cobrir apenas a decisão do payload.

### 4. Deploy + verificação
- Rodar suíte completa (esperado ≥ 485 passando).
- Deploy da `rede-salvar-cartao`.
- Nenhum dado real alterado.

## Fora de escopo
- Caminho `pending` (tokenização por bandeira): substituição ocorre no webhook, não é possível informar na resposta — o diálogo já cobre com o toast de pendente.
