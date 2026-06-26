## Problema

O `AjustarJornadaDialog` hoje invalida apenas 4 chaves literais (`ponto-equipe`, `ponto-fechamento-mes`, `relatorio-ponto`, `ponto-jornadas`), mas o Relatório de Ponto consome chaves diferentes — `relatorio-jornadas`, `relatorio-fechamentos`, `relatorio-banco-lancamentos`, `relatorio-eventos`, `relatorio-horarios`, `relatorio-ferias`, `relatorio-feriados`. Como nenhuma delas bate exatamente, o cache permanece, e a tela só atualiza após F5.

## Correção

Trocar as invalidações pontuais por um único `invalidateQueries` com `predicate`, cobrindo todas as queries dos módulos de ponto/relatório de ponto:

```ts
qc.invalidateQueries({
  predicate: (q) => {
    const k = q.queryKey?.[0];
    return typeof k === "string" && (k.startsWith("relatorio-") || k.startsWith("ponto-"));
  },
});
```

Aplicar em `src/components/ponto/AjustarJornadaDialog.tsx`, no `onSuccess` da mutation, substituindo as 4 linhas atuais. Também forçar `refetchType: "active"` (padrão) para garantir refetch imediato das queries visíveis.

## Verificação

- Abrir Relatório de Ponto, ajustar/registrar um ponto da Yasmim e confirmar que a linha atualiza sem reload.
- Conferir também a página `Ponto — Equipe ao vivo` (já usa `ponto-equipe`, segue funcionando).

## Escopo

Mudança isolada em um único arquivo de frontend. Nenhuma alteração de RPC, schema ou regra de negócio.
