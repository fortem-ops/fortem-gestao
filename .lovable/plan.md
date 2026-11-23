# Fotos da Vanessa e do Jonas no site

Os dois cartões que hoje mostram "FOTO · Jonas Hubner" e "FOTO · Vanessa Coutinho" passam a mostrar as fotos enviadas, em todas as páginas onde eles aparecem (equipe da home e páginas de serviço), com o mesmo recorte 3:4 e cantos vermelhos dos outros profissionais.

## O que muda
- Fotos enviadas: Stories (7) = Jonas, Stories (8) = Vanessa.
- Cada foto é recortada em retrato 3:4 (900x1200), centralizada no rosto e tronco, e convertida para WebP, como as demais.
- Descrições para leitores de tela: "Profissional sorrindo, de camiseta vermelha FORTEM, na área de treino" (Jonas) e "Profissional sorrindo, de braços cruzados e camiseta vermelha, na área de treino" (Vanessa).

## Detalhes técnicos
- Gerar `equipe-jonas.webp` e `equipe-vanessa.webp` em /tmp e subir pela CDN, salvando os ponteiros `src/assets/fotos/equipe-jonas.webp.asset.json` e `equipe-vanessa.webp.asset.json`.
- `src/site/fotos.ts`: novas entradas em `FOTOS_SITE` e `FOTOS_EQUIPE` com os nomes exatos "Jonas Hubner" e "Vanessa Coutinho" (como em `conteudo.ts`).
- `src/site/fotos.test.ts`: hoje espera `fotoEquipe("Jonas Hubner")` indefinido; passa a esperar as fotos de Jonas e Vanessa e usa outro nome sem foto no caso "indefinido".
- Conferir no navegador a seção da equipe, rodar `bunx vitest run` e eslint nos arquivos alterados.
