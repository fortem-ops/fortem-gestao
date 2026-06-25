## Problema

A aba **Contrato** no perfil do aluno não ativa quando clicada — a interface volta para "Resumo".

## Causa raiz

Em `src/pages/StudentProfile.tsx`, linha 41:

```ts
const validTabs = ["resumo","pipeline","clube","plano","financeiro","treinos","avaliacoes","tarefas","observacoes","uploads"];
```

O array `validTabs` **não inclui `"contrato"`**. Como o componente `<Tabs>` é controlado por `tabValue`, ao clicar em "Contrato":
1. `onValueChange` grava `?tab=contrato` na URL;
2. no re-render, `validTabs.includes("contrato")` é `false`;
3. `tabValue` cai para `"resumo"` (fallback) — a aba nunca ativa.

Confirmado via Playwright: navegando direto para `/alunos/<id>?tab=contrato` o painel renderizado é o de Resumo.

## Correção

Uma linha em `src/pages/StudentProfile.tsx` (L41):

```ts
const validTabs = ["resumo","pipeline","clube","plano","financeiro","contrato","treinos","avaliacoes","tarefas","observacoes","uploads"];
```

## Validação

- Abrir o perfil de um aluno, clicar em **Contrato** e confirmar que o painel `<ContratoFinanceiro />` é renderizado (contrato ativo, cobranças, etc.).
- Verificar que recarregar a página em `/alunos/<id>?tab=contrato` mantém a aba ativa.