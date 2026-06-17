## Objetivo

Sempre que um período de Licença (do plano ou médica) for adicionado a um aluno, a `data_fim` do plano correspondente deve ser estendida pelo mesmo número de dias bloqueados. Ao remover a licença, a extensão deve ser revertida.

## Como funciona hoje

- `aluno_licencas` guarda `plano_id`, `data_inicio`, `data_fim` e `dias`.
- `planos.data_fim` (e `planos.proxima_renovacao`, quando renovação automática está ligada) hoje **não** são alterados quando uma licença é cadastrada — o aluno perde dias de plano.

## Mudança proposta

Implementar a extensão no banco via **trigger** em `aluno_licencas`, garantindo consistência mesmo se a licença for criada/excluída por qualquer caminho (UI, edge function, importação).

### Trigger `trg_aluno_licencas_extende_plano`

- **AFTER INSERT**: soma `NEW.dias` a `planos.data_fim` do `plano_id`. Se `renovacao_automatica = true` e `proxima_renovacao` não é nula, também soma `NEW.dias` a `proxima_renovacao` (para manter o ciclo alinhado ao novo fim).
- **AFTER DELETE**: subtrai `OLD.dias` de `data_fim` (e de `proxima_renovacao` quando aplicável).
- **AFTER UPDATE de `dias`**: ajusta pela diferença (`NEW.dias - OLD.dias`). Cobre eventuais edições futuras dos campos de período.
- Só aplica quando `planos.data_fim` já existe (plano por prazo); planos sem `data_fim` são ignorados silenciosamente.

Não há mudança de schema — apenas a função e o trigger.

### Frontend

- `StudentLicencas.tsx`: após salvar/excluir licença, invalidar também as queries do plano (`["plano", alunoId]` / `["alunos_with_plans"]` — esta última já é invalidada) para que a nova `data_fim` apareça imediatamente em `StudentPlan` e nos cards/listas.
- Mostrar um toast informativo: "Licença adicionada · plano estendido em N dia(s)" / "Licença removida · plano reduzido em N dia(s)".

### Backfill

Não retroativo. Licenças já cadastradas antes desta mudança **não** ajustam planos passados — evita alterar planos já encerrados ou faturados. Se você quiser aplicar o backfill nas licenças existentes, posso adicionar como passo opcional.

## Fora de escopo

- Mudanças em RLS, cobrança, comissionamento ou regras de renovação.
- Mudança no cálculo de `dias` da licença (continua sendo inclusive nos dois extremos, como hoje).
- Tratamento de sobreposição entre múltiplas licenças (somatório direto dos dias é mantido).
