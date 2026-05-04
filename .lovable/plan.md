## Objetivo

No `Banco de Treinos`, ao clicar em um exercício (Aquecimento ou Força) o popover de seleção:

1. **Corta a lista** quando há muitos exercícios (`max-h-64` ≈ 256px). Queremos exibir a lista completa, sem cortes — ou ao menos uma área de rolagem bem maior, ocupando o espaço disponível na tela.
2. **Não permite visualizar o vídeo** do exercício antes de escolher. Hoje o ícone `Video` é apenas um indicador visual e o clique no item seleciona o exercício. Queremos um **botão dedicado de visualização** ao lado de cada item, para abrir o preview do vídeo sem selecionar.

## Arquivo único alterado

`src/pages/BancoTreinos.tsx` — componente `ExercisePicker` (linhas ~81-207).

## Mudanças

### 1. Lista sem corte / com altura ampliada

- Trocar `max-h-64` (256px) por `max-h-[70vh]` na div de scroll do popover (linha 172). Isso permite que a lista cresça até 70% da altura da viewport antes de rolar — em telas comuns (895px) será ~626px, suficiente para mostrar dezenas de exercícios sem rolagem em grupos pequenos, e mantém scroll para grupos grandes (Força tem 775).
- Aumentar a largura do popover de `w-80` (320px) para `w-96` (384px) para acomodar melhor nomes longos + novo botão de preview (linha 159).
- Manter cabeçalhos sticky por subcategoria já existentes.

### 2. Botão de preview de vídeo dentro do picker

- Hoje `renderItem` é um único `<button>` que seleciona o exercício e mostra um ícone `Video` decorativo. Vamos converter cada linha em duas áreas clicáveis lado a lado:
  - **Área principal (esquerda, flex-1)**: clique seleciona o exercício (comportamento atual).
  - **Botão de vídeo (direita)**: presente apenas quando `hasVideo`. Clique abre o preview e **não seleciona** (`stopPropagation`). Usa o mesmo modal de vídeo já existente na página (`videoPreview` state + `onOpenVideo` handler).
- Para isso, `ExercisePicker` precisa receber a prop `onOpenVideo: (b: BankExercise) => void` e repassá-la ao `renderItem`. Adicionar nas duas chamadas existentes (linhas ~387 e ~423) passando o handler já disponível no contexto.
- Visual do botão: ícone `Eye` (ou manter `Video`) com tooltip "Ver demonstração", `h-7 w-7`, `hover:bg-accent`, cor `text-primary`.

### Estrutura visual final do popover

```text
┌─ [🔍 Buscar em Força...]                       ┐  largura ~384px
├─────────────────────────────────────────────────┤
│ ANTI-ROTAÇÃO · 12                               │  sticky
│   • Pallof Press                       [▶]      │  ← seleciona | preview
│   • Cable Anti-Rotation                          │
│ ANTI-HIPEREXTENSÃO · 18                         │
│   • Back Extension                     [▶]      │
│   ...                                            │  rola até 70vh
├─────────────────────────────────────────────────┤
│ [✕ Remover escolha]                             │
└─────────────────────────────────────────────────┘
```

## Fora de escopo

- Não mexer em `ExerciseSelector.tsx` (componente diferente, usado em outro fluxo).
- Não alterar a query do banco nem o agrupamento já implementado.
- Não tocar em migrations.
