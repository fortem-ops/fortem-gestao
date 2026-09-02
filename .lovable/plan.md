# Resultados: barra de seções + área única controlada pela camada

Escopo: apenas o modo "Resultados" da tela Avaliações Premium. O modo "Lançamento" (LancamentoView e os mesmos Tabs sem `readOnly`) não muda.

## O que muda para o usuário

- No topo do card do Mapa Corporal, ao lado do botão "Assimetria", aparece uma barra com: Composição · Pliometria · Evolução · Comparativo · Recomendações.
- Clicar em um desses itens troca todo o conteúdo abaixo do mapa por aquela seção. O botão "Assimetria" volta ao estado padrão.
- No estado padrão (Assimetria), o conteúdo abaixo do mapa é uma área única, ditada pela camada já existente do mapa:
  - Mobilidade → distribuição/gráficos de mobilidade
  - Flexibilidade → mesma visão, métricas de flexibilidade
  - Força → dinamometrias/exercícios
  - Tudo → por ora mostra a visão de Mobilidade
- Somem as sub-abas "Mobilidade/Flexibilidade", "Força", "Composição", "Pliometria", "Evolução", "Comparativo", "Recomendações".

## A) Estado em AvaliacoesPremium.tsx

Estado atual relevante: `alunoId`, `selectedDate`, `layer` (já elevado e passado ao BodyMap), snapshots por data e `scores`.

Adicionar:

```ts
type ResultadoView = "assimetria" | "composicao" | "pliometria" | "evolucao" | "comparativo" | "recomendacoes";
const [view, setView] = useState<ResultadoView>("assimetria");
```

O `<Tabs defaultValue="mobilidade">` com 7 `TabsContent` é removido e substituído por um bloco condicional:

- `view === "assimetria"` → deriva de `layer`:
  - `strength` → `<ForcaTab ... readOnly />`
  - `mobility` | `flexibility` | `asymmetry` → `<MobilidadeTab ... readOnly layerFilter={layer === "flexibility" ? "flexibility" : "mobility"} />`
- `composicao` / `pliometria` / `evolucao` / `comparativo` / `recomendacoes` → o componente existente correspondente, com exatamente as mesmas props de hoje.

Nada de duplicação: todos os componentes seguem recebendo `selectedDate`/snapshots como já recebem. O seletor global de data e o "Resumo geral" continuam onde estão.

## B) Onde entra a barra visualmente

O botão "Assimetria" pertence a `MODES` dentro de `BodyMap.tsx`, na "Controls row 1" (`flex flex-col md:flex-row md:items-center md:justify-between`, com o grupo de modos à esquerda e legenda + Ambos/Anterior/Posterior à direita). `BodyMap` também é usado por `FuncionalV2Assessment` e `FuncionalV2Viewer`, então não pode ganhar lógica de navegação de página.

Solução: prop opcional `navSlot?: ReactNode` em `BodyMap`, renderizada logo após o grupo de `MODES`, dentro do mesmo container à esquerda (que passa a ser `flex flex-wrap items-center gap-2`). Quando `navSlot` é `undefined` (os outros dois usos), nada muda.

`PremiumBodyMap` repassa `navSlot`; `AvaliacoesPremium` monta um novo componente `ResultadosNav.tsx` (mesmo visual dos botões pill do mapa: `bg-white/5`, ativo `bg-white/10 text-white`) e o passa como `navSlot`.

Responsivo: o container vira `flex-wrap`, então em telas estreitas a barra quebra para a linha seguinte sem estourar; os itens usam `text-xs px-2.5 py-1.5` como os já existentes.

## C) Reaproveitamento de MobilidadeTab e ForcaTab

- `MobilidadeTab` já aceita `readOnly`, `selectedDate` e `layerFilter` ("mobility" | "flexibility" | "strength" | "asymmetry"), filtrando os cards de "Distribuição vs. base Fortem" por `METRIC_META`. Em `readOnly` a tabela de histórico já fica oculta e os controles de escrita já somem. Não precisa de mudança de lógica; só passar o `layerFilter` derivado do estado `layer`. Ajuste necessário: incluir `layerFilter` na lista de dependências do `useMemo` de `curvasData` para não ficar card obsoleto ao trocar de camada.
- `ForcaTab` não tem (nem precisa de) o conceito de `layerFilter` — a camada "Força" simplesmente escolhe qual componente renderizar. Em `readOnly` ele já esconde import Kinology e lista de exclusão, mostrando apenas tabela de assimetrias + gráfico + estado vazio. Não há cabeçalho de aba redundante próprio para remover.
- `ReadOnlyHint` hoje é renderizado por cada tab. Com a área única ele passa a aparecer em qualquer seção; manter como está (uma linha discreta) para não alterar a lógica dos componentes.

## D) Riscos e ordem de execução

Riscos:
- `BodyMap` é compartilhado — mitigado pela prop opcional sem comportamento padrão.
- Perda das seções antigas se algum `TabsContent` for esquecido — a checagem é 1:1 entre as 7 abas e os novos destinos.
- `Tabs`/`TabsList` externos ("Lançamento" / "Resultados") permanecem; só o `Tabs` interno some. Cuidado para não remover o errado.
- Se `scores` for nulo em uma data sem funcional, o bloco de Resultados hoje não renderiza; comportamento mantido nesta leva (não é o foco).

Ordem:
1. `BodyMap.tsx`: prop `navSlot` + container flex-wrap.
2. `PremiumBodyMap.tsx`: repasse de `navSlot`.
3. Novo `ResultadosNav.tsx` (itens + item "Assimetrias" de retorno).
4. `AvaliacoesPremium.tsx`: estado `view`, remoção do `Tabs` interno, render condicional por `view`/`layer`.
5. `MobilidadeTab.tsx`: corrigir dependências do `useMemo`.
6. Verificar: troca de seções, troca de camada, troca de data, e Lançamento intacto.
