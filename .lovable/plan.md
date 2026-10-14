# Diagnóstico — "O contrato mudou" no Passo 6 (prévia admin, Power 2x + recorrência + consultas)

## O que já está confirmado (só leitura)

**De onde vem a mensagem com o botão TENTAR DE NOVO.**
O botão só aparece no Passo 6 quando a tela não conseguiu carregar o resumo (`revisao` vazio). Isso acontece só quando `carregarRevisao` falha antes de guardar o resumo. Há três caminhos possíveis no servidor:

1. `tela_pagamento` (planos-checkout):
   ```text
   if (!["contrato_aceito","aguardando_pagamento","falhou"].includes(e.etapa) || !e.aceite_id) -> "O contrato mudou..."
   if (Object.keys(calcular).some(k => JSON.stringify(calcular[k]) !== JSON.stringify(e.revisao[k]))) -> "O contrato mudou..."
   ```
2. Qualquer função do banco cujo erro contenha esse texto. O servidor repassa à tela os erros da lista NEUTRAS e troca qualquer outro por uma mensagem genérica. As funções de início de pagamento (migrações 0103/0104/0112/0122) têm esse texto, mas não são chamadas nessa tela.
3. A chamada da prévia das consultas (F2/F3) **não** pode gerar essa mensagem. Quando ela falha, a tela mostra a mensagem genérica, porque o erro não é do tipo `ErroCheckout`.

**Conclusão parcial:** a mensagem que você viu veio de `tela_pagamento`. Ou seja, a tela **pulou o desvio da prévia das consultas** e seguiu pelo caminho normal de pagamento único. Esse desvio só roda com `previa` = verdadeiro, aceite registrado e resumo de recorrência com consultas.

**O que foi descartado:**
- Catálogo inalterado desde 13/10. Valor do plano e das consultas conferem com o resumo guardado (544.680 + 162.000 = 706.680 centavos).
- O texto do contrato não muda entre chamadas: o hash é calculado no aceite e não entra nessa conferência.
- F1, F2 e F3 não mexeram em `fn_checkout_2027_calcular`, `_revisar`, `_estado` nem nos modelos de contrato.
- O aceite específico das consultas é guardado à parte e não entra nessa conferência.
- As duas últimas propostas de prévia (13:36 e 13:38) estão "contrato aceito", com resumo completo. Uma delas passou pela tela F2: 5 registros de simulação e 1 obrigação.

## Causa provável (ainda não comprovada)
1. **Mais provável:** o teste foi feito na versão publicada do site, que ainda não tem a tela F2/F3 (falta o Publish). Lá não existe o desvio, e o pagamento único rejeita recorrência com consultas.
   - Pendente: confirmar por que a conferência de `tela_pagamento` dá diferença nesse caso.
   - Pendente: confirmar se a versão publicada da função `planos-checkout` é igual à do código.
2. **Alternativa:** a prévia perdeu `previa=1` (por exemplo, ao recarregar ou ao voltar por "Alterar"). Sem isso, a tela não entra no desvio.

## Regressão?
- **Público:** visitante não chega a esse ponto, porque recorrência com consultas segue bloqueada em "contato com a equipe". Planos sem recorrência e o 12x combinado não passam por essa diferença.
- **Antes da F2:** recorrência com consultas sempre terminava em `tela_pagamento`. Então o travamento provavelmente já existia antes, e a F2 só o contorna na prévia publicada. A confirmar no passo 1.

## Plano (aguarda aprovação)
1. **Reproduzir com prova:**
   - Abrir `/planos?previa=1` como admin, na prévia e no endereço publicado.
   - Criar uma proposta de prévia de teste, sem pagamento, com Power 2x, recorrência e Nutri 4+2.
   - Registrar qual chamada devolve a mensagem e qual chave da conferência difere.
   - Conferir a versão publicada da função `planos-checkout` e se a tela entra no desvio.
   - Isso grava só uma proposta de prévia de teste, igual aos testes da F2.
2. **Correção mínima, conforme a causa confirmada:**
   - Se for falta de Publish: nenhuma mudança no código, só publicar o aplicativo.
   - Se `previa` se perder: guardar a marca de prévia junto da sessão, conferida de novo no servidor, e passá-la ao reabrir a tela.
   - Se a conferência de `tela_pagamento` falhar de verdade: corrigir só a comparação, ignorando campos que não são do cálculo, sem mexer no hash do contrato.
3. **Validar:**
   - Fluxo Power 2x com recorrência e consultas chega ao contrato e ao pagamento da prévia.
   - Público continua bloqueado.
   - 12x combinado e planos sem consultas não mudam.
   - Rodar os testes completos.

## Detalhes técnicos
- Exibição: `src/components/planos/CheckoutSite2027.tsx` (`carregarRevisao`, desvio `previa && aceite_id && consultasSeparadas`; "Tentar de novo" quando `revisao` é nulo).
- Mensagem repassada por `rpc()`/`NEUTRAS` em `supabase/functions/planos-checkout/index.ts`.
- Nenhuma alteração em chaves, crons, flags ou banco nesta etapa.
