# Agenda em faixas de 30 minutos

Hoje a grade semanal tem uma linha por hora cheia (06:00 até 21:00) e todo evento que começa em qualquer minuto daquela hora cai na mesma linha. O objetivo é ter linhas de 30 em 30 minutos (06:00, 06:30, 07:00...) com cada card exatamente na célula do seu dia e horário, sem estourar linhas nem colunas.

## O que muda

1. **Linhas de 30 min**: a lista de horários passa a gerar 06:00 até 21:30 em passos de 30 minutos. A coluna da esquerda mostra o rótulo completo (ex.: 06:30).
2. **Alocação correta dos cards**: o evento passa a ser colocado na faixa correspondente a hora + minuto de início (arredondando para a meia hora anterior), em vez de considerar só a hora.
3. **Card contido na célula**: cada célula ganha altura mínima menor (compatível com meia hora) e o card fica com layout compacto e conteúdo truncado, com `overflow` controlado para nunca vazar para a linha/coluna vizinha.
4. **Clique em célula vazia**: ao clicar numa faixa de 30 min, o formulário de novo agendamento já vem com o horário exato (ex.: 06:30 – 07:30) em vez de sempre a hora cheia.

## Detalhes técnicos

- `src/pages/Agenda.tsx`
  - Substituir `HORAS` (16 horas inteiras) por `SLOTS` de minutos desde 06:00 até 21:30, passo 30.
  - `getEventsForCell(dayIndex, hour)` passa a receber o slot em minutos e comparar `horario_inicio` convertido em minutos, arredondado para baixo à meia hora.
  - `handleCellClick` envia `prefill` com hora e minuto do slot.
  - Ajustar `min-h` da linha e manter `overflow-hidden`/`truncate` nos cards.
- `src/components/agenda/AddAgendaDialog.tsx`
  - `prefill` passa a aceitar minutos (ex.: `{ date, hour, minute }`), montando início e fim (+1h) com os minutos corretos, mantendo compatibilidade quando o minuto não vier.

Nada muda nas regras de negócio (fixo vs avulso, exceções, disparos de WhatsApp) — apenas a granularidade visual da grade e o horário pré-preenchido.
