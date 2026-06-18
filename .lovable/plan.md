## Problema

Ao bater ponto sem GPS (ou quando `fn_local_mais_proximo` não retorna linha), a função `fn_ponto_registrar` quebra com:

> `O registro "_local" ainda não foi atribuído`

Causa: o bloco final faz `RETURN jsonb_build_object(... 'local_nome', _local.nome)` e o bloco de notificação faz `COALESCE(_local.nome, ...)`. Como `_local` é um `record` que só é atribuído via `SELECT * INTO _local FROM fn_local_mais_proximo(...)` quando há lat/lng, ele permanece "não atribuído" e qualquer acesso a `_local.<campo>` lança erro em PL/pgSQL. Isso também dispara o erro de React `insertBefore` no ErrorBoundary, porque o toast é interrompido por uma re-render abrupta.

A professora Vanessa cai nesse caminho porque o navegador dela nega/timeouta GPS (ou ela está fora de qualquer local cadastrado), então `_lat`/`_lng` chegam nulos.

## Correção

Migration única ajustando `public.fn_ponto_registrar`:

1. Declarar `_local_nome text;` e, quando `FOUND`, fazer `_local_nome := _local.nome;`.
2. Substituir os dois usos de `_local.nome` por `_local_nome` (com `COALESCE` onde já existia).
3. Manter toda a demais lógica (regras de transição, insert do evento, notificação de fora do raio, retorno JSON) idêntica.

Nenhuma mudança de frontend é necessária — o `BotaoInteligente` já trata `fora_do_raio` e ausência de GPS corretamente assim que a RPC parar de lançar exceção.

## Verificação

Após aplicar:
- Chamar `fn_ponto_registrar('entrada', NULL, NULL, NULL, 'web')` em uma conta de teste deve retornar `ok:true` com `fora_do_raio:true` e `local_nome:null`, sem exceção.
- Vanessa consegue registrar entrada mesmo sem permissão de localização; aparece o toast amarelo "Registrado sem localização" ao invés do erro vermelho.
