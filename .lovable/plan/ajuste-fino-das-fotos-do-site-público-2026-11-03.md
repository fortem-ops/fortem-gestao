# Ajuste fino das fotos do site público

## O que você vai poder fazer
Nova tela na área da equipe: **Site > Fotos** (só admin). Ela lista as 15 fotos do site (topo da home e da experimental, equipe, estrutura, treinamento, avaliação). Para cada foto:

- **Enquadramento:** você arrasta a foto dentro da moldura até ficar como quer.
- **Zoom:** um controle deslizante de 100% a 200%.
- **Computador e celular separados:** uma chave alterna entre "Computador" e "Celular". A moldura da prévia tem o mesmo formato que a foto ocupa naquele tamanho de tela.
- **Trocar a foto:** envia JPG, PNG ou WebP de até 5 MB. A foto é reduzida automaticamente para no máximo 1920 px antes de ir para o site.
- **Restaurar:** volta ao enquadramento original ou à foto original.
- **Salvar:** a mudança aparece no site na hora para quem abrir a página.

Os cantos vermelhos, os textos alternativos e o resto do site continuam iguais.

## Como o site usa isso
- Sem ajuste salvo, cada foto aparece como hoje.
- Com ajuste salvo, o site aplica a posição e o zoom do celular em telas pequenas e os do computador nas grandes.
- A moldura não muda de tamanho, então a página não "pula" enquanto carrega.

## Detalhes técnicos
- Migração nova: tabela `site_fotos_ajuste` (chave da foto, `pos_x/pos_y/zoom` para desktop e mobile, `arquivo_path` opcional, largura/altura da foto trocada, `updated_by/at`). RLS: leitura pública só dessas colunas; escrita só admin ativo. Rollback em `scripts/`.
- Bucket público de leitura não é permitido no workspace: fotos trocadas vão para bucket `site-fotos`; se o público for bloqueado, uso uma função de leitura que devolve links de longa duração, com cache.
- `src/site/fotos.ts` continua como registro padrão; um hook novo (`useAjustesFotosSite`, cache do TanStack Query) mescla os ajustes. O componente de foto aplica `object-position` e `transform: scale()` com variáveis CSS por breakpoint, apenas dentro de `.site-publico`.
- Tela admin em `/equipe/site/fotos`, no menu do painel, com os componentes atuais do sistema (tema escuro).
- Testes: limites de posição (0–100) e zoom (1–2), e escolha do ajuste por tamanho de tela.

## Fora do escopo
Textos, rotas, rastreamento, outras páginas do sistema e as fotos da Festa/10 anos.
