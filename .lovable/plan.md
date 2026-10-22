# Fotos da história: arrastar para ordenar + fotos que não aparecem no site

## 1. Arrastar para ordenar (aba "Fotos da história")
- Cada foto ganha uma alça de arrastar. Você segura a foto e solta na nova posição dentro do mesmo ano; a ordem é salva na hora e vale também na página /10anos.
- No celular funciona com toque (segurar e arrastar).
- As setas de subir/descer continuam, para quem usa teclado.
- Enquanto salva, as fotos ficam travadas para não misturar duas mudanças.

## 2. Fotos que não aparecem no site
O que já conferi: as 69 fotos enviadas pela equipe existem no armazenamento, todas em JPG/PNG. Então o arquivo não está faltando. Várias têm de 4 a 5 MB.

Causa ainda não confirmada. Prováveis:
- Fotos dentro do slide que só carregam quando aparecem, e às vezes não carregam (carregamento adiado dentro do slide).
- Fotos pesadas (4–5 MB) que demoram muito no celular e parecem em branco.
- Links temporários das fotos vencendo quando a página fica aberta muito tempo.

Primeiro passo: abrir /10anos no celular e no computador, passar por todos os slides e anotar quais fotos falham e por quê. Só depois aplico a correção certa:
- carregar a foto atual e as vizinhas do slide sem adiar;
- se for peso: novas fotos são reduzidas antes do envio (lado maior até 2000 px, ~85% de qualidade), sem cortar;
- se for link vencido: renovar os links ao voltar para a página.
- Se você souber de um ano/foto específica que não aparece, me diga para eu começar por ela.

## 3. Links fixos de 10 anos para as fotos
- Hoje cada abertura da página cria links novos (validade de 1 dia), então o navegador baixa as fotos de novo toda vez, e a página fica mais lenta e pesada.
- Cada foto passa a ter um link fixo, válido por 10 anos, criado uma vez no envio e guardado junto da foto. O navegador guarda a foto e não baixa de novo.
- As fotos já enviadas recebem seus links fixos de uma vez só.
- Também ajuda nas fotos que "não aparecem" por link vencido.
- Observação: o link fixo deixa a página mais leve nas visitas seguintes; o peso de cada foto (4–5 MB) só diminui com a redução do item 2.

## Fora deste pedido
Curtidas, comentários, textos da história, Planos 1 e 2, flags, cobranças e Pix não mudam. Nada é publicado.

## Detalhes técnicos
- `FestaFotosAdmin.tsx`: drag-and-drop com `@dnd-kit` (já usado em `SortableWidget`) por ano; ao soltar, regrava `ordem = índice` das fotos do ano em lote e invalida `festa-fotos`.
- `FestaFotosAno.tsx`: `loading="eager"` no slide atual e vizinhos; diagnóstico com Playwright (falhas de rede/`naturalWidth=0`).
- Redução de imagem no navegador (canvas) antes do upload, só para envios novos.
- Sem migração.
