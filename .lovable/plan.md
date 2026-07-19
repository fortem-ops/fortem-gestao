## Objetivo

Duas mudanças na tela **Agenda de Treinos → aba Horários** (rota `/agenda-treinos`):

1. **Grade semanal sem quebra** — mostrar cada horário como uma linha única atravessando os 7 dias, no estilo da imagem de referência (uma célula por dia contendo horário + ocupação + instrutor), removendo o layout atual de altura proporcional que causa sobreposição/quebra visual.
2. **Clique no card de horário** — abre um painel lateral (Sheet) com a lista de alunos agendados naquela data+horário e ações: **Presente**, **Falta** e **Excluir com estorno** (esta última restrita a Admin).

Nada muda no portal do aluno nem na aba "Agendamentos".

---

## 1. Nova Grade Semanal (substitui `WeeklyGrid`)

Layout inspirado na referência (Tecnofit), adaptado ao dark theme:

```text
              Dom 12   Seg 13   Ter 14   Qua 15   Qui 16   Sex 17   Sáb 18
06:00 – 06:30  ·        3/8      1/8      2/8      —        4/8      ·
06:30 – 07:00  ·        4/5      4/5      3/5      5/5      2/5      ·
07:00 – 08:00  ·        5/5      4/6      1/5      3/6      4/5      ·
...
```

- Navegador de semana no topo: `‹  Semana de 13 – 19 out  ›` + botão "Hoje" + Popover com calendário para pular.
- Uma **linha por combinação única `horario_inicio–horario_fim`** presente nos slots ativos. Ordenadas por horário.
- 8 colunas: rótulo do horário + 7 dias (Dom–Sáb) com cabeçalho mostrando dia da semana + número (destaque para "hoje").
- Cada célula representa o slot daquele dia+horário (se existir):
  - Ocupação `X/Y` com cor: verde se `X<Y`, âmbar se `X==Y`, cinza se sem slot.
  - Nome curto do instrutor abaixo (truncado).
  - `bg-primary/10 border-primary/30` para slot ativo com vagas; âmbar se cheio; muted se inativo; célula vazia (sem slot) mostra apenas ponto neutro `·`.
- Slots inativos aparecem esmaecidos com badge "off" pequena.
- Sem sobreposição, sem altura variável: `grid-template-rows: auto repeat(N, 44px)` — a grade não quebra nem estica.
- Scroll horizontal em telas < 900 px (mantém as 7 colunas).
- Botão "Novo Horário" continua no topo. Botão discreto "Editar horário" dentro do popover (item 2).

Ocupação por célula = número de agendamentos daquele `slot_id` na data específica da coluna, com `status IN ('agendado','confirmado','realizado')`. Faltas e cancelamentos não contam para ocupação.

## 2. Painel de alunos ao clicar em um horário

Clicar em uma célula com slot abre um **Sheet lateral** (`components/ui/sheet`) com:

- Cabeçalho: `Terça, 14 out · 07:00–08:00` + nome do instrutor + ocupação `4/6`.
- Botão pequeno "Editar horário" (abre o `SlotDialog` existente).
- Lista dos alunos daquele slot+data ordenada por status/nome, mostrando:
  - Nome do aluno + badge de status (`agendado`, `confirmado`, `realizado`, `faltou`, `cancelado`) usando `STATUS_STYLES` existente.
  - Ações inline para status `agendado`/`confirmado`:
    - **Presente** → `UPDATE status='realizado'`
    - **Falta** → `UPDATE status='faltou'`
  - Ação **Excluir com estorno** (ícone lixeira, `text-destructive`): visível **apenas se `hasRole('admin')`**. Confirma via `AlertDialog` explicando que o crédito voltará para o aluno.
- Se sem alunos agendados: estado vazio "Nenhum aluno agendado neste horário".
- Refetch automático dos agendamentos e ocupação após qualquer ação.

## 3. Backend: nova RPC para exclusão com estorno pelo staff

A RPC atual `fn_cancelar_treino_agendamento` só funciona para o próprio aluno (usa `fn_current_aluno_id`) e depende do prazo de 1h. Precisa de uma variante para staff:

```sql
CREATE OR REPLACE FUNCTION public.fn_staff_excluir_treino_agendamento(
  p_agendamento_id uuid,
  p_estornar boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _ag treino_agendamentos%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;

  SELECT * INTO _ag FROM treino_agendamentos WHERE id = p_agendamento_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'nao_encontrado');
  END IF;

  IF p_estornar AND _ag.credito_debitado AND _ag.ciclo_id IS NOT NULL AND NOT COALESCE(_ag.credito_estornado, false) THEN
    UPDATE ciclos_credito
    SET creditos_usados = GREATEST(0, creditos_usados - 1)
    WHERE id = _ag.ciclo_id;
  END IF;

  UPDATE treino_agendamentos SET
    status = 'cancelado',
    cancelado_em = now(),
    cancelado_por = 'staff',
    credito_estornado = p_estornar
  WHERE id = p_agendamento_id;

  RETURN jsonb_build_object('ok', true, 'credito_estornado', p_estornar);
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_staff_excluir_treino_agendamento(uuid, boolean) TO authenticated;
```

Presente/Falta continuam usando `UPDATE treino_agendamentos SET status=…` direto pela política RLS `staff_all_treino_agendamentos` já existente.

## 4. Detalhes técnicos

- Arquivo alterado: `src/pages/AgendaTreinos.tsx` — substituir componente `WeeklyGrid` e adicionar `SlotDetailSheet`.
- Novo hook local para a semana selecionada + query única `treino_agendamentos` no range `data BETWEEN inicioSemana AND fimSemana` (uma round-trip), indexado por `slot_id + data` para calcular ocupação em O(1) por célula.
- `useUserRoles` (já existe) para gate do botão de exclusão.
- Migration nova apenas para a RPC acima; nada muda em `treino_slots`/`treino_agendamentos`/RLS.
- Toasts: `toastSuccess` para cada ação; `toastError` em falha da RPC.
- Preserva a aba "Lista por dia" e o comportamento atual da aba "Agendamentos".
