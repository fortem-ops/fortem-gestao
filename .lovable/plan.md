## Investigação (A) — Onde fica a entrada de Pliometria hoje

Não existe dialog/componente dedicado. O formulário de lançamento vive **dentro do próprio `PliometriaTab.tsx`** (mesmo arquivo que lista o histórico): tem os 7 inputs (salto vertical, salto horizontal, RSI, tempo de contato, potência, stiffness, assimetria), textarea de observações e botão "Salvar Pliometria" que faz `insert` em `avaliacoes` (tipo `pliometria`) e um best-effort em `avaliacao_pliometria`.

Existe também `src/components/student/assessment/DynamicAssessment.tsx`, usado pela tela legada `Avaliacoes.tsx`, mas o fluxo premium não passa por ele. Vamos tratar apenas o formulário do `PliometriaTab`.

---

## Plano — 3 blocos independentes

Recomendo executar **na ordem: Bloco 1 → Bloco 2 → Bloco 3**. Cada um é entregável isolado e pode ser aprovado/testado em fases separadas.

### Bloco 1 — Data retroativa nos 4 fluxos de entrada

**Objetivo:** adicionar um date picker (default = hoje, `max=hoje`, sem hora) em cada formulário, e passar essa data para o `insert` em `avaliacoes.data` (hoje o campo cai no default `CURRENT_DATE`).

**Componente compartilhado novo:**
- `src/components/avaliacoes-premium/AssessmentDateField.tsx` — wrapper do shadcn Popover+Calendar (padrão do projeto, com `pointer-events-auto`), label "Data da avaliação", `disabled={{ after: new Date() }}`, default hoje. Retorna string `YYYY-MM-DD`.

**Arquivos alterados:**
- `src/components/avaliacoes-premium/tabs/PliometriaTab.tsx` — adicionar estado `data` + campo, incluir no `insert` de `avaliacoes` e no mirror `avaliacao_pliometria`.
- `src/components/avaliacoes-premium/tabs/MobilidadeTab.tsx` — adicionar campo; passar `data` tanto no path de UPDATE (não altera `data` da linha existente — decisão: sobrescrever se usuário mudou? ver "a decidir") quanto no INSERT de nova linha.
- `src/components/student/assessment/AssessmentForm.tsx` (Composição) — adicionar campo `data` no header, incluir no insert. Verificar se há outros consumidores/props.
- `src/components/avaliacoes-premium/PremiumKinologyImport.tsx` + `src/lib/kinologyImport.ts` — adicionar campo `data` visível antes do upload. Como a data padrão vem do PDF, exibir o campo já preenchido com "hoje" mas o usuário pode ajustar; o valor do form **sobrescreve** o do PDF (mais explícito que o inverso). Passar no UPDATE/INSERT de `avaliacoes`.

**Backend:** nenhum. `avaliacoes.data` já é `date` e aceita passado.

**Riscos:**
- Kinology: hoje `data` da avaliação vem do laudo. Sobrescrever pode confundir. Mitigação: pré-preencher o input com a data extraída do laudo (quando disponível) em vez de "hoje".
- MobilidadeTab no path de UPDATE: se o usuário lançar mobilidade retroativa em cima de uma linha de força já criada em outra data, mudar a `data` da linha é semanticamente estranho. Recomendação: só alterar `data` se o usuário explicitamente mudou o campo; senão manter a `data` original da linha (comportamento hoje).

**A decidir depois:** política final de sobrescrita de `data` no path UPDATE (Mobilidade e Kinology).

---

### Bloco 2 — UI de comparativo

**Objetivo:** dentro de Avaliações Premium, permitir comparar duas avaliações (automático ou manual) ou ver evolução agregada num intervalo.

**Decisão de UX proposta:** manter a aba "Evolução" atual (gráfico + timeline) e **adicionar uma nova aba "Comparativo"** ao lado. Motivo: "Evolução" já é uma visão temporal contínua; "Comparativo" é uma visão side-by-side de 2 pontos. Separar evita sobrecarregar a aba existente.

**Arquivos novos:**
- `src/components/avaliacoes-premium/tabs/ComparativoTab.tsx` — recebe `data: ConsolidadoAluno`.
  - Seletor de modo (RadioGroup/Tabs internos): **Automático (última vs anterior)** / **Duas datas** / **Intervalo**.
  - Automático: pega `history[0]` e `history[1]` de cada categoria automaticamente.
  - Duas datas: 2 `Select` com as datas disponíveis (união de `funcional.history + composicao.history + pliometria.history`).
  - Intervalo: 2 date pickers (`de`, `até`); mostra mini-gráficos com pontos apenas dentro do range, delta agregado (primeira vs última do range) e média por categoria.
- `src/components/avaliacoes-premium/CompareTable.tsx` — renderiza para cada categoria uma tabela A | B | Δ | tendência (↑/↓/→), com cores semânticas (verde/amarelo/vermelho) baseadas em `scoringPremium`.

**Arquivos tocados:**
- `src/pages/AvaliacoesPremium.tsx` — adicionar `<TabsTrigger value="comparativo">` e `<TabsContent>`.
- (opcional) `src/components/avaliacoes-premium/scoringPremium.ts` — expor helper `computeDelta(a, b)` se ainda não existir.

**Reaproveita:** `useAlunoAvaliacoesConsolidadas` (já traz `history` completo por categoria), `computePremiumScores`, `recharts`.

**Riscos:**
- Datas desalinhadas entre categorias (aluno fez composição em 10/mai e mobilidade em 15/mai). Solução: comparativo por categoria, cada uma escolhe suas 2 datas mais próximas dos pontos escolhidos globalmente (com aviso "usando avaliação de composição de 10/mai" quando não bater exato).
- Poucos dados: se categoria tem <2 pontos no range, mostrar estado vazio consistente ("sem dados suficientes").

**A decidir depois:** se o modo "Intervalo" deve mostrar todos os pontos como scatter/linha ou só delta agregado.

---

### Bloco 3 — PDF comparativo customizável

**Objetivo:** o professor abre um dialog, escolhe quais categorias incluir (checkboxes Mobilidade / Força / Pliometria / Composição), escolhe o modo (automático 2 últimas ou 2 datas específicas — reaproveita as escolhas do Bloco 2) e gera um PDF comparativo.

**Arquivos novos:**
- `src/components/avaliacoes-premium/GerarRelatorioDialog.tsx` — botão "Gerar Relatório" no header da tela premium; abre dialog com:
  - Checkboxes de categorias (todas marcadas por padrão).
  - Modo comparativo (mesmo componente do Bloco 2 ou versão compacta).
  - Botão "Gerar PDF".
- `src/components/avaliacoes-premium/exportComparativoPDF.ts` — nova função (não altera `exportAssessmentPDF.ts`, que continua servindo o caso avaliação-única):
  - Header FORTEM (mesmo estilo vermelho já existente).
  - Bloco "Dados do aluno" + datas comparadas.
  - Para cada categoria selecionada: seção com sub-tabela A | B | Δ. Reaproveita `autoTable` + paleta já usada.
  - Rodapé com data de geração e nome do avaliador.

**Arquivos tocados:**
- `src/pages/AvaliacoesPremium.tsx` — botão "Gerar Relatório" no header.

**Reaproveita:** `jspdf` + `jspdf-autotable` já instalados; helpers de score de `scoringPremium.ts`; snapshots de `useAlunoAvaliacoesConsolidadas`.

**Riscos:**
- PDF ficar muito longo se todas as categorias forem selecionadas + histórico grande. Mitigação: cada categoria começa em nova página e limitar a comparativo de 2 pontos (não histórico inteiro) no MVP.
- Consistência visual com `exportAssessmentPDF.ts` — manter mesmas cores e fonte.

**A decidir depois:** incluir ou não gráfico como imagem embutida no PDF (Recharts→canvas→dataURL). MVP: só tabelas.

---

## Resumo de ordem, escopo e SQL

| Fase | Bloco | SQL? | Arquivos novos | Arquivos tocados |
|------|-------|------|----------------|------------------|
| 1 | Data retroativa | Não | `AssessmentDateField.tsx` | PliometriaTab, MobilidadeTab, AssessmentForm, PremiumKinologyImport, kinologyImport |
| 2 | Comparativo UI | Não | `ComparativoTab.tsx`, `CompareTable.tsx` | AvaliacoesPremium (+ opcional scoringPremium) |
| 3 | PDF customizável | Não | `GerarRelatorioDialog.tsx`, `exportComparativoPDF.ts` | AvaliacoesPremium |

**Nenhum bloco exige migration.** Toda a infra (`avaliacoes.data`, JSONB `dados`, `jspdf`, `useAlunoAvaliacoesConsolidadas`, shadcn Calendar) já existe.

## Pendências para você decidir depois
1. Kinology: sobrescrever `data` do laudo com a do campo, ou o campo só serve como override opcional?
2. Mobilidade retroativa em UPDATE: mantém `data` original da linha ou sobrescreve?
3. Modo "Intervalo" no comparativo: gráfico completo ou apenas delta agregado?
4. PDF: incluir gráfico embutido no MVP ou deixar para v2?
