Ajuste de posição da logo Fortem no banner /corrida

Objetivo
Permitir ajustar manualmente a posição vertical da logo Fortem no topo do `NbCortesiaBanner`, movendo-a mais para cima conforme solicitado.

Escopo
- Componente: `src/components/corrida/NbCortesiaBanner.tsx`
- Elemento: imagem da logo Fortem (primeira `<img>` do banner, linha 36)
- Controle: alinhamento/deslocamento vertical via prop/configuração simples

Implementação proposta
1. Adicionar uma prop opcional `logoOffset` (ou similar) ao componente `NbCortesiaBanner`, aceitando valores como `"top" | "center" | "bottom"` ou um número de pixels/percentual para `translateY` negativo.
2. Aplicar a posição à logo Fortem usando classe utilitária do Tailwind (`-translate-y-*`) ou estilo inline (`transform: translateY(...)`), preservando o layout responsivo.
3. Onde o banner é consumido (`src/pages/Corrida.tsx`), passar o valor desejado para elevar a logo.
4. Validar no preview que a logo sobe sem quebrar o espaçamento do título e dos elementos abaixo.

Não inclui
- Alteração de outras logos (New Balance) ou seções.
- Persistência em banco/CMS (a menos que solicitado depois).
- Editor visual drag-and-drop.