# Corrigir erro no link de aceite de contrato

## Causa (confirmada no banco)
A função que cria o link de aceite (`fn_criar_link_contrato`) chama `gen_random_bytes` sem o prefixo `extensions.` e roda com `search_path=public`. A função existe só no schema `extensions`, por isso o erro "function gen_random_bytes(integer) does not exist". Nenhuma outra função ou coluna tem esse problema.

## Correção
- Uma migração que recria `fn_criar_link_contrato` com o corpo atual idêntico, trocando apenas `gen_random_bytes(` por `extensions.gen_random_bytes(` (mantendo assinatura, SECURITY, search_path e permissões).
- Nada mais muda: contratos, tokens já gerados, flags, Planos 1 e 2 intocados.

## Verificação
- Conferir a nova definição no banco.
- Gerar um link de aceite de teste (aluno NICOLAS TESTE) pela tela e confirmar que o link abre; apagar o link de teste depois.
