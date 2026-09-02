# Tela de Avaliações em modo escuro

Hoje a tela `Avaliações` (rota `/avaliacoes-premium`) está travada em tema claro: o wrapper da página usa `data-bio-theme="light"`, e todo o CSS escopado (`bio-shell`, `bio-card`, `bio-label`, `bio-heading`, `bodymap-surface`) só existe nessa variante clara. Por isso ela continua branca mesmo com o botão de tema em Escuro.

## O que muda

- A tela de Avaliações passa a ter uma versão escura (preta), alinhada ao restante do sistema.
- Ela acompanha o botão de tema do cabeçalho: em Escuro/Sistema-escuro fica preta, em Claro continua como está hoje.
- Nenhuma alteração de conteúdo, cálculo, layout ou dos modos Lançamento/Resultados.

## Detalhes técnicos

1. `src/index.css`: criar o bloco de tokens `[data-bio-theme="dark"]` espelhando os do tema claro, com superfícies escuras (base próxima de `220 28% 7%`, cards `220 18% 11%`), tinta clara (`--bio-ink`, `--bio-ink-muted`, `--bio-ink-faint`) e linhas sutis (`--bio-line`).
2. Generalizar as regras estruturais (`.bio-shell`, `.bio-card`, `.bio-card-hover`, `.bio-glow-*`, `.bio-label`, `.bio-heading`) para valer em qualquer `[data-bio-theme]`, mantendo só as diferenças de cor via tokens. As regras de `bodymap-surface` continuam restritas a `[data-bio-theme="light"]` — os componentes do mapa já são nativamente escuros, então no tema escuro basta não aplicar os overrides claros.
3. `src/pages/AvaliacoesPremium.tsx`: substituir o valor fixo por `data-bio-theme={resolvedTheme === "dark" ? "dark" : "light"}` usando `useTheme()` do `next-themes`.
4. Validar typecheck/build e conferir visualmente Lançamento e Resultados (mapa corporal, gráficos de percentil, roscas de assimetria) nos dois temas.

## Riscos

- Textos em componentes internos com cores fixas podem ficar com baixo contraste no escuro; ajustes pontuais serão feitos por token, sem cores hardcoded.
- Popovers/diálogos renderizados em portal seguem o tema global do app, o que é o comportamento desejado nesta abordagem.
