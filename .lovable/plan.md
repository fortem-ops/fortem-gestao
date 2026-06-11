## Mudanças

### 1) Cores de status dos Créditos de Serviços (perfil do aluno → aba Plano)

Em `src/components/student/StudentPlan.tsx` (bloco "Créditos de Serviços"):

- Reforçar o destaque visual de cada linha:
  - **Verde** (`border-success/60 bg-success/15`, ícone `text-success`) quando há crédito disponível (`restante > 0`).
  - **Vermelho** (`border-destructive/60 bg-destructive/15`, ícone `text-destructive`) quando todos os créditos foram utilizados (`restante <= 0` e `total > 0`).
  - Serviços sem contratação (`total === 0`) continuam neutros (cinza), para não confundir "esgotado" com "não contratado".
- Garantir que o Badge de status use `status-active` / `status-urgent` consistentes com a linha.

Mesma lógica aplicada em `src/components/student/StudentServicos.tsx` (tabela "Serviços e Créditos Contratados") para padronizar o vermelho/verde por linha de crédito.

### 2) Abrir perfil do aluno em nova guia (botão direito / Ctrl+clique / clique do meio)

Em `src/pages/StudentList.tsx`, a linha da tabela hoje navega via `onClick={() => navigate(...)}`, o que impede o menu de contexto do navegador de oferecer "Abrir em nova guia".

Solução: transformar a célula do **nome do aluno** em um `<a href="/alunos/{id}">` real (estilizado como o texto atual). Assim:
- Clique normal → SPA navigation (interceptado via `onClick` chamando `navigate` e `preventDefault`, preservando comportamento atual).
- Botão direito → menu nativo do navegador com "Abrir link em nova guia".
- Ctrl/Cmd+clique e clique do meio → abrem nova guia automaticamente (sem `preventDefault` quando esses modificadores estão presentes).

O restante da `<tr>` mantém `cursor-pointer` + `onClick` para navegação SPA. As demais células (status, plano, etc.) não precisam ser links — o usuário usará o nome como âncora para abrir em nova guia, padrão comum em listagens.

### Arquivos alterados
- `src/components/student/StudentPlan.tsx`
- `src/components/student/StudentServicos.tsx`
- `src/pages/StudentList.tsx`
