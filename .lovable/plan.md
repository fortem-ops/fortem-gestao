## Objetivo

Melhorar o seletor de exercícios usado no editor **Personalizado** (e Personalizado 2) — `src/components/student/workout/ExerciseSelector.tsx` — para que:

1. A lista suspensa de seleção fique **bem maior** (mais itens visíveis sem rolar) e responsiva em tablet/desktop.
2. Cada item do banco mostre um **botão "Demo"** sempre visível (quando há vídeo).
3. Clicar em **Demo** abra uma **modal quase fullscreen** com player de vídeo (controls, autoplay, fullscreen) — para YouTube usa iframe embed, para arquivo direto usa `<video controls>`.

Isso resolve o problema atual em que o popover é estreito (`w-80`, ~320px) e baixo (`max-h-48`, 192px), e o vídeo só aparece como ícone sem forma de pré-visualizar antes de escolher.

## O que muda

### Lista do popover
- Largura: `w-[min(560px,calc(100vw-2rem))] sm:w-[480px] md:w-[560px]` (caps em mobile, expande em tablet/desktop).
- Altura: `max-h-[min(60vh,480px)]` em vez de 192px fixos.
- Cabeçalho fixo (sticky) mostrando "X de Y em GRUPO · subcategoria" e botão de fechar (X).
- Aumenta o limite de resultados de 30 para 60.
- Item selecionado destacado com `bg-primary/10`.
- Cada linha tem: ícone de vídeo (se houver) + nome (truncado) + botão **Demo** à direita (visível só quando há vídeo).
- Clique no nome seleciona o exercício e fecha o popover. Clique em **Demo** abre a modal sem fechar a lista.

### Modal de demonstração
- Componente `Dialog` (shadcn) com `max-w-[95vw] w-[95vw] sm:max-w-5xl` e player em `aspect-video` ocupando toda a largura.
- Resolução de URL: usa `video_url` se existir; senão gera `publicUrl` a partir de `video_path` no bucket `exercicios-videos` (mesma lógica usada em outros pontos do app).
- Detecta YouTube via `getYouTubeEmbedUrl` (`src/lib/youtube.ts`) → renderiza `<iframe>` embed com `autoplay=1&rel=0` e `allowFullScreen`.
- Outros vídeos → `<video controls autoPlay playsInline>` nativo, com botão de fullscreen do próprio player.
- Header da modal mostra o nome do exercício.

## Arquivos afetados

- `src/components/student/workout/ExerciseSelector.tsx` — única mudança. Reescrita do JSX do popover + adição do estado `demo` + `Dialog` de vídeo.

Nenhuma mudança em tipos, persistência, banco ou em outros editores. O `ExercisePicker` das Fases (`BancoTreinos.tsx`) já tem fluxo próprio de vídeo e não é tocado.

## Não-objetivos

- Não alterar o esquema do banco nem a forma como vídeos são armazenados.
- Não introduzir um novo componente compartilhado — a modal de demo fica encapsulada no `ExerciseSelector` (escopo do Personalizado).
- Não alterar o seletor das Fases.
