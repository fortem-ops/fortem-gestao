## Problema

No editor **Personalizado**, ao abrir a lista do `ExerciseSelector` dentro do card "AQUECIMENTO", o popover é cortado/coberto pelo card "FORÇA" logo abaixo. Mesmo problema ocorre dentro de "FORÇA" quando há blocos empilhados.

Causa: o popover é um `<div class="absolute z-50">` filho do card. Cada card `glass-card` cria seu próprio contexto de empilhamento (backdrop-filter / overflow), então o `z-50` só vale dentro do card de origem; o card seguinte no DOM fica visualmente por cima.

## Solução

Renderizar o popover do `ExerciseSelector` em um **portal no `document.body`**, posicionado com coordenadas calculadas a partir do `getBoundingClientRect()` do input. Assim escapa de qualquer stacking context dos cards e fica sempre por cima de todo o conteúdo da página.

### Detalhes
- Usar `createPortal` (já disponível em `react-dom`).
- Calcular `top/left/width` a partir do retângulo do input quando `open` vira `true` e em resize/scroll (listener `window`), com `position: fixed`.
- Preservar largura responsiva: `Math.min(560, viewportWidth - 16)`; `max-h: min(60vh, 480px)`.
- Click-outside continua funcionando: o handler já checa contra `ref.current` (input) e ganha um segundo ref para o popover portal, ignorando cliques dentro de qualquer um dos dois.
- A modal de Demo já é um `Dialog` (Radix) → portal próprio, sem mudança.

## Arquivo afetado

- `src/components/student/workout/ExerciseSelector.tsx` — único arquivo.
  - Adiciona `popoverRef` e `coords` (state com `{top,left,width}`).
  - Recalcula `coords` em `open`/resize/scroll.
  - Move o JSX do popover para `createPortal(<div style={{position:'fixed',...}}>...</div>, document.body)`.
  - Atualiza o handler de click-outside para considerar o popover portal.

## Não-objetivos

- Não trocar para Radix Popover (mudança maior; manter API atual do componente).
- Não alterar o card `glass-card`.
- Não alterar a modal de Demo.
