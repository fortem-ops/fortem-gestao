# /10anos — ajustes no celular (abaixo de 768px)

Mudanças só no celular. Computador, conteúdo, fotos, curtidas/comentários, áudio em sequência, avanço automático e painel ficam iguais. Nada será publicado.

## 1. Player da Introdução
- Sai o player cinza do navegador (com o menu de baixar). Entra um cartão de uma linha: fundo #1a1b1b, borda #4a4b4b, largura dos botões.
- Botão quadrado 48x48 vermelho #e73c3e com ícone #0e0e0e (play/pausa), "OUÇA A INTRODUÇÃO" (11px, bold, espaçado), barra de 4px (trilho #4a4b4b, preenchimento #e73c3e), tempo "0:00 / 1:48" à direita.
- Áudio escondido com carregamento só ao tocar; sem download; botão com aria-label ("Tocar introdução"/"Pausar introdução") e foco visível.
- Fica entre a frase "Dez anos de movimento…" e os botões, com espaços menores para "Confirmar presença" aparecer na primeira tela.
- Se a introdução tocar, a narração dos capítulos pausa (e vice-versa), para não tocarem juntas.

## 2. Mini-player "Ouvir a história" (fixo embaixo)
- Cerca de 68px: linha de progresso de 3px no topo, botão 44x44 vermelho play/pausa, duas linhas ("OUVIR A HISTÓRIA" 11px bold; "Capítulo N · ANO" 12px #b1b3b3) e tempo "0:32 / 1:24" à direita. Fundo #0e0e0e, borda superior #4a4b4b.
- Parado: o play começa do capítulo aberto e segue em sequência (avanço automático igual a hoje). A legenda mostra o capítulo aberto.
- Botão do capítulo: tocando → aviso "TOCANDO AGORA · 1:24" com 3 barrinhas animadas (sem "Parar"; elas param se a pessoa pedir menos movimento no aparelho). Parado → "Ouvir capítulo · 1:24", com a duração lida ao tocar ou registrada no painel. Enquanto a duração não é conhecida, mostra só "Ouvir capítulo". Sai o "min de leitura" no celular.
- Espaço embaixo ajustado para os botões Anterior/Próximo não ficarem cobertos.

## 3. Cabeçalho e trilha mais finos
- Cabeçalho com 52px: logo de 22px e "CONFIRMAR PRESENÇA" compacto (10px, altura 44px).
- Trilha com 76px no total (rótulos + pontos + anos), presa logo abaixo do cabeçalho (52px).

## 4. Corte do ano
- Ao trocar de capítulo, a rolagem desconta cabeçalho e trilha (52 + 76 + folga de 16px), medidos na hora. Assim "CAPÍTULO N" e o ano aparecem inteiros logo abaixo da trilha.

## 5. Versão clara no miolo dos capítulos (celular)
- Bloco dos capítulos: fundo #f4f2ee, texto #0e0e0e, texto secundário #4a4b4b, ano grande #e73c3e, barra sob o ano #0e0e0e, linha de 2px #0e0e0e acima dos números, números vermelhos pequenos #c92d2f.
- "Próximo": fundo #0e0e0e e texto branco. "Anterior": contorno #4a4b4b e texto #0e0e0e. "Fotos em breve", divisores e bordas: #e4e1db / #cfccc5.
- Cartão das fotos com fundo branco e bordas #cfccc5, curtir/comentar em #0e0e0e/#4a4b4b. Curtido continua vermelho. Vou conferir isso em print do celular.
- Cabeçalho, trilha (ponto ativo vermelho com halo, inativos #b1b3b3) e mini-player continuam escuros.
- Computador: recomendo levar a versão clara para lá também, porque textos longos se leem melhor em fundo claro e as duas versões ficam iguais. Mas não vou mexer no computador agora. Fica para você aprovar depois.

## 6. Fontes no celular
- Data 44px; selo "10" com caixa de 64px e número de 38px; "FORTEM · 10 ANOS" 22px; frase de apoio 16px.
- Ano do capítulo 56px; "CAPÍTULO N" 11px; título 20px com altura de linha 1.25.
- Números de destaque 26px, legenda 13px.
- Texto corrido 16px com altura de linha 1.6 (inclusive o 1º parágrafo e o "Continuar lendo"; também a abertura da seção).
- Botões 12–13px bold espaçados, altura mínima 48px. Rótulos pequenos (TRAJETÓRIA, 1 DE 12, FOTOS DE…) 10–11px.
- "Narração do Nícolas · 12 capítulos" deixa de aparecer no mini-player do celular, então não quebra mais.

## Detalhes técnicos
- Novo `src/components/festa/PlayerIntroducao.tsx` (audio oculto + estado de tempo/progresso) e `MiniPlayerHistoria` no mesmo arquivo da página ou em `components/festa/`. Usa `timeupdate`/`loadedmetadata` do `audioRef` existente. A duração por capítulo fica em cache em memória (`duracoes[ano]`), com prioridade para `duracao_segundos` do painel.
- Cores novas como tokens em `index.css` (`--festa-papel`, `--festa-tinta`, `--festa-tinta-2`, `--festa-vermelho-texto`, `--festa-divisor`) e classes utilitárias `festa-claro`. Escopo: só no contêiner dos capítulos do celular.
- Tamanhos usam prefixos base (celular) + `md:` para manter os valores atuais do computador. O ramo de computador não muda.
- `TrilhaAnos`: `top-[52px]`, altura total 76px. Rolagem com `window.scrollTo` com offset calculado, em vez de `scroll-mt-48`.
- Testes em `src/test/festaHistoria.test.tsx`: trocar a expectativa de "Parar" pelo aviso "Tocando agora". Novos testes: o player da introdução não usa `controls` e tem `preload="none"`; o botão do capítulo mostra a duração quando conhecida. Rodar `bunx vitest run src/test/festaHistoria.test.tsx`, e depois conferir com Playwright em 390x844 (primeira tela, troca de capítulo sem cortar o ano, contraste das fotos).
