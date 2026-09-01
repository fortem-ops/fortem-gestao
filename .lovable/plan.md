# Página pública /planos — funil de 3 etapas

Migra o "Fortem Plan Builder" para dentro do Fortem Gestão como rota pública `/planos`, seguindo o mesmo padrão de `/corrida` (fora do AppLayout/RBAC, com `<Seo>` e JSON-LD). Sem banco, sem edge function, sem cupom, sem Tecnofit, sem etapa de Grupo de Corrida.

## Fluxo

```text
Frequência (1x / 2x / 3x "mais escolhido" / Livre)
   → Plano (START, START+, POWER, PRO, MAX)
      → Resumo (frequência + plano + valor mensal + toggle recorrência)
         → WhatsApp (51) 99151-9640 com mensagem pré-preenchida
```

## Regras de preço

Tabela mensal hardcoded (R$):

| Freq | START | START+ | POWER | PRO | MAX |
|---|---|---|---|---|---|
| 1x | 399 | 369 | 419 | 469 | 569 |
| 2x | 499 | 459 | 509 | 559 | 659 |
| 3x | 599 | 559 | 609 | 659 | 759 |
| Livre | 699 | 659 | 709 | 759 | 859 |

- START: preço já é recorrência mensal nativa — sem adicional, sem toggle.
- START+/POWER/PRO/MAX: preço da tabela é a fidelidade 12 meses; toggle opcional de recorrência mensal soma `RECORRENCIA_EXTRA = 30`.
- Etapa Frequência mostra "a partir de R$X,00" = menor preço da linha daquela frequência.
- Upsell "adicionar mais um treino semanal" mantido (mostra a diferença de valor ao subir de faixa).

## Arquivos a criar

1. `src/data/planosPricing.ts` — tipos (`FrequenciaPlano`, `PlanoId`), matriz de preços, `RECORRENCIA_EXTRA = 30`, benefícios de cada plano, helpers `precoDe(freq, plano)`, `precoMinimoDaFrequencia(freq)`, `precoFinal(freq, plano, recorrencia)`, `PROXIMA_FREQUENCIA` para o upsell.
2. `src/pages/Planos.tsx` — página pública: `<Seo>` (title/description/path `/planos`) + JSON-LD `Service`/`Offer`, estado do funil (etapa, frequência, plano, toggle recorrência), composição das seções e botão de WhatsApp.
3. `src/components/planos/HeroSection.tsx` — topo com logo/headline e CTA que rola até o funil.
4. `src/components/planos/ProgressBar.tsx` — indicador das 3 etapas (Frequência, Plano, Resumo), permite voltar a etapas concluídas.
5. `src/components/planos/StepFrequency.tsx` — 4 cards de frequência com "a partir de R$X,00", selo "mais escolhido" no 3x e bloco de upsell de treino semanal extra.
6. `src/components/planos/StepPlans.tsx` — 5 cards (START, START+, POWER, PRO, MAX) com benefícios e preço mensal da frequência escolhida.
7. `src/components/planos/StepSummary.tsx` — resumo (frequência, plano, valor mensal), toggle de recorrência (+R$30, oculto no START) e botão "COMEÇAR A TREINAR AGORA".
8. `src/components/planos/WhatsAppCta.tsx` — monta a URL `https://wa.me/5551991519640?text=` com `encodeURIComponent` da mensagem: "Olá! Montei meu plano no site da Fortem: [Frequência] – [Plano] – R$[valor]/mês[ + recorrência mensal]. Gostaria de finalizar minha matrícula."

## Arquivos a alterar

9. `src/App.tsx` — `lazyWithReload` de `./pages/Planos` e `<Route path="/planos">` logo abaixo de `/corrida`, no mesmo grupo público (fora de `ProtectedRoute`/`AppLayout`).
10. `public/sitemap.xml` — nova entrada `https://soufortem.com.br/planos` (priority 1.0, changefreq weekly).
11. `scripts/generate-sitemap.ts` — incluir `/planos` na lista de rotas públicas para o sitemap não regredir na próxima geração.

## Fora de escopo

- Nada em `src/components/corrida/` é lido, reaproveitado ou alterado.
- Sem cupom de desconto, sem checkout Tecnofit, sem etapa/menção de Grupo de Corrida, matrícula ou camiseta.
- Sem migração de banco e sem edge function.

## Pendência de conteúdo

Os textos de benefícios de cada um dos 5 planos: se não forem enviados antes da implementação, entram como placeholders estruturados em `planosPricing.ts`, prontos para substituição em um único arquivo.
