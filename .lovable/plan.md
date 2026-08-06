# Relatório: tema escuro da tela Avaliações Premium

Investigação somente leitura. Nenhum arquivo do projeto foi alterado.

## 1. Como o tema escuro é aplicado hoje

Não há theme provider nem classe `dark` envolvida. Confirmado: zero ocorrências de `dark:` nos componentes de `src/components/avaliacoes-premium/`.

O escuro vem de duas fontes, ambas hardcoded:

- Utilitários CSS globais definidos em `src/index.css` (bloco `@layer utilities`, seção "Avaliações Premium"), linhas ~227-256:
  - `.bio-shell` — fundo `hsl(220 28% 6%)` com gradientes radiais, texto `hsl(0 0% 95%)`
  - `.bio-card` / `.bio-card-hover` — gradiente escuro + borda branca translúcida + blur
  - `.bio-glow-good` / `-warn` / `-risk` / `-fortem`
  - `.bio-label` (texto `hsl(0 0% 100% / 0.45)`) e `.bio-heading` (texto `hsl(0 0% 98%)`)
  - `.bio-bar-fill`
  Nada disso está no `tailwind.config.ts` — é CSS puro no `index.css`.
- Classes Tailwind fixas de cor nos componentes: `text-white/*`, `bg-white/*`, `border-white/*`, além de tons diretos como `text-rose-300`, `text-emerald-300`, `text-amber-300`.

Também são usados os tokens `--sev-*` e `--bodymap-*` (definidos no `:root` do `index.css`), compartilhados com o Body Map da Avaliação Funcional v2 — cuidado ao mexer neles, pois afetam outra tela.

## 2. O restante do painel administrativo

O painel Técnico é **claro por padrão**. O `:root` do `index.css` define `--background: 220 14% 92%` (cinza claro), `--card: 0 0% 100%` (branco), `--foreground` escuro. Não existe alternância de tema.

Ou seja: **Avaliações Premium é hoje uma ilha escura dentro de um painel claro.** Ela cria esse escuro via `.bio-shell -m-6 p-6` na raiz de `AvaliacoesPremium.tsx`, que "estoura" o padding do layout e pinta a área inteira.

O único outro escuro isolado é o Portal do Aluno, via `[data-portal="true"]` (mesmo `index.css`, linhas 120-180) — escopo totalmente separado.

## 3. A tela é usada no app do aluno?

**Não.** Confirmado:

- `AvaliacoesPremium.tsx` só é referenciada em `src/App.tsx` (rotas `/avaliacoes-premium` e `/avaliacoes-premium/:alunoId`, dentro das rotas protegidas do painel) e no menu `AppSidebar.tsx`. Também há um botão de navegação em `StudentAssessments.tsx` (perfil do aluno, painel admin).
- Nenhuma rota do portal (`/portal/*`) renderiza essa página.
- O portal reaproveita apenas **arquivos não visuais** da pasta: `PortalAssessments.tsx` importa o hook de dados `useAlunoAvaliacoesConsolidadas` — nenhum estilo envolvido.
- Um componente visual da pasta é compartilhado fora dela: `AssessmentDateField.tsx`, importado por `src/components/student/assessment/AssessmentForm.tsx` (painel admin, não portal). Ele tem 3 ocorrências de `text-white/bg-white/border-white` — precisa de atenção específica para não quebrar o formulário legado.

Conclusão: mudar a paleta dessa tela **não toca o app do aluno**.

## 4. Tamanho da mudança

15 arquivos `.tsx` na pasta. Ocorrências de utilitários `bio-*`:

| Arquivo | ocorrências `bio-*` | cores fixas white |
|---|---|---|
| pages/AvaliacoesPremium.tsx | 6 | — |
| AlunoSidebarCard.tsx | 6 | 11 |
| DashboardScoreCard.tsx | 6 | 5 |
| PremiumBodyMap.tsx | 3 | 1 |
| PremiumKinologyImport.tsx | 2 | 1 |
| AssessmentDateField.tsx | 0 | 3 (compartilhado com AssessmentForm) |
| tabs/ComposicaoTab.tsx | 13 | 14 |
| tabs/PliometriaTab.tsx | 8 | 12 |
| tabs/ForcaTab.tsx | 7 | 7 |
| tabs/MobilidadeTab.tsx | 6 | 21 |
| tabs/ComparativoTab.tsx | 5 | 13 |
| tabs/EvolucaoTab.tsx | 5 | 5 |
| tabs/CompareTable.tsx | 4 | 8 |
| tabs/RecomendacoesTab.tsx | 3 | 5 |
| tabs/ComparacoesSalvas.tsx | 2 | 6 |
| tabs/SalvarComparacaoDialog.tsx | 0 | 1 |
| DashboardSummary.tsx | (usa DashboardScoreCard) | — |

Totais na pasta: **139 ocorrências de cores fixas** (92 `text-white*`, 29 `border-white*`, 18 `bg-white*`) e ~76 usos de classes `bio-*`, espalhados por 16 arquivos.

## Estratégia recomendada (quando for implementar)

A boa notícia: como quase tudo passa pelos utilitários `bio-*`, a maior parte da conversão pode ser feita **em um único ponto**.

1. Transformar os utilitários `bio-*` do `index.css` em variantes claras usando variáveis CSS próprias (`--bio-surface`, `--bio-ink`, `--bio-ink-muted`, `--bio-line`), escopadas por um seletor da tela (ex.: `[data-bio-theme="light"]`) para não afetar nada mais.
2. Substituir as cores fixas `text-white/*`, `bg-white/*`, `border-white/*` pelos novos tokens nos 15 arquivos — esse é o trabalho braçal, mas é mecânico.
3. Ajustar as cores de destaque (`text-rose-300`, `emerald-300`, `amber-300`) para tons -600/-700, que têm contraste adequado em fundo claro.
4. Tratar `AssessmentDateField.tsx` à parte, já que também é usado pelo formulário legado.
5. Não alterar `--sev-*` nem `--bodymap-*` no `:root`: são compartilhados com o Body Map da Avaliação Funcional v2. Se o Body Map precisar clarear, criar overrides escopados.

Estimativa: 1 edição no CSS global + 15 arquivos de componente.
