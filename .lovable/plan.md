## Problema

A aba "Financeiro" do perfil do aluno nunca abre, mesmo clicando nela. A URL muda para `?tab=financeiro`, mas a interface volta para "Resumo".

## Causa

Em `src/pages/StudentProfile.tsx` (linha 40), a lista de abas válidas que valida o parâmetro `tab` da URL não inclui `"financeiro"`:

```ts
const validTabs = ["resumo","pipeline","clube","plano","treinos","avaliacoes","tarefas","observacoes","uploads"];
```

Quando o valor não está na lista, o componente força o fallback para `"resumo"`, escondendo a aba Financeiro.

## Correção

Adicionar `"financeiro"` ao array `validTabs`, na mesma posição em que aparece na `TabsList` (logo após `"plano"`):

```ts
const validTabs = ["resumo","pipeline","clube","plano","financeiro","treinos","avaliacoes","tarefas","observacoes","uploads"];
```

Mudança de uma linha, sem efeitos colaterais. Após isso, o fluxo completo do Pix Automático (ativar recorrência → solicitar confirmação no app do Inter → gerar cobrança mensal → webhook) já fica acessível pela aba.

## Verificação

Abrir `/alunos/<id>?tab=financeiro` e confirmar que a aba renderiza o `StudentFinanceiro` com o `PixAutomaticoSection`.
