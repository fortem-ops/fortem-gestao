# Erro ao criar horário de Treino nas segundas, quartas e sextas às 07:30

## O que está acontecendo (confirmado no banco)

Na tabela de horários de treino existe uma regra de unicidade por **dia da semana + hora de início**, sem considerar a modalidade. Hoje já existem, às 07:30:

- Segunda-feira — modalidade **Corrida**
- Terça-feira — modalidade Treino
- Quarta-feira — modalidade **Corrida**
- Quinta-feira — modalidade Treino

Ao criar "Treino, seg/qua/sex às 07:30", segunda e quarta colidem com os horários de Corrida existentes. Como os três dias são gravados de uma vez só (tudo ou nada), a operação inteira falha — inclusive a sexta, que estaria livre — e aparece a mensagem genérica "Já existe um registro com estes dados ou há vínculos impedindo a operação."

## O que muda

1. **Treino e Corrida podem coexistir no mesmo dia e horário.** A regra de unicidade passa a considerar também a modalidade, então "Segunda 07:30 Corrida" e "Segunda 07:30 Treino" convivem na grade. Continua bloqueado criar dois horários da mesma modalidade no mesmo dia e hora.
2. **Mensagem clara em vez do erro genérico.** Antes de salvar, o sistema verifica quais dias já têm um horário daquela modalidade naquele horário e avisa por nome: "Já existe horário de Treino às 07:30 em Segunda e Quarta."
3. **Criação parcial.** Os dias livres são criados normalmente e o aviso informa quantos foram criados e quais foram ignorados por já existirem — em vez de cancelar tudo.

## Detalhes técnicos

- Migration: substituir a constraint `treino_slots_dia_semana_horario_inicio_key` por uma unique em `(dia_semana, horario_inicio, modalidade)`.
- `src/pages/AgendaTreinos.tsx` (diálogo de novo horário, `save`): antes do insert, `select` em `treino_slots` filtrando `modalidade`, `horario_inicio` e `dia_semana in (dias)`; remover do payload os dias já existentes; se sobrar zero, mostrar aviso e não inserir; caso contrário inserir os restantes e montar o toast com criados/ignorados.
- Nenhuma mudança nas telas do aluno; a grade já lista slots por modalidade.
