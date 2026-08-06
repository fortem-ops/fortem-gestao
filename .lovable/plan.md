# Horário fixo em lote na Agenda de Serviços

Hoje, ao escolher **Tipo de Horário > Fixo (semanal)**, só é possível criar um horário por vez: um dia da semana + um intervalo início/fim. Para "Reabilitação — seg/qua/sex às 16:30, 17:30 e 18:30" seriam 9 cadastros manuais.

## O que muda

No diálogo de novo horário, quando o tipo for **Fixo (semanal)**:

1. **Dias da semana** viram seleção múltipla (botões de alternância Dom–Sáb) em vez de uma lista com um único dia.
2. **Horários** viram uma lista: o usuário informa um horário de início e clica em "Adicionar", formando chips removíveis (16:30, 17:30, 18:30...).
3. **Horário de fim** é sempre 1 hora depois do início escolhido (16:30 → 17:30), calculado automaticamente e exibido no chip; não há campo de duração.
4. Um resumo mostra quantos horários serão criados ("3 dias × 3 horários = 9 horários fixos") antes de confirmar.
5. Ao salvar, todos os registros são criados de uma vez; havendo falhas parciais, o aviso informa quantos foram criados e quantos falharam.

O modo **Avulso (data específica)** continua exatamente como está.

## Regras

- **Edição**: ao editar um horário existente, o formulário continua no modo antigo (um dia, um horário) — o lote é só para criação.
- **Aluno vinculado**: criar vários horários fixos de uma vez é para abrir vagas de grade, não para agendar um aluno. Quando houver mais de um horário no lote, o campo de aluno fica desabilitado (e o débito de crédito não é acionado). Com um único dia e um único horário, o comportamento atual com aluno é preservado.
- **Duplicados**: horários fixos já existentes com mesma atividade, local, dia e hora são ignorados no lote, evitando duplicidade na grade.

## Detalhes técnicos

- Arquivo: `src/components/agenda/AddAgendaDialog.tsx`.
- Estados `diaSemana`/`horarioInicio`/`horarioFim` passam a conviver com `diasSemana: number[]` e `horarios: string[]` usados apenas no modo fixo de criação; o fim de cada faixa é derivado somando 60 minutos ao início.
- A mutation monta um array de payloads (produto cartesiano dias × horários) e faz um único `insert` em `agenda_servicos` com a lista, mantendo o payload atual campo a campo.
- Verificação de duplicados via `select` prévio em `agenda_servicos` filtrando `tipo='fixo'`, atividade, local e dias envolvidos.
- Invalidação de queries, toasts e o fluxo de notificação/WhatsApp permanecem; os disparos continuam ocorrendo só quando há aluno vinculado (caso de horário único).
- Nenhuma mudança de banco de dados é necessária.
