# Adicionar fotos em 2027

## O que foi confirmado
- O painel de fotos só mostra o botão "Adicionar fotos" para os anos de 2016 a 2026. O ano de 2027 aparece num cartão separado, só com o áudio.
- No site /10anos, o capítulo 2027 já está pronto para exibir fotos: elas aparecem assim que forem enviadas.

## O que será feito
- O cartão de 2027 no painel passa a funcionar como os outros anos: botão "Adicionar fotos", arrastar para ordenar, descrição, enquadramento e o áudio.
- Nada muda nos outros anos nem nas fotos que já foram enviadas.

## Detalhes técnicos
- `FestaFotosAdmin.tsx`: percorrer `ANOS_HISTORIA` (2016–2027) no bloco principal, em vez de `cfg.historia.anos`, e remover o bloco que mostrava só o áudio.
- Não há mudança no banco de dados nem no armazenamento das fotos.
