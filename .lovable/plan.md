# Avaliações Premium — modo "Lançamento" com cards por categoria

Relatório da investigação + plano. Nada foi implementado.

## 1. Como está `AvaliacoesPremium.tsx` hoje

Estrutura atual (162 linhas, tudo numa página só):

```text
header (logo/título + StudentPicker)
└─ se aluno selecionado e dados carregados:
   ├─ AlunoSidebarCard (coluna esquerda)
   └─ coluna direita
      ├─ faixa "Resumo geral" (contagem de alertas)
      ├─ PremiumBodyMap
      └─ <Tabs defaultValue="mobilidade">  → 7 abas
         mobilidade · forca · composicao · pliometria · evolucao · comparativo · recomendacoes
```

Os dados vêm todos de um único hook, `useAlunoAvaliacoesConsolidadas(alunoId)`, que já devolve `funcional`, `composicao`, `pliometria` cada um com `{ latest, history }` — ou seja, **a data da última avaliação de cada categoria já está disponível sem query nova**. Força e mobilidade compartilham a mesma origem (`funcional_v2`), então "última força" precisa ser derivada de `funcional.history.find(s => s.forca.length > 0)` e "última mobilidade" de `funcional.history.find(s => s.metricas.length > 0)`.

Esforço de reestruturação: baixo. As abas são só um `<Tabs>` na página; trocar por um alternador Lançamento/Resultados e mover as 4 abas de lançamento para um novo componente não toca em nenhuma lógica de dados.

## 2. Estado atual de cada componente (form vs histórico)

| Componente | Formulário | Histórico | Situação |
|---|---|---|---|
| `MobilidadeTab` (605 l.) | sim — tabela de inputs por métrica, com modo novo/edição | sim — seletor de data + tabela de valores + curvas de Gauss | **Já é form + histórico no mesmo componente**, alternando por `formOpen`: ou mostra o histórico, ou mostra o form (nunca os dois juntos) |
| `ForcaTab` (171 l.) | sim, delegado a `PremiumKinologyImport` (upload PDF + data + diálogo de datas) | sim — `AvaliacaoDeleteList mode="forca"`, tabela de assimetrias da última + gráfico de evolução | Form já isolado em `PremiumKinologyImport`; o resto do ForcaTab é histórico/análise |
| `ComposicaoTab` (308 l.) | sim — Pollock 7 dobras, no topo | sim — `AvaliacaoDeleteList`, cards da última, gráfico de dobras, evolução | **Form e histórico já empilhados no mesmo componente**, na ordem certa |
| `PliometriaTab` (200 l.) | sim — 7 campos + observações | sim — cards do último, `AvaliacaoDeleteList`, tabela de histórico completa | Igual: form + histórico empilhados, mas com cards do último **acima** do form |

Conclusão: **ComposicaoTab e PliometriaTab já são exatamente "form em cima, histórico embaixo"** — entram no card praticamente sem alteração (na pliometria basta mover os cards do último para depois do form). **ForcaTab** também já é isso (import em cima, histórico embaixo). O único que exige ajuste real é o **MobilidadeTab**, porque ele é exclusivo: `if (!formOpen) return <histórico/>` — precisa passar a renderizar form e histórico juntos.

## 3. Estrutura de componentes proposta

```text
src/pages/AvaliacoesPremium.tsx
├─ header + StudentPicker  (sem mudança)
├─ alternador  [ Lançamento | Resultados ]   ← Tabs simples, estado local
├─ modo "lancamento" → <LancamentoView />          (novo)
└─ modo "resultados" → bloco atual intacto         (sidebar + resumo + BodyMap + Tabs)

src/components/avaliacoes-premium/lancamento/
├─ LancamentoView.tsx        pai: recebe { alunoId, data, mobilidadeRef }, renderiza 4 CategoriaCard
└─ CategoriaCard.tsx         casca visual: título, ícone, "Última: dd/MM/yyyy", chevron,
                             conteúdo expansível (Accordion do shadcn, type="single" collapsible)
```

Dentro de cada card, o conteúdo é o componente existente, sem duplicação de código:

- Mobilidade → `<MobilidadeTab ... />` (mesmas props de hoje)
- Força → `<ForcaTab ... />` (que já contém `PremiumKinologyImport` + histórico)
- Composição → `<ComposicaoTab ... />`
- Pliometria → `<PliometriaTab ... />`

Único ajuste de componente existente: em `MobilidadeTab`, trocar o `if (!formOpen) return <histórico>` por render dos dois blocos (form no topo quando aberto/`abrirNova`, histórico sempre abaixo), extraindo os dois trechos de JSX em subcomponentes internos do mesmo arquivo (`MobilidadeForm` / `MobilidadeHistorico`) para não inchar o retorno. Nenhuma lógica de save/merge/delete muda.

Datas de "última avaliação" por card, todas derivadas do hook já existente:

| Card | Fonte da data |
|---|---|
| Mobilidade | primeiro `funcional.history[i]` com `metricas.length > 0` |
| Força | primeiro `funcional.history[i]` com `forca.length > 0` |
| Composição | `composicao.latest?.data` |
| Pliometria | `pliometria.latest?.data` |

## 4. Mapa Corporal, Evolução, Comparativo, Recomendações

Sim — todos ficam no modo **Resultados** e não são tocados nesta leva. Dá para isolar sem risco: `PremiumBodyMap`, `EvolucaoTab`, `ComparativoTab` e `RecomendacoesTab` recebem apenas `data` / `scores` / `recomendacoes`, todos calculados na página. A mudança é só envolver esse bloco inteiro (sidebar + resumo geral + body map + Tabs de análise) numa condicional de modo. `scores` e `recomendacoes` continuam calculados no topo da página (`useMemo`), sem custo relevante.

Observação: no modo Resultados as abas mobilidade/força/composição/pliometria passariam a duplicar o que existe em Lançamento. Sugestão para esta leva: **manter as 7 abas de Resultados como estão** (nada quebra) e limpar depois, quando Resultados for redesenhado.

## 5. Ordem de execução e riscos

1. Criar `CategoriaCard.tsx` (casca expansível com data da última avaliação).
2. Criar `LancamentoView.tsx` montando os 4 cards com os componentes existentes.
3. Ajustar `MobilidadeTab` para exibir form + histórico juntos.
4. Ajustar `PliometriaTab` só na ordem visual (cards do último abaixo do form).
5. Adicionar o alternador Lançamento/Resultados em `AvaliacoesPremium.tsx`, com Lançamento como padrão; envolver o bloco atual no modo Resultados.
6. Verificar build e testar num aluno com dados nas 4 categorias.

Riscos:
- **MobilidadeTab** é o único ponto com refactor de fluxo (estado `formOpen` usado tanto para "nova" quanto para "editar"). Risco médio: manter o comportamento de edição intacto.
- Montar 4 formulários simultaneamente carrega mais estado; mitigado pelo accordion `collapsible` (conteúdo só monta quando expandido).
- Invalidações de query já existem em todos os componentes com as mesmas chaves — a data no cabeçalho do card atualiza sozinha após salvar.
- Nenhuma mudança de banco, RLS ou edge function.
