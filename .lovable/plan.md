# Site público FORTEM dentro do sistema (soufortem.com.br)

## O que existe hoje

| Rota | Hoje | Situação |
|---|---|---|
| `/` | Painel interno da equipe (Dashboard), só para equipe logada | Vai para `/equipe` na etapa 5 |
| `/login` | Login da equipe | Reaproveitar sem mudar |
| `/planos` | Página pública 2027 com visual claro (Archivo, #E73C3E) | Reaproveitar, só ligar cabeçalho/rodapé |
| `/store` (+ carrinho, produto) | Loja pública | Reaproveitar |
| `/corrida` | Inscrição pública, já envia conversão Google Ads | Reaproveitar |
| `/10anos` | Página da festa | Existe, mantém |
| `/portal` | App do aluno, login próprio | Sem mudança |
| `/privacidade` | Política de privacidade | Completar na etapa 7 |
| `/experimental`, `/treinamento`, `/nutricao`, `/reabilitacao`, `/avaliacao` | Não existem | Criar |
| `/assinar-experimental` | Fluxo interno | Não alterar |

Rastreamento já instalado em todas as páginas (inclusive sistema interno e portal do aluno), sem consentimento: Google Ads `AW-797888979` e Meta Pixel `1920832044845271` — são os da campanha e serão reaproveitados, sem duplicar. Há também `sitemap.xml`, `robots.txt` e service worker (`sw.js`).

## Decisões aprovadas

- **Raiz**: `/` = home pública. Painel da equipe passa para `/equipe`, protegido por login; login, permissões e telas iguais, só muda o endereço. Os ~7 pontos que levam a `/` após login passam a levar a `/equipe`. Link "Portal da equipe" do site → `/equipe`. Exceção autorizada só para o endereço, com teste de login da equipe e do aluno. Service worker tratado na mesma etapa.
- **/experimental**: somente WhatsApp (wa.me/555135199451, mensagem pré-preenchida por origem/botão). Sem formulário, nada gravado no banco.
- **Conteúdo**: textos do mock-up aprovado; o que faltar vem de fortem.com.vc. Sem foto: bloco placeholder escuro com cantos vermelhos, trocado quando você enviar.
- **Banner LGPD**: para todos os visitantes do site público.
- **Ordem**: etapas 1–4 em `/site/...`, conferência com você, depois a troca da raiz. Uma etapa por aprovação.

## Isolamento do tema

- Layout público próprio com contêiner `.site-publico`; cores e Archivo só dentro dele, nunca no tema global.
- Páginas públicas carregadas sob demanda; o sistema não baixa nada do site.
- Componentes do site em pasta própria; componentes compartilhados do sistema não são alterados.

## Etapas

| # | Etapa | Créditos |
|---|---|---|
| 1 | Base do site em `/site` | 8–12 |
| 2 | Home completa em `/site` | 10–15 |
| 3 | `/site/treinamento`, `/nutricao`, `/reabilitacao`, `/avaliacao` | 10–15 |
| 4 | `/site/experimental` (só WhatsApp, sem menu que distraia) | 6–10 |
| — | Conferência com você | — |
| 5 | Troca: site em `/`, painel em `/equipe`, pós-login, service worker, testes de login equipe e aluno | 8–12 |
| 6 | Cabeçalho/rodapé novos em `/planos`, `/store`, `/corrida` sem mexer na compra | 4–6 |
| 7 | Banner LGPD + Consent Mode v2, tags só no site público, gclid/UTMs, eventos WhatsApp e compra de plano, política de privacidade | 10–15 |
| 8 | SEO (títulos, JSON-LD LocalBusiness, sitemap/robots) e desempenho no celular | 6–10 |
| 9 | Redirecionamentos de fortem.com.vc (no Wix/registro) | 1–3 |

### Etapa 1 exata (a executar após aprovação)

- Layout público isolado (`.site-publico`, fonte Archivo carregada só nele, cores preto/vermelho/cinza do manual).
- Cabeçalho (logo, menu: Treinamento, Nutrição, Reabilitação, Avaliação, Planos, Store, Corrida, Portal do aluno, Portal da equipe → `/equipe`; menu móvel).
- Rodapé (Av. Independência, 358, Porto Alegre/RS, WhatsApp, redes, privacidade).
- Botão flutuante de WhatsApp com mensagem por página.
- Componentes vazios prontos: placeholder de foto, depoimentos, horários, chamada para ação.
- Rotas provisórias `/site`, `/site/treinamento`, `/site/nutricao`, `/site/reabilitacao`, `/site/avaliacao`, `/site/experimental` com páginas esqueleto.
- Nada no `/`, login, portal, banco, tags ou service worker. Verificação: compilação e capturas de tela em celular e desktop, conferindo que o painel e o portal continuam com o tema escuro.

## Riscos

- Troca do painel para `/equipe`: favoritos/atalhos da equipe abrirão o site; mitigação com botão "Ir para o painel" quando logado.
- Service worker servindo versão antiga após a troca.
- Tags atuais rodam no sistema interno e no portal do aluno; na etapa 7 ficam só no site, mantendo a conversão da corrida (testar).
- `/planos` tem regras próprias; etapa 6 só troca a moldura.
- Site carregado no navegador: o Google indexa, mas mais devagar; títulos por página ajudam.

## Pendência

- Mock-up aprovado: preciso que você o envie (imagem ou textos) antes da etapa 2.
