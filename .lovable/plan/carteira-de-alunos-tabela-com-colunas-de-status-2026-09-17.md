# Carteira de Alunos — tabela com colunas de status

## Contexto
Hoje cada aluno é uma linha flexível com três etiquetas curtas ("AF", "Ficha", "Relatório") empilhadas dentro de uma única coluna. O usuário quer aproveitar a largura disponível com uma tabela de verdade: nome do aluno na linha, três colunas com título, e cada célula exibindo o texto completo do status com cor.

## Mudança (somente frontend, sem migration)

### 1. Converter a lista de alunos em tabela
Arquivo: `src/pages/CarteiraAlunos.tsx`

- Substituir o layout atual (`div.divide-y` + linha flexível) por uma tabela (componente `Table` do shadcn, já usado no projeto).
- Colunas: `Aluno` (nome + email/frequência + badge "Ativo" + checkbox de seleção quando coordenador/admin), `Avaliação Funcional`, `Ficha`, `Relatório`.
- Cada linha continua navegando para `/alunos/{id}` ao clicar, com hover mantido.
- Um card por professor (agrupamento atual) permanece; cada card contém sua própria tabela com o cabeçalho das colunas.

### 2. Células de status com texto completo
Arquivo: `src/components/carteira/StatusPills.tsx`

- A célula passa a exibir o rótulo completo: **Em dia** (verde), **Pendente** (amarelo) e **Atrasada** (vermelho) — mesmas classes de status atuais (`status-active`, `status-warning`, `status-urgent`).
- O menu do clique (ação principal + Reagendar quando há tarefa aberta) e o diálogo de reagendamento permanecem exatamente como estão.
- Ajustar o componente para ocupar a célula (largura mínima, alinhamento à esquerda) em vez de etiqueta minúscula de 2–3 letras.

### 3. O que não muda
- Regras de status (AF: em dia/pendente/atrasada por severidade da última avaliação; Ficha e Relatório: prazo vencido = atrasada).
- Ações de cada indicador, "Reagendar", agrupamento por professor, seleção múltipla/transferência, consulta paginada de tarefas.

## Verificação
- Typecheck e build.
- Playwright autenticado em `/carteira` com screenshot confirmando a tabela com as três colunas, nome do aluno como linha e os status coloridos com texto completo.
