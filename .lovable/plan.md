# Mapa Corporal Biomecânico — tema cinza claro escopado à Premium

## 1. Por que o card ficou de fora da conversão anterior

Confirmado. A conversão anterior trocou classes fixas apenas dentro de `src/components/avaliacoes-premium/`.
O card do mapa **não mora ali**: `PremiumBodyMap.tsx` é só um wrapper que renderiza
`src/components/student/assessment/funcionalV2/BodyMap.tsx` — arquivo compartilhado, fora do escopo da
primeira leva.

O card inteiro é escuro por duas razões:

- O container raiz é `<div className="bodymap-surface rounded-xl p-5 md:p-6">` (BodyMap.tsx:138).
  `.bodymap-surface` (index.css ~196) define `background: ... hsl(var(--bodymap-bg))` (`220 28% 7%`),
  `color: hsl(0 0% 95%)` e borda branca translúcida.
- Todo o conteúdo usa classes fixas de tema escuro:

| Área | Arquivo | Classes escuras |
|---|---|---|
| Cabeçalho + título + chip de risco | BodyMap.tsx | `text-white`, `text-white/40`, `text-white/50` |
| 5 anéis de score (ScoreRing) | BodyMap.tsx:47-77 | `stroke="hsl(0 0% 100% / 0.08)"`, `text-white`, `text-white/50`, `text-white/60` |
| Abas Qualidade/Assimetria/Risco + Ambos/Anterior/Posterior | BodyMap.tsx | `bg-white/5`, `border-white/5`, `bg-white/10`, `text-white/55` |
| Seletor de Camada + legenda | BodyMap.tsx | `text-white/55`, `text-white/60` |
| Barra de calibração (admin) | BodyMap.tsx | `border-white/5`, `bg-white/[0.03]` |
| Rótulos "Vista anterior/posterior" | BodyMapSVG.tsx:274 | `text-white/40` |
| Painel "Pontos de atenção" | RegionListPanel.tsx:85-121 | `border-white/5`, `bg-white/[0.02]`, `divide-white/5`, `text-white`, `text-white/50` |
| Nota de rodapé | BodyMap.tsx | `text-white/40` |

## 2. Viável clarear tudo de forma escopada? SIM

`BodyMap.tsx` é compartilhado com o formulário legado (`FuncionalV2Assessment`) e com o Portal do
Aluno (`FuncionalV2Viewer` em `PortalAssessments.tsx`), então **nenhum desses arquivos será editado**.

A conversão é feita 100% em CSS, escopada em `[data-bio-theme="light"] .bodymap-surface ...` no
`index.css`, sem tocar `:root`, `--bodymap-*` nem `--sev-*`. Como o wrapper `data-bio-theme="light"`
só existe em `AvaliacoesPremium.tsx`, o Portal e o formulário antigo ficam byte-idênticos no visual.

Novos tokens escopados (cinza claro, não branco puro):

```text
--bm-l-surface: 220 16% 93%   /* fundo do card */
--bm-l-panel:   220 18% 97%   /* abas, painel lateral, caixas */
--bm-l-line:    220 12% 82%   /* bordas e divisórias */
--bm-l-ink:     220 25% 16%   /* texto principal */
--bm-l-muted:   220 10% 42%   /* rótulos e secundários */
```

Overrides escopados a aplicar (todos dentro de `[data-bio-theme="light"]`):

- `.bodymap-surface` — fundo cinza claro liso (remove os gradientes radiais escuros), borda
  `--bm-l-line`, `color: --bm-l-ink`.
- Mapear as utilitárias fixas por seletor de classe escapada dentro do card:
  `.text-white`, `.text-white\/40`, `.text-white\/50`, `.text-white\/55`, `.text-white\/60`
  → tons de `--bm-l-ink` / `--bm-l-muted`;
  `.bg-white\/5`, `.bg-white\/10`, `.bg-white\/\[0\.02\]`, `.bg-white\/\[0\.03\]` → `--bm-l-panel`
  (com o estado ativo das abas um pouco mais escuro para manter o contraste de seleção);
  `.border-white\/5`, `.divide-white\/5` → `--bm-l-line`.
- Anéis de score: o trilho `stroke="hsl(0 0% 100% / 0.08)"` é inline no SVG — sobrescrito por
  `[data-bio-theme="light"] .bodymap-surface svg circle[fill="none"]:first-of-type { stroke: hsl(var(--bm-l-line)) }`.
- Chip de risco, legenda de severidade e percentuais continuam usando `--sev-*` (já legíveis em fundo
  claro); ajuste apenas da opacidade do fundo do chip para 0.18 se ficar lavado.

## 3. Caixas "Vista Anterior" / "Vista Posterior"

Os PNGs (`src/assets/bodymap/anatomy-front.png` / `anatomy-back.png`) são RGB sem alpha, com fundo
opaco ~`rgb(38,37,37)` embutido — a imagem em si não clareia por CSS. Em vez de preto puro:

- moldura cinza clara ao redor de cada SVG: contêiner com `background: --bm-l-panel`,
  `border: 1px solid --bm-l-line`, `rounded-xl`, padding interno pequeno;
- o SVG em si mantém cantos arredondados, ficando um retângulo escuro menor "emoldurado" em cinza
  claro, reduzindo a área escura percebida;
- rótulos "Vista anterior/posterior" passam a `--bm-l-muted`.

Isso é feito por CSS escopado sobre a estrutura existente (`.bodymap-surface svg[role="img"]` e o
`div` pai `.flex.flex-col.items-center`), sem editar `BodyMapSVG.tsx`.

## Escopo técnico da implementação

- **Editar apenas** `src/index.css` (um bloco novo no fim da seção Premium) e, se necessário,
  `src/components/avaliacoes-premium/PremiumBodyMap.tsx` (atenuar o glow radial escuro do wrapper).
- **Não editar**: `BodyMap.tsx`, `BodyMapSVG.tsx`, `RegionListPanel.tsx`, `anatomy/*`, tokens `:root`.
- Validação por screenshot em `/avaliacoes-premium` e em uma avaliação do Portal do Aluno para
  provar ausência de regressão.
