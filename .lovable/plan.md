# Foto de "Quem conta": centralizar + ajuste pela equipe

## O que muda
- A foto passa a ficar centralizada no cartão.
- Na tela da equipe, aba "Fotos da história", aparece um bloco "Foto de Quem conta" com a prévia do cartão e dois controles deslizantes: **horizontal** e **vertical** (mais um de **zoom**, de 100% a 150%). Botão "Salvar" e "Voltar ao centro".
- O que for salvo aparece na hora na página /10anos.
- Se nada for salvo, vale o centro.

## Fora deste pedido
A foto em si, os textos, as outras fotos, Planos, cobranças e Pix não mudam. Nada é publicado.

## Detalhes técnicos
- Guardar `{x, y, zoom}` em `sistema_config` na chave `festa_autor_foto_ajuste`; gravação só por quem já gerencia a festa.
- `festa-fotos-publico` passa a devolver também esse ajuste (o visitante não lê a configuração diretamente); republicar a função.
- `Festa10Anos.tsx` linha 212: `object-position: x% y%` e `transform: scale(zoom)` com `overflow-hidden`; padrão 50% 50% / 1.
- Novo bloco em `FestaFotosAdmin.tsx` com `Slider` do shadcn e TanStack Query.
- Conferir com Playwright na página e na tela da equipe.
