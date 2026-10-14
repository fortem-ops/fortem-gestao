# Trocar as fotos dos profissionais em /planos (passo 2 "Turbine")

## O que muda

As três fotos provisórias geradas por IA do passo 2 de `/planos` passam a ser as fotos reais
enviadas pelo dono (as imagens dos stories de 10 anos), usadas como estão (sem alterar cores):

| Área | Profissional | Foto enviada | Camiseta |
| --- | --- | --- | --- |
| Nutrição | Jéssica Elkfury | `5bb24f2f…webp` (igual a `INSTAGRAM_-_STORIES_1.png`) | FORTEM bege/areia (mantida como está) |
| Fisioterapia | Júlia Assis Brasil | `INSTAGRAM_-_STORIES_2.png` | FORTEM preta |
| Grupo de corrida | Yasmim Ávila | `Gemini_Generated_Image_…jfif` | Regata FORTEM vermelha |

Escopo: só `/planos` (passo 2). Nenhuma outra tela é tocada.

## Como fazer

1. **Preparar as imagens** (script Python/PIL, sem IA — as fotos reais não são refeitas nem editadas):
   - Recortar cada foto 1080×1920 para 4:5 (1080×1350), com o corte posicionado para manter
     o rosto/tema central (corte vertical com leve viés para cima, conferido visualmente).
   - Converter para JPEG (~qualidade 85) e salvar sobre os arquivos existentes, mantendo os
     nomes atuais: `src/assets/planos2027/nutricao.jpg`, `reabilitacao.jpg`, `corrida.jpg`.
   - Manter as fotos originais enviadas intactas (cópia em `/tmp` durante o processo).
2. **Código** — único ajuste em `src/pages/PlanosPublico2027.tsx`:
   - Alt do `<img>` deixa de dizer "foto provisória": passa a `{p.nome}` (ex. "Jéssica Elkfury").
   - Nenhuma outra mudança de código (os imports continuam os mesmos, pois os nomes dos arquivos
     são mantidos).
3. **Verificação**:
   - Abrir `/planos` no computador e no celular via Playwright, avançar até o passo 2 e conferir
     as três fotos (recorte, rosto centralizado, sem cortes ruins).
   - Conferir o build (`/tmp/observability/build-errors.log`) e rodar `bunx vitest run`
     (regressão da tela; não deve haver teste dependente das fotos — conferir antes).

## O que não muda

- Nenhuma cobrança, chave, cron, flag, função publicada ou migração.
- Público continua vendendo só o plano; passo 3 segue com o aviso de consultas via WhatsApp.
- Balcão, propostas existentes e telas fora do escopo intactos.

## Observações

- As fotos ficam no repositório como arquivos comuns (padrão atual do projeto); sem Assets/CDN.
- **Publish**: essa mudança é só de front-end; entra no ar quando o dono clicar em Publish
  (acumula com as correções pendentes: página sem consultas, "Alterar"/"Começar nova simulação").
