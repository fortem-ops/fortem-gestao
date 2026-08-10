# Vários horários numa mesma criação (Agenda de Treinos)

Hoje o diálogo "Novo horário" cria um único horário (início/fim) replicado nos dias marcados. A mudança permite cadastrar vários horários de uma só vez — ex.: 07:30, 08:00, 08:30 — nos mesmos dias, com a mesma modalidade, capacidade, instrutor e observações.

## Como vai funcionar

No diálogo de criação (não na edição, que continua sendo de um horário só), a seção de horário passa a ter duas formas de uso:

1. **Lista de horários**: campo de início + duração, com botão "Adicionar horário". Cada horário adicionado vira um chip removível (ex.: `07:30–08:30 ×`).
2. **Gerar em série**: campos "de", "até" e "a cada X minutos" (30/45/60), que preenchem a lista automaticamente. Ex.: de 07:30 até 09:30 a cada 30 min gera 07:30, 08:00, 08:30, 09:00, 09:30 (cada um com a duração definida).

Ao salvar, o sistema cria a combinação de **cada horário × cada dia selecionado**. Horários que já existirem para aquela modalidade/dia são ignorados, e o aviso final informa exatamente o que foi criado e o que já existia (ex.: "6 horários criados · já existia em Seg 08:00, Qua 08:30").

A edição de um horário existente permanece igual (um dia, um horário).

## Detalhes técnicos

Arquivo: `src/pages/AgendaTreinos.tsx`, componente `SlotDialog`.

- Trocar `horario_inicio`/`horario_fim` do state por `horarios: {inicio, fim}[]` mais campos auxiliares (`novoInicio`, `duracaoMin`, `serieDe`, `serieAte`, `serieIntervalo`).
- Na edição, inicializar `horarios` com o único par do slot e manter os inputs atuais de início/fim.
- Validações: cada horário precisa de fim > início; ao menos um horário e um dia; deduplicar horários repetidos na lista.
- No `mutationFn` de criação: uma consulta em `treino_slots` filtrando `modalidade`, `horario_inicio in (lista)` e `dia_semana in (dias)`; montar o conjunto de pares ocupados `dia|inicio`; inserir em lote apenas os pares novos; retornar `criados` e a lista de pares ignorados para o toast.
- Mensagem de erro quando todos os pares já existirem, no mesmo padrão atual.
