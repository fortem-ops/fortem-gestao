# Foto do Nícolas em "Quem conta"

## O que muda
- O cartão "Quem conta" na página /10anos passa a mostrar a foto enviada, acima do nome.
- A foto fica leve: reduzida para no máximo 900 px no lado maior, em WebP (~80% de qualidade), sem perder nitidez no cartão.
- Enquadramento vertical do cartão (4:5) centrado no rosto; carregamento adiado e decodificação assíncrona.

## Fora deste pedido
Textos, outras fotos, curtidas, Planos, cobranças e Pix não mudam. Nada é publicado.

## Detalhes técnicos
- Converter o PNG com ffmpeg em /tmp (scale máx 900 px, WebP q80) e subir via `lovable-assets` para `src/assets/festa-nicolas.webp.asset.json`.
- `src/config/festaHistoria.ts`: `autor.foto = nicolas.url`.
- `Festa10Anos.tsx` linha 212: adicionar `loading="lazy" decoding="async"` e `object-[50%_30%]`.
