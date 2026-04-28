# Recolocar "Periodicidade" como validade em dias (sem renovação)

A "Periodicidade" volta ao formulário de novo benefício, mas agora como **validade em dias** a partir da data de criação. Sem renovação automática: passados os N dias, o benefício expira.

## Mudanças

### `src/components/clube/AdminBeneficiosTable.tsx`
- Adicionar no formulário um campo **"Periodicidade (validade)"** como `Select`, logo abaixo de "Tipo", com as opções:
  - 7 dias, 15 dias, 30 dias (default), 60 dias, 90 dias, 180 dias, 365 dias
  - "Personalizado" → revela `Input` numérico para digitar a quantidade de dias
  - "Sem prazo de validade"
- Estender `emptyForm` com `validade_opcao` (string) e `validade_dias_custom` (string).
- No `openEdit`, derivar a opção a partir de `b.data_fim`:
  - Se `data_fim` for nula → `"sem_prazo"`.
  - Se `data_fim - data_inicio` bater com uma opção pré-definida → seleciona essa opção.
  - Caso contrário → `"custom"` com o número de dias preenchido.
- No `save()`, calcular `data_fim` a partir da opção:
  - `sem_prazo` → `data_fim = null`.
  - opção numérica ou custom → `data_fim = data_inicio + dias` (no insert, `data_inicio` recebe o default de hoje; no update, usar `data_inicio` atual do registro carregado).
  - Validar `custom`: exigir inteiro ≥ 1.
- Remover o uso de `PERIODO_LABEL` na coluna "Limite" da tabela (já feito anteriormente — manter como `"X usos"` ou `"Livre"`).
- Continuar enviando `periodicidade: 'livre'` no payload (campo legado do enum, sem efeito na validação).
- Adicionar coluna **"Validade"** na tabela exibindo `"30 dias"`, `"Sem prazo"` ou data de fim formatada (`até dd/mm/aaaa`).

### Banco
- Sem migração nova. A função `fn_clube_validar_token` já recusa benefícios fora do intervalo `data_inicio..data_fim`, então a expiração após N dias passa a funcionar automaticamente.

## Fora do escopo
- Não reintroduzimos o enum visual `dia/semana/mês` como periodicidade de uso (essa lógica de renovação foi removida na iteração anterior e continua removida).
- Não adicionamos DatePicker para `data_inicio`/`data_fim` (o controle continua sendo só "validade em dias").
