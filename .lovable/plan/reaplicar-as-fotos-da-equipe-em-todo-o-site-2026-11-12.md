# Reaplicar as fotos da equipe em todo o site

## Situação hoje
- Na página inicial e na página de treino experimental as fotos da equipe já aparecem (Nicolas, Gustavo, Thaís, Cristiano e Bruno).
- Nas páginas de serviço (Treinamento, Nutrição e Reabilitação) os cards de pessoas mostram só o quadro cinza com o nome, mesmo para quem já tem foto. Em Treinamento isso afeta Nicolas, Gustavo, Thaís e Cristiano.
- Jonas, Vanessa, Yasmim, Jéssica e Júlia ainda não têm foto enviada. Eles continuam com o quadro cinza até as fotos chegarem.

## O que muda
1. Os cards de pessoas das páginas de serviço passam a usar a mesma lista de fotos da página inicial, buscando pelo nome da pessoa. Ficam no formato retrato com os cantos vermelhos de sempre.
2. Uma regra única para todo o site: onde aparecer o nome de alguém da equipe, a foto vem da mesma lista. Quando uma foto nova for enviada, ela aparece em todas as páginas de uma vez.
3. Nada muda nos textos, na ordem das pessoas nem nas outras fotos.

## Detalhes técnicos
- Criar `fotoEquipe(nome)` em `src/site/fotos.ts`, com base em `FOTOS_EQUIPE`. `CardEquipe` e os dois `PlaceholderFoto` do bloco "pessoas" em `SiteServicoPagina.tsx` passam a usá-la, repassando src/width/height/descricao, e caem no quadro cinza quando não houver foto.
- Teste em `src/site/fotos.test.ts`: cada nome de `EQUIPE` e dos blocos "pessoas" que tem foto devolve a foto certa; quem não tem foto devolve indefinido.
- Rodar `bunx vitest run` e `bunx eslint` nos arquivos alterados, e conferir /treinamento com print.

## Dúvida
- Se quiser que Jonas, Vanessa, Yasmim, Jéssica e Júlia também tenham foto, é só enviar as fotos e eu cadastro na mesma lista.
