# Site público FORTEM dentro do sistema (soufortem.com.br)

## O que existe hoje

| Rota | Hoje | Situação |
|---|---|---|
| `/` | Painel interno da equipe (Dashboard), só para equipe logada | **Conflito principal** |
| `/login` | Login da equipe | Reaproveitar sem mudar |
| `/planos` | Página pública 2027 com visual claro (Archivo, #E73C3E) | Reaproveitar, só ligar no cabeçalho/rodapé novos |
| `/store` (+ carrinho, produto) | Loja pública | Reaproveitar |
| `/corrida` | Inscrição pública da corrida, já envia conversão Google Ads | Reaproveitar |
| `/10anos` | Página da festa | **Existe, mantém** |
| `/portal` | Leva para `/portal/home` (app do aluno, com login próprio) | Reaproveitar sem mudar |
| `/privacidade` | Política de privacidade | Reaproveitar e completar (rastreamento) |
| `/experimental`, `/treinamento`, `/nutricao`, `/reabilitacao`, `/avaliacao`, `/equipe` | Não existem | Criar |
| `/assinar-experimental` | Fluxo interno protegido | Não confundir com `/experimental` |

Rastreamento já instalado em **todas** as páginas (inclusive no sistema interno): Google Ads `AW-797888979` e Meta Pixel `1920832044845271`, carregando **sem consentimento**. Também há `sitemap.xml`, `robots.txt` e um service worker (`sw.js`).

## Decisão-chave: o que fazer com o painel em `/`

Recomendo: `/` vira a home pública; o painel da equipe muda para `/app` (ou `/painel`). `/equipe` mostra só a tela de acesso e, se a pessoa já estiver logada, leva ao painel. Todos os pontos que hoje mandam para `/` depois do login (cerca de 7 no código) passam a apontar para o painel.
- Risco: favoritos antigos e atalhos do celular da equipe abrem a home pública. Mitigação: equipe logada que abre `/` vê um botão "Ir para o painel" no cabeçalho (sem redirecionar automaticamente, para não atrapalhar o anúncio).
- Isso mexe em rotas internas, mas **só no endereço**: login, permissões e telas continuam iguais. Preciso da sua aprovação explícita para essa exceção à regra.

## Isolamento do tema

- Layout público próprio (`PublicLayout`) com tudo dentro de um contêiner com classe `.site-publico`; cores e fonte Archivo definidas só dentro dessa classe, nunca no `:root`.
- Páginas públicas carregadas sob demanda: quem usa o sistema não baixa nada do site, e vice-versa.
- Fonte Archivo carregada só pelo layout público.
- Componentes novos ficam em pasta própria; nada de alterar os componentes compartilhados do sistema (botões, cards) — usamos variações locais.

## Componentes reaproveitáveis (novos, usados em todas as páginas públicas)

Cabeçalho, rodapé (endereço, mapa, redes), botão flutuante de WhatsApp (555135199451), bloco de depoimentos, bloco de horários, bloco de chamada para ação. `/planos`, `/store` e `/corrida` recebem só o cabeçalho/rodapé, sem mexer no fluxo de compra.

## Etapas (aprovar uma por vez)

| # | Etapa | Créditos estimados |
|---|---|---|
| 1 | Base: layout público isolado, cabeçalho, rodapé, WhatsApp, fontes; páginas vazias de `/treinamento` etc. em endereço provisório (`/site/...`) para conferir sem afetar nada | 8–12 |
| 2 | Home completa (seções, depoimentos, horários, fotos leves) ainda em `/site` | 10–15 |
| 3 | Páginas de serviço: treinamento, nutrição, reabilitação, avaliação | 10–15 |
| 4 | `/experimental` (campanha: texto direto, formulário/WhatsApp, sem menu que distraia) | 6–10 |
| 5 | Troca de endereço: home em `/`, painel em `/app`, `/equipe`, ajustes de pós-login; testar login da equipe e do aluno | 8–12 |
| 6 | Encaixar `/planos`, `/store`, `/corrida` no cabeçalho/rodapé novos | 4–6 |
| 7 | Rastreamento + banner LGPD (Consent Mode v2): tirar tags do `index.html`, carregar só nas páginas públicas após a regra de consentimento, capturar gclid/UTMs, eventos de clique no WhatsApp e compra de plano; atualizar política de privacidade. Você passa os IDs/rótulos aqui | 10–15 |
| 8 | SEO e desempenho: título/descrição por página, JSON-LD LocalBusiness, sitemap/robots, imagens lazy, teste no celular | 6–10 |
| 9 | Redirecionamentos de fortem.com.vc (feitos no Wix/registro do domínio enquanto ativo) | 1–3 |

Total aproximado: 63–98 créditos. Estimativas, podem variar com revisões.

## Riscos

- **Painel em `/`** (acima) — maior risco; isolado na etapa 5, com teste de login.
- **Service worker** pode servir versão antiga após a troca; verificar na etapa 5.
- **Tags atuais sem consentimento** rodam também no sistema interno e no portal do aluno (dados de alunos). Na etapa 7 elas ficam restritas às páginas públicas; a conversão da corrida precisa continuar funcionando (testar).
- Duplicidade: não instalar uma segunda tag Google; reusar `AW-797888979` se for a mesma conta.
- SEO: o site é carregado no navegador; Google indexa, mas mais devagar que um site estático. Aceitável; os títulos por página ajudam.
- `/planos` tem regras próprias (catálogo 2027, prévia admin) — etapa 6 só troca moldura.

## Dúvidas

1. Aceita o painel da equipe mudar para `/app` (ou prefere outro nome)?
2. Os textos/fotos do site antigo: copio de fortem.com.vc ou você manda novos?
3. `/experimental`: o aluno marca a aula por WhatsApp, por formulário que vira Lead no sistema, ou ambos? (formulário criaria dados no banco — exigiria sua aprovação)
4. A conta Google Ads `AW-797888979` e o Meta Pixel continuam sendo os da campanha?
5. Banner só para visitantes de regiões que exigem consentimento, ou para todos (o Brasil/LGPD recomenda mostrar a todos)?
