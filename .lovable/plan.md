## Causa raiz

Ao marcar presença em `/presencas`, o trigger `trg_presenca_experimental_to_prospect` é disparado e tenta inserir em `pipeline_movements` com `source = 'system'`. Porém o enum `pipeline_movement_source` só aceita: `manual`, `auto_avaliacao`, `auto_plano`, `auto_agenda`, `auto_evasao`, `auto_recuperacao`.

Isso lança o erro Postgres `22P02` (invalid_text_representation), que o `classifyError` mapeia para "Dados inválidos / Verifique os campos preenchidos…". Por isso a marcação falha mesmo com payload correto no frontend.

## Correção

Migration única recriando a função `trigger_presenca_experimental_to_prospect` trocando `source = 'system'` por `source = 'auto_agenda'` (valor de enum válido e semanticamente correto — movimentação automática originada pela agenda/presença). Nenhuma mudança de schema, nenhuma mudança no frontend.

## Validação

- Ler a função após a migration para confirmar o novo valor.
- Marcar presença em uma aula experimental e em uma aula comum no preview para garantir que ambas funcionem.
