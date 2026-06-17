## Problemas

### 1. Consultor não salva (na edição)
`src/pages/Agenda.tsx` faz `select(...)` sem `consultor_id`. Ao abrir o diálogo para **editar** um evento de Treino Experimental, `editEvent.consultor_id` é `undefined` → o estado `consultorId` vira `""` → ao salvar, o payload envia `consultor_id: null` e apaga o valor já gravado.

Em criação novo o salvamento funciona (confirmado no banco), o problema acontece no fluxo de edição.

### 2. Local não é preenchido automaticamente pela atividade

## Mudanças

### `src/pages/Agenda.tsx`
- Incluir `consultor_id` no `select` de `agenda_servicos` (linha do `useQuery` principal), para que o `editEvent` carregue o consultor atual e o diálogo prefille corretamente.

### `src/components/agenda/AddAgendaDialog.tsx`
- Criar mapa `ATIVIDADE_LOCAL_PADRAO`:
  - `Treino Experimental` → `Sala de Treinamento`
  - `Reabilitação` → `Sala de Reabilitação`
  - `Recovery (Bota de Compressão)` → `Sala de Reabilitação`
  - `Nutrição` → `Sala de Nutrição`
  - `Avaliação Física` → `Sala de Nutrição`
  - (Demais atividades — ex.: `Avaliação Funcional` — continuam sem preenchimento automático.)
- Em um `useEffect` que observa `atividade`: se existir local padrão para a atividade selecionada, setar `setLocal(local_padrao)`. O campo Local continua editável (o usuário pode trocar manualmente depois).
  - Para evitar sobrescrever ao reabrir um evento em edição com local diferente, o efeito só dispara quando `atividade` muda por interação do usuário; durante o prefill/edit o `setLocal(editEvent.local)` já roda primeiro.

Sem mudanças em banco, RLS ou edge functions.

## Fora de escopo
- Não alterar a lista `LOCAIS` nem regras de notificação.
