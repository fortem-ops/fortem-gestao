## Objetivo

Permitir que ao agendar uma atividade que consome crédito (Avaliação Funcional, Consulta Nutricional, Consulta Reabilitação, etc.), o usuário escolha de qual **origem** o crédito será debitado quando o aluno tiver saldo em **Plano Contratado** E em **Serviços e Créditos Contratados** ao mesmo tempo.

Quando houver saldo em apenas uma das origens, o sistema usa essa origem automaticamente (comportamento atual).

A parte "Quando realizada uma Venda de Serviço, a informação de Créditos aparece em Serviços e Créditos Contratados" **já funciona hoje** — `fn_processar_venda` insere a linha em `creditos_aluno` com `origem_tipo='servico'`, e o componente `StudentServicos` lista créditos dessa origem. Não há mudança nessa parte; apenas confirmar o comportamento.

## Estado atual relevante

- Trigger `fn_agenda_debitar_credito` faz FIFO por `data_validade NULLS LAST, created_at`, sem distinguir origem (plano/serviço).
- `AddAgendaDialog` mostra um único bloco resumido com badges "Plano" e "Serviço" quando ambas existem, mas não deixa o usuário escolher.
- `creditos_aluno.origem_tipo` é o enum 'plano' | 'servico'.

## Mudanças

### 1. Banco

Migração:
- `ALTER TABLE agenda_servicos ADD COLUMN credito_origem text NULL CHECK (credito_origem IN ('plano','servico'))`.
- Alterar `fn_agenda_debitar_credito` para, ao buscar o crédito FIFO, aplicar `AND (NEW.credito_origem IS NULL OR origem_tipo = NEW.credito_origem)`. Resto da lógica preservado (FIFO por validade/criado).
- Estorno (`fn_agenda_estornar_credito`) já opera por `creditos_movimentos.agenda_id`, não precisa mudar.

### 2. Edge function

Sem alteração — a notificação de email não depende disso.

### 3. Frontend — `AddAgendaDialog.tsx`

- Query de créditos passa a retornar resumo por origem:
  `{ plano: { temLinhas, ilimitado, restante }, servico: { ... }, qualquerCom Saldo }`.
- Novo estado `creditoOrigem: '' | 'plano' | 'servico'`.
- Regra de exibição:
  - Se ambas as origens têm saldo (ilimitado ou restante > 0) → renderiza `RadioGroup` "Usar crédito de:" com duas opções:
    - **Plano contratado** — mostra restante/ilimitado
    - **Serviço avulso** — mostra restante/ilimitado
  - Se só uma tem saldo → não mostra seletor; `creditoOrigem` é preenchido automaticamente com a origem disponível (apenas para exibição; o backend continua decidindo).
  - `canSubmit` exige seleção quando ambas as origens estão disponíveis.
- Resumo de saldo no card já existente passa a refletir a origem escolhida.
- Payload do insert envia `credito_origem` quando definido.

### 4. Frontend — `StudentServicos.tsx` / `StudentPlan.tsx`

Sem alterações funcionais. Apenas confirmar via leitura que créditos de venda de serviço aparecem em "Serviços e Créditos Contratados" — já estão.

## Detalhes técnicos

```text
supabase/migrations/...  (coluna + alter trigger function)
src/components/agenda/AddAgendaDialog.tsx  (query, estado, UI seletor, payload)
```

Atividades elegíveis para crédito permanecem definidas em `ATIVIDADES_COM_CREDITO` no dialog (já inclui Avaliação Funcional, Consulta Nutricional, Consulta Reabilitação). Nenhuma nova lista hardcoded.
