## Problema
O card de tarefa na Central de Tarefas usa `flex items-start gap-3` em todas as telas. No mobile, os elementos da direita (botão Reagendar, badges Automática/média, botão Realizar) comprimem a área de texto, fazendo o título quebrar em linhas estranhas ("Atualiz..." + "treino") e os metadados (nomes, data) empilharem verticalmente. A descrição fica ilegível.

## Solução
Restruturar o card para empilhar verticalmente no mobile e manter o layout horizontal no desktop:

1. **Container do card**: mudar de `flex items-start gap-3` para `flex flex-col sm:flex-row sm:items-start gap-3`.
2. **Agrupar ícone + texto**: envolver o `<button>` do ícone e a `<div>` de texto em uma `<div className="flex items-start gap-3 flex-1 min-w-0">`. Assim o conteúdo textual ocupa toda a largura disponível na primeira linha do mobile.
3. **Agrupar ações/badges**: envolver todos os elementos à direita (`RecordVideoUpload`, botão Realizar, `RescheduleDialog`, badges) em uma `<div className="flex flex-wrap items-center gap-2 shrink-0">`. No mobile eles formam uma segunda linha abaixo do texto; no desktop (`sm:`) permanecem alinhados à direita.

## Resultado esperado
- Mobile: texto com largura total (legível), ações/badges em linha abaixo.
- Desktop: layout horizontal preservado, sem regressões.

## Arquivo
- `src/pages/TaskCenter.tsx` — ajuste no componente `TaskList`, dentro do `.map()` de tasks.