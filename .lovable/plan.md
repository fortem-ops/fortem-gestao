# Erro "Load failed" ao criar cupom

## Diagnóstico (confirmado)
- Os dados enviados do cupom LUCAS20 estavam corretos (20%, 28/09, ativo) e as permissões de admin/coordenação para gravar promoções estão ok.
- O pedido nunca chegou a ter resposta do servidor: o iPhone derrubou a conexão no meio (erro "Load failed" do Safari = falha de rede, não recusa do sistema). O cupom não foi gravado.

## Mudança (só na tela de Promoções)
1. Ao dar erro de conexão, tentar gravar de novo automaticamente (até 2 vezes, com pequena pausa). Antes de tentar de novo, conferir se o código já foi gravado, para não criar cupom duplicado.
2. Se ainda falhar, trocar "TypeError: Load failed" por uma mensagem clara: "Sem conexão com o servidor. Verifique a internet e toque em Criar de novo." O formulário continua aberto com os dados preenchidos.
3. Mostrar mensagem clara também quando o código do cupom já existir.

## Detalhes técnicos
- `src/components/loja/PromocoesTab.tsx`: envolver insert/update em retry para erros de rede (`TypeError`/`Failed to fetch`/`Load failed`); no insert, antes do retry, `select id` por `codigo` para evitar duplicidade; mapear erro `23505` para "Código já existe".
