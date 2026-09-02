# Resultados: seletor de data global + filtro de camada compartilhado

## A) Como o Mapa Corporal decide o que exibir hoje

- `AvaliacoesPremium.tsx` passa `funcional={data.funcional.latest}` para `PremiumBodyMap`, que repassa `metrics`/`forcaExercises` ao `BodyMap`. Os `scores` (`computePremiumScores`) também usam `data.funcional.latest` e `data.composicao.latest`. **Não existe noção de "avaliação selecionada": o mapa está fixo no mais recente.**
- O seletor de camada é estado **interno** do `BodyMap` (`const [layer, setLayer] = useState<Layer>("mobility")`, linha 154), com os botões Mobilidade/Flexibilidade/Força/Tudo (`asymmetry`) renderizados na "Controls row 2". Ele alimenta `analyze(metrics, layer, forcaExercises)`. Hoje nada fora do `BodyMap` enxerga esse estado.

## B) Estado de data na Mobilidade

- `MobilidadeTab` faz sua **própria query** (`["mobilidade-historico", alunoId]`, avaliações `funcional_v2` com métricas) e mantém `selectedId` + `useEffect` que cai no mais recente. `selecionada` deriva daí e alimenta tabela, `curvasData` (Distribuição) e editar/excluir.
- Elevar: `MobilidadeTab` passa a aceitar `selectedDate?: string` (ISO). Em `readOnly`, ela resolve `selecionada` pela data recebida em vez do `selectedId` local e **não renderiza** o dropdown. Em Lançamento (`readOnly=false`) nada muda: o estado local e o dropdown continuam.

## C) Comportamento do seletor global

- **União de datas**: montar em `AvaliacoesPremium` a lista ordenada (desc) de todas as datas distintas presentes em qualquer categoria — `funcional.history` (mobilidade e força), `composicao.history`, `pliometria.history`. Já temos tudo isso no hook consolidado; a Mobilidade hoje usa query própria, mas as mesmas linhas estão em `funcional.history`.
- **Sem fallback por proximidade**: cada aba busca *match exato* de data na sua categoria. Se não houver, mostra estado vazio explícito ("Sem dado de Composição nesta data"). Fallback "mais próximo anterior" confundiria a leitura comparativa; se você preferir esse comportamento, é uma troca de uma função só.
- Cada opção do seletor pode exibir pequenos marcadores das categorias que têm dado naquela data (ex.: `05/08/2026 · Mob · Força`), para o usuário saber o que esperar.
- Padrão inicial: a data mais recente da união.

## D) Estrutura de componentes proposta

```text
AvaliacoesPremium.tsx  (modo Resultados)
├── estado: selectedDate (ISO)         ← novo
├── estado: layer ("mobility"|...)     ← sobe do BodyMap
├── <ResultadosDateSelect datas={uniao} value onChange />   ← novo, no topo, junto ao Mapa
├── <PremiumBodyMap funcional={funcionalDaData} scores={scoresDaData}
│                   layer={layer} onLayerChange={setLayer} />
└── Tabs
    ├── MobilidadeTab  readOnly selectedDate layer
    ├── ForcaTab       readOnly latest={forcaDaData}
    ├── ComposicaoTab  readOnly latest={composicaoDaData}
    └── PliometriaTab  readOnly latest={pliometriaDaData}
```

- **Derivações por data** (memos em `AvaliacoesPremium`): `funcionalDaData = funcional.history.find(h => h.data === selectedDate)`, idem para composição e pliometria. `scores` passa a ser calculado sobre esses snapshots em vez dos `latest`.
- **`BodyMap`**: tornar `layer` **controlado opcional** (`layer?: Layer; onLayerChange?: (l: Layer) => void`), mantendo o `useState` interno como fallback quando as props não vierem. Isso preserva os outros usos do `BodyMap` (Avaliação Funcional v2, viewer) sem alteração.
- **`MobilidadeTab`**: nova prop `layerFilter?: "mobility" | "flexibility" | "strength" | "asymmetry"`. Em `curvasData`, filtrar por `METRIC_META[m.metric].layer` quando o filtro for `mobility` ou `flexibility`; `strength`/`asymmetry` não filtram. A classificação já existe em `bodyMapLogic.ts` (`METRIC_META`) — não é preciso criar listas novas.
- **Lançamento**: continua chamando os mesmos componentes **sem** as novas props; todos os defaults preservam o comportamento atual.

## E) Riscos e ordem de execução

Riscos:
1. `scores` deixarem de refletir a avaliação mais recente pode mudar o "Resumo geral" e os anéis do mapa — é o comportamento desejado, mas vale destacar na UI qual data está ativa.
2. Datas duplicadas no mesmo dia (duas avaliações funcionais na mesma data): usar a primeira da ordenação (mais recente por `created_at`), como já ocorre hoje.
3. Composição e Pliometria raramente coincidem com a data da funcional — a maioria das datas mostrará estado vazio em algumas abas. É esperado; o rótulo por categoria no seletor reduz o estranhamento.
4. Tornar `layer` controlado no `BodyMap` toca um componente usado fora do Premium; mitigado pelo fallback não-controlado.

Ordem:
1. `BodyMap` com `layer` controlado opcional (sem mudança de comportamento).
2. Estado `selectedDate` + seletor global + derivação dos snapshots por data em `AvaliacoesPremium` (Resultados apenas).
3. `MobilidadeTab` aceitando `selectedDate` (esconde dropdown em readOnly) e `layerFilter` na Distribuição.
4. Estados vazios por categoria em Força/Composição/Pliometria.
5. Verificação: Lançamento inalterado; trocar data atualiza mapa + 4 abas; camada filtra silhueta e cards de distribuição.
