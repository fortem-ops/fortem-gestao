# Filtro de Ocupação na Agenda de Serviços

Adicionar um quarto filtro na barra de filtros da Agenda de Serviços para separar horários **livres** (sem aluno vinculado) de **ocupados** (com aluno vinculado), facilitando a visualização de onde ainda há vaga.

## O que muda

- Novo seletor "Ocupação" ao lado de Atividade, Profissional e Aluno, com três estados:
  - Todos (padrão)
  - Livres — horários sem aluno vinculado
  - Ocupados — horários com aluno vinculado
- O filtro se combina com os demais (atividade, profissional, aluno) e é limpo pelo botão "Limpar filtros".
- Reforço visual no card do horário: indicador discreto de "Livre" quando não há aluno vinculado, mantendo o layout atual (barra colorida por atividade + texto de alto contraste).

## Detalhes técnicos

- `src/pages/Agenda.tsx`:
  - Novo estado `fOcupacao: "todos" | "livre" | "ocupado"`.
  - Em `getEventsForCell`, adicionar a checagem: `livre` → `!a.aluno_id`; `ocupado` → `!!a.aluno_id`.
  - Incluir `fOcupacao` em `temFiltro` e em `limparFiltros`.
  - UI: grid de filtros passa de `sm:grid-cols-3` para `sm:grid-cols-4`, usando um `Select` simples (não multi) para Ocupação.
  - No card do evento, badge/etiqueta "Livre" quando `!ev.aluno_id`.
- Sem mudanças de banco, queries ou lógica de agendamento.
