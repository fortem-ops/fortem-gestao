# Fase 3 — Página pública /10anos/fotos (com logos e mockups recebidos)

Referências recebidas: logos FORTEM branco e preto (SVG, proporção ~5,6:1), mockups das 9 telas do site e dos modelos "Papel branco" e "Tela cheia com selo". As molduras ficam para a Fase 4; nesta fase a logo só entra no topo da página.

## Telas (celular primeiro, fundo escuro, Archivo, cantos retos, sem sombras, sem exclamação)
1. Início: topo com logo branca + "10 ANOS" em vermelho; foto de capa P&B com cantoneiras; "FESTA DE 10 ANOS · 14.11.2026", "ENCONTRE SUAS FOTOS"; abas "Encontrar minhas fotos" / "Enviar fotos"; nome, WhatsApp, e-mail opcional, aceite desmarcado com link da privacidade, botão "TIRAR SELFIE", link "Prefere ver todas as fotos da festa?".
2. Selfie: câmera frontal, contorno oval tracejado, cantoneiras, dicas, botão de captura vermelho, "Enviar da galeria". A selfie fica só na memória e é descartada após a busca.
3. Buscando: ícone, "PROCURANDO VOCÊ", barra de progresso, aviso de que a selfie é apagada.
4. Resultado: "ENCONTRAMOS N FOTOS SUAS", seletor Coloridas / Preto e branco (P&B na miniatura por filtro de tela; o arquivo final vem na Fase 4), grade, "BAIXAR TODAS (N)" (desabilitado até a Fase 4), "Faltou alguma? Tente outra selfie".
5. Foto aberta: navegação "1 de N", seletores Formato e Cor já visíveis; prévia simples até a Fase 4.
6. Nenhuma foto: "AINDA NÃO ENCONTRAMOS VOCÊ", dica, "TENTAR OUTRA SELFIE" e "VER TODAS AS FOTOS".
7. Galeria completa paginada (só aprovadas).
8. Enviar fotos: nome, WhatsApp, até 30 fotos com miniaturas e remover, "X de 30", JPEG/PNG/HEIC até 15 MB (HEIC convertido), aceite desmarcado, "ENVIAR X FOTOS".
9. Confirmação: "RECEBEMOS SUAS X FOTOS", "ENVIAR MAIS FOTOS", "Encontrar minhas fotos".
10. Página curta de privacidade própria.

Mensagens de limite (10 buscas / 3 envios por hora) e erros em texto claro.

## Detalhes técnicos
- Logos via lovable-assets (`logo-fortem-branco.svg`, `logo-fortem-preto.svg`), exibidos só por altura, sem alterar cor/proporção, com área de proteção.
- Rotas novas em `src/site/` (`/10anos/fotos`, `/10anos/fotos/privacidade`), sem mexer na galeria antiga `/10anos`.
- Consome `fotos-evento-publico` (busca, galeria, URLs assinadas) e `fotos-evento-envio` já publicados; nenhuma mudança de banco prevista.
- Turnstile conforme o plano aprovado, se já configurado; senão fica como pendência anotada.
- Regras puras (validação de formulário, contador de 30, paginação) com testes vitest; suíte completa + eslint nos arquivos alterados.
- Verificação no navegador em viewport de celular: formulário, câmera simulada, resultado vazio, galeria e envio.

Parar ao fim para validação; Fase 4 (molduras e downloads) só depois.
