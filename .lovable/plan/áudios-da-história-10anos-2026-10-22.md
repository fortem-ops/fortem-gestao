# Áudios da história — /10anos

O arquivo enviado tem os 13 áudios (introducao + 2016 a 2027, m4a, 31 MB no total).

## O que muda
1. Salvar os 13 arquivos em `public/audio/10anos/` com os nomes `introducao.m4a`, `2016.m4a` … `2027.m4a`, como você pediu (ficam no próprio site, não no armazenamento externo).
2. Em cada capítulo de 2016 a 2027 (`src/config/festaHistoria.ts`), preencher `audio: "/audio/10anos/ANO.m4a"`. Assim aparece o player discreto que já existe ("Ouvir capítulo") em cada marco, e "Ouvir a história" toca tudo em sequência e destaca o ano na trilha.
3. Introdução: um player pequeno no topo da página (abaixo do título de abertura), no mesmo estilo dos botões de ouvir, com `preload="none"`.
4. Garantir `preload="none"` em todos os players: nada é baixado até alguém tocar.
5. Áudio enviado depois pelo painel continua tendo prioridade sobre o arquivo fixo do ano (regra que já existe).
6. "cerca de N min": como os arquivos fixos não têm duração cadastrada, o texto é calculado lendo só a duração (metadados) quando a pessoa tocar; antes disso fica escondido, sem baixar áudio.

## O que não muda
Visual da página, fotos, curtidas, comentários, trilha, desktop/mobile, painel. Nada publicado.

## Detalhes técnicos
- Extrair o zip em /tmp e copiar só os .m4a para `public/audio/10anos/`.
- Atualizar o comentário/README de caminho (`/audio/festa/*.mp3` → `/audio/10anos/*.m4a`).
- Ajustar o teste "sem áudio não há botões" para usar capítulos sem áudio explicitamente; adicionar teste: todo capítulo 2016–2027 aponta para `/audio/10anos/ANO.m4a`.
