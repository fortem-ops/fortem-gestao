# Fotos da linha do tempo (10 anos) — aba na tela da equipe + slide no site

## O que muda para você
- Em "10 anos – Confirmações" surge uma segunda aba: **Confirmações** (como hoje) e **Fotos da história**.
- Na aba Fotos, cada ano (2016 a 2026) aparece em um bloco com: fotos atuais em miniatura, botão **Adicionar fotos** (várias de uma vez, JPG/PNG/WebP, até 10 MB cada), campo de descrição (para leitor de tela), setas para mudar a ordem e botão **Remover** (com confirmação).
- O que for salvo aparece na hora na página pública /10anos.
- No site, ano com **uma foto** continua igual. Ano com **duas ou mais** vira **slide**: arrastar para o lado (ou setas no computador), com pontinhos indicando qual foto está aparecendo. A altura fica fixa, então a página não cresce.
- As fotos já colocadas de 2016 e 2017 são migradas para o novo cadastro, mantendo ordem e descrições.

## Regras
- Só quem tem acesso de gestão à festa pode adicionar, ordenar ou remover fotos; o público só vê.
- Fotos ficam inteiras (sem corte): o slide ajusta à proporção da foto, com fundo escuro nas laterais se necessário.
- Anos sem foto continuam com "Foto em breve".
- Nada dos Planos 1 e 2, flags, contratos, cobranças ou PIX é tocado. O site não é publicado.

## Detalhes técnicos
- Nova tabela `festa_fotos` (id, ano text, url, caminho, alt, ordem, criado_por, created_at). RLS: SELECT público (anon) e INSERT/UPDATE/DELETE só para quem tem a permissão de gestão já usada em `festa_confirmacoes`. GRANTs adequados.
- Novo bucket público `festa-fotos` com políticas em `storage.objects`: leitura pública, escrita/remoção só gestão.
- Migração de dados: insere 2016 e 2017 com as URLs dos arquivos atuais; `festa10anos.ts` mantém os textos e deixa de definir `fotos` (fica como fallback se a tabela estiver vazia).
- `FestaConfirmacoes.tsx`: envolve o conteúdo atual em `Tabs`; novo componente `src/components/festa/FestaFotosAdmin.tsx` (upload, ordem, alt, remover; TanStack Query).
- `Festa10Anos.tsx`: busca `festa_fotos` agrupado por ano; com 2+ fotos usa o `Carousel` (embla) já existente, com arraste por toque, setas e indicadores acessíveis (aria-label "Foto X de Y").
- Rollback em `scripts/festa-fotos.rollback.sql`; teste do agrupamento/ordenação por ano.
- Verificação com Playwright a 393px e desktop: slide arrasta, sem rolagem lateral, fotos inteiras.
