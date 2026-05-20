
# Avaliações Premium — Central Biomecânica FORTEM

Novo módulo de **leitura, consolidação e inteligência visual** sobre as avaliações já existentes. Não altera os formulários atuais (FuncionalV2, Pollock, Kinology PDF). Única coleta nova: **Pliometria**. PDF premium fica para depois.

## Rota e navegação

- Nova rota: `/avaliacoes-premium/:alunoId?` (lista de alunos quando sem id; dashboard biomecânico quando com id).
- Menu lateral → grupo **Técnico** → novo item **"Avaliações Premium"** (ícone `Activity` ou `Gauge`). O atual "Avaliações" permanece intacto.
- Botão **"Abrir Dashboard Premium"** no topo de `/avaliacoes/:alunoId` para navegação cruzada.

## Estrutura da tela do aluno

```text
+-------------------+--------------------------------------------------+
| SIDEBAR ALUNO     | HEADER: Resumo Geral + Exportar (desabilitado)  |
| foto, nome, idade +--------------------------------------------------+
| sexo, alt/peso    | DASHBOARD CARDS (7 índices)                      |
| profissão, obj.   |  Índice Funcional · Mobilidade · Força           |
| mem. dominante    |  Flexibilidade · Composição · Assimetria · Risco |
| modalidade        +--------------------------------------------------+
| freq./volume      | MAPA CORPORAL PREMIUM (anterior/posterior)       |
| histórico lesões  |  Toggle camadas: Qualidade · Assimetria · Risco  |
| dores relatadas   |                  Mobilidade · Flex · Força       |
| última avaliação  |  Lista lateral de regiões com tooltip            |
| avaliador         +--------------------------------------------------+
|                   | TABS internas: Força · Composição · Pliometria   |
|                   |               Evolução · Recomendações           |
+-------------------+--------------------------------------------------+
```

## Fontes de dados (sem migração na Fase 1/2)

- `alunos` + `profiles` → sidebar
- `avaliacoes` (tipos: `funcional`, `composicao_corporal`, `forca`, `kinology`) → todas as métricas
- `avaliacao_funcional` → ADM (mobilidade/flexibilidade)
- `dados` JSONB de `avaliacoes` tipo `forca`/`kinology` → dinamometria (já gravado pelo parser Kinology)
- `dados` JSONB de `avaliacoes` tipo `composicao_corporal` → Pollock (% gordura, IMC, MM, MG, dobras)
- Hook novo `useAlunoAvaliacoesConsolidadas(alunoId)` agrega tudo e expõe `latest`, `history`, `scores`, `assimetrias`.

## Lógica de scores (cliente, reaproveitando `bodyMapLogic.ts`)

- **Mobilidade / Flexibilidade**: já calculados em `scoreMobilidade` / `scoreFlexibilidade`.
- **Força**: já existe `scoreForca` (Kinology).
- **Assimetria geral**: média ponderada de assimetrias por região.
- **Composição corporal**: novo `scoreComposicao` baseado em % gordura vs faixa Pollock (sexo/idade).
- **Risco de lesão**: combina assimetrias >20% + déficits de mobilidade críticos.
- **Índice Funcional FORTEM**: ponderação 25 mob + 20 flex + 25 força + 15 composição + 15 (1 - risco).

## Fase 1 — Núcleo visual premium

**Arquivos novos:**
```
src/pages/AvaliacoesPremium.tsx                     (rota)
src/components/avaliacoes-premium/
  PremiumLayout.tsx                                 (shell sidebar+main)
  AlunoSidebarCard.tsx                              (card aluno premium)
  DashboardScoreCard.tsx                            (card métrica c/ glow + barra animada)
  DashboardSummary.tsx                              (grid de 7 cards)
  PremiumBodyMap.tsx                                (wrapper do BodyMapSVG atual)
  bodyMapPremiumStyles.ts                           (filtros SVG: glow radial, halo, gradiente)
  useAlunoAvaliacoesConsolidadas.ts                 (hook agregador)
  scoringPremium.ts                                 (índice funcional, risco, composição)
```
**Reuso:** `funcionalV2/BodyMapSVG.tsx` + `bodyMapLogic.ts` + `useBodyMapGeometry.ts`.

**Evolução visual do BodyMap (sem mexer na geometria):**
- Camada `<defs>` com `feGaussianBlur` + `radialGradient` para halo por severidade.
- Tokens semânticos: `--bio-halo-good`, `--bio-halo-warn`, `--bio-halo-risk` (HSL no `index.css`).
- Animação de pulse suave em regiões "alto risco" via Framer Motion.
- Toggle Anterior/Posterior + 6 camadas (Qualidade · Assimetria · Risco · Mobilidade · Flex · Força).

## Fase 2 — Inteligência consolidada

**Arquivos novos:**
```
src/components/avaliacoes-premium/tabs/
  ForcaTab.tsx              (tabela + gráfico linha por exercício, ref. Kinology)
  ComposicaoTab.tsx         (radar + barras % gordura/MM/MG, mapa de dobras)
  EvolucaoTab.tsx           (timeline + linhas de evolução por índice)
  RecomendacoesTab.tsx      (cards automáticos por déficit)
recomendacoesEngine.ts      (regras: assimetria>20% → fortalecimento unilateral, etc.)
```
- Gráficos: `recharts` (já no projeto).
- Recomendações geradas client-side a partir dos scores; cada card mostra severidade, descrição, sugestão de protocolo.

## Fase 3 — Pliometria

**Migração** (única migração do projeto inteiro):
```sql
CREATE TABLE public.avaliacao_pliometria (
  id uuid PK,
  avaliacao_id uuid FK → avaliacoes(id) ON DELETE CASCADE UNIQUE,
  salto_vertical numeric,        -- cm
  salto_horizontal numeric,      -- cm
  rsi numeric,                   -- Reactive Strength Index
  tempo_contato numeric,         -- ms
  potencia numeric,              -- W
  stiffness numeric,             -- kN/m
  assimetria numeric,            -- %
  observacoes text,
  created_at timestamptz
);
```
- RLS: mesmo padrão de `avaliacao_funcional` (insert pelo avaliador ou coord/admin; select autenticado).
- Tipo `pliometria` já existe no check constraint de `avaliacoes`.
- **Form novo**: `src/components/avaliacoes-premium/PliometriaForm.tsx` (cria registro em `avaliacoes` tipo=pliometria + linha em `avaliacao_pliometria`).
- **Tab**: `PliometriaTab.tsx` lê último registro + histórico, com placeholders premium (radar, indicadores de potência) prontos para dados futuros.

## Design tokens (em `index.css`)

```css
--bio-halo-good:  142 76% 45%;
--bio-halo-warn:  38 92% 50%;
--bio-halo-risk:  0 84% 60%;
--bio-glow-fortem: 0 84% 55%;     /* FORTEM red */
--bio-surface:    222 18% 9%;     /* grafite */
--bio-glass:      222 18% 14% / 0.6;
```
- Classe utilitária `.bio-card` (vidro fosco + borda sutil + sombra interna).
- Classe `.bio-glow-{good|warn|risk}` para anéis dos cards.

## Responsividade

- Desktop: sidebar fixa 320px + main grid.
- Tablet: sidebar colapsa para drawer; cards em 2 colunas.
- Mobile: sidebar vira accordion no topo; BodyMap com pinch-zoom (via `react-zoom-pan-pinch`, ainda a adicionar) e toque nas regiões.

## Fora de escopo agora (próximas iterações)

- PDF Premium (Fase 4 — adiada por decisão).
- Wizard único de coleta substituindo formulários atuais.
- Edição/coleta dentro do módulo premium (exceto Pliometria).
- Reconstrução do SVG anatômico (continua o atual com camada premium por cima).

## Ordem de implementação

1. Tokens + rota + sidebar do aluno + dashboard de 7 cards.
2. PremiumBodyMap (halo/glow/animação) reaproveitando BodyMapSVG.
3. Hook consolidador + scoringPremium.
4. Tabs Força, Composição, Evolução, Recomendações.
5. Migração `avaliacao_pliometria` + form + tab.
