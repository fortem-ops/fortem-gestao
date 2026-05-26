## Causa

Na função `public.fn_ponto_registrar`, quando o ponto é registrado fora do raio, é criado um destinatário em `notificacao_destinatarios` com `status = 'nao_visualizada'::notif_status`. A coluna real é do tipo `notif_dest_status`, daí o erro `42804`.

## Correção

1. Em `public.fn_ponto_registrar`, trocar o cast do `INSERT` em `notificacao_destinatarios`:
   - de `'nao_visualizada'::notif_status`
   - para `'nao_visualizada'::notif_dest_status`
2. Antes de aplicar, conferir com `enum_range(NULL::notif_dest_status)` se `'nao_visualizada'` existe nesse enum. Se não existir, usar o valor equivalente correto (ex.: `'pendente'`/`'nao_lida'`) detectado na inspeção.

Nenhum outro trecho da função precisa mudar.

## Validação ponta a ponta

Executar via SQL como o usuário logado (admin) cada transição, conferindo `fn_ponto_estado_atual` entre elas:

```text
entrada → intervalo_inicio → intervalo_fim → saida
```

Em cada passo verificar:
- Retorno JSON `ok: true`, sem erro 42804.
- `ponto_jornadas` atualizada com o timestamp correto.
- `ponto_eventos` recebe o registro com `fora_do_raio`, `distancia_m` e `local_mais_proximo_id` quando houver GPS.
- Quando `fora_do_raio = true`: `notificacoes` recebe registro `categoria='ponto'` e `notificacao_destinatarios` é populada para todos os `admin`/`coordenador` sem erro de tipo.

Ao final, limpar a jornada de teste (ou deixar registrada, conforme preferência do usuário) e confirmar que o botão "Bater Ponto" no `/ponto` funciona para entrada e saída.
