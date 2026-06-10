## Problema

A tabela `planos` tem um CHECK constraint `planos_tipo_check` que aceita apenas: `Start`, `Start+`, `Power`, `Pro`, `Max`, `Gympass/Wellhub`, `Total Pass`. Qualquer inserção de plano VIP (`VIP`, `VIP 1x/semana`, `VIP 2x/semana`, `VIP 3x/semana`, `VIP Livre`) é rejeitada pelo banco.

## Solução

Atualizar o constraint para aceitar as variantes VIP usadas pelo código (`AddStudentDialog`, `EditStudentDialog`, etc.), que gravam o tipo como `VIP <frequência>`.

### Migração SQL

```sql
ALTER TABLE public.planos DROP CONSTRAINT planos_tipo_check;

ALTER TABLE public.planos ADD CONSTRAINT planos_tipo_check
CHECK (tipo = ANY (ARRAY[
  'Start','Start+','Power','Pro','Max',
  'Gympass/Wellhub','Total Pass',
  'VIP','VIP Livre','VIP 1x/semana','VIP 2x/semana',
  'VIP 3x/semana','VIP 4x/semana','VIP 5x/semana','VIP 6x/semana','VIP 7x/semana'
]));
```

Sem mudanças no código frontend — a lógica que monta `VIP <sufixo>` já está correta; falta apenas o banco aceitar esses valores.

## Verificação

Após a migração, refazer uma venda VIP em "Novo Aluno" e confirmar que o plano é gravado sem erro.