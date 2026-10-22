# 2024: mostrar as fotos na página /10anos

## Causa (confirmada)
As 13 fotos de 2024 estão salvas normalmente. O capítulo 2024 foi configurado para não ter bloco de fotos, porque era um ano de texto pessoal. Por isso a página esconde as fotos dele.

## O que muda
- O capítulo 2024 volta a mostrar o slide com as 13 fotos, na ordem definida na aba "Fotos da história".
- O texto, a barra cinza e o resto do capítulo continuam iguais.

## Fora deste pedido
Outros anos, curtidas, comentários, Planos, cobranças e Pix não mudam. Nada é publicado.

## Detalhes técnicos
- `src/config/festaHistoria.ts` linha 169: remover `semFotos: true` do capítulo 2024.
- Conferir que os testes de "Nossa história" continuam passando e checar /10anos com Playwright.
