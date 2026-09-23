# Diagnóstico do estorno na aba de contrato do aluno (somente leitura)

Tela analisada: `src/pages/alunos/ContratoFinanceiro.tsx` (tabela "Cobranças" com # / Vencimento / Pgto / Valor / Status / Recebido via / TID / Ação). `TimelineCobrancas.tsx` não foi considerada.

Estado real conferido no banco para o contrato `5e7a99f7-...`: ciclos 10 e 11 estão `estornado` (com TID e `data_pagamento` 19/09 preservados), ciclo 12 `pendente`. Em `pagamentos_rede` há 2 registros `kind=refund / status=refunded` de R$ 559,00 cada, com motivo "Cobrança equivocada".

## 1) "Dar baixa" em cobrança estornada — ATENDE, com 1 ressalva

Comprovação (linhas 861-871): o botão aparece para `pendente`, `atrasado` **e** `estornado`.

```tsx
{(c.status === "pendente" || c.status === "atrasado" || c.status === "estornado") && (
  <Button ...>Dar baixa</Button>
)}
```

O que a baixa grava (`handleBaixa`, linhas 283-307):

```tsx
.update({
  status: "pago",
  data_pagamento: baixaData,
  forma_pagamento: forma.value,
  gateway: forma.gateway,
  meio_registro: "manual_admin",
  ...(baixaCobranca.status === "estornado" ? { tid: null } : {}),
})
```

- `status` → `pago`; `data_pagamento` → data informada; `forma_pagamento`/`gateway` → os da forma manual escolhida (`src/lib/formasRecebimento.ts`: dinheiro, inter_pix, maquina, rede, boleto); `meio_registro` → `manual_admin`.
- `tid` é **zerado** só quando a cobrança estava `estornado` — não sobra TID antigo. Como o botão "Estornar" exige `c.tid` (linha 803), não há caminho para reestornar. Sem resquício que confunda o Fiscal.
- Inadimplência aberta é regularizada e a venda vinculada é propagada (`propagarBaixaParaVenda`, que nunca reativa venda `cancelado`/`estornado`).

**Ressalva (defeito visual real):** depois da baixa a cobrança volta a `pago`, mas os refunds continuam ligados a ela, e a regra do selo é `totalEstornado > 0 && c.status !== "estornado"` (linha 801). Resultado: a linha passa a exibir "Estorno parcial R$ 559,00 de R$ 559,00" mesmo tendo sido estorno **total** já recebido de novo.

## 2) Diálogo "Estornar" — ATENDE

`src/components/financeiro/EstornarCobrancaDialog.tsx`: opções Total/Parcial (RadioGroup), campo de valor no parcial, motivo obrigatório com mínimo de 10 caracteres, botão travado durante o envio.

```tsx
const valorValido = tipo === "total"
  ? disponivel > 0
  : Number.isFinite(valorNumerico) && valorNumerico > 0 && valorNumerico <= disponivel + 0.001;
```

O saldo vem do servidor (`fn_cobranca_saldo_estornavel` = valor pago − refunds confirmados do TID), nunca calculado no cliente.

Após estorno **parcial**, `fn_estorno_confirmar` (migração 0040) só troca o status quando `v_integral` é verdadeiro — ou seja, a cobrança **continua `pago`**, e a tabela mostra o selo laranja "Estorno parcial R$ X de R$ Y" mais o botão "Comprovante". O saldo restante não é escrito literalmente na linha (fica implícito na diferença) — aparece explicitamente no diálogo e no comprovante.

## 3) Regra desejada — ATENDIDA, exceto o selo

- 100% estornado → `status = 'estornado'` (`UPDATE public.cobrancas SET status = 'estornado'` em `fn_estorno_confirmar`) e "Dar baixa" disponível: OK.
- Sem inadimplência nova: o estorno integral ainda **cancela** a inadimplência aberta daquela cobrança, e nenhuma rotina cria inadimplência a partir de `estornado`.
- Sem nova tentativa automática: `cobrar-recorrencias-diario` seleciona apenas `.in("status", ["pendente","atrasado"])`, então `estornado` nunca é recobrado. (A recorrência segue desligada de qualquer forma.)
- Parcial → continua `pago` com o selo: OK, com o texto do selo a corrigir no caso pós-baixa (item 1).

## 4) Fiscal de pagamentos — ATENDE

`fn_auditoria_fiscal_pagamentos` (migração 0038) filtra `AND c.status NOT IN ('cancelado', 'estornado')` nos dois achados que varrem cobranças (`cobranca_sem_contrato_ativo` e `valor_divergente_plano`); `cobranca_pendente_sem_retry` só olha `pendente`. No estorno parcial o valor da cobrança não muda, então nenhum achado falso é gerado.

## O que falta — ajuste mínimo (1 linha, sem banco)

Em `src/pages/alunos/ContratoFinanceiro.tsx`, linha 801, restringir o selo ao estorno realmente parcial:

```tsx
const estornoParcial =
  totalEstornado > 0 &&
  c.status !== "estornado" &&
  totalEstornado < Number(c.valor) - 0.001;
```

Opcional (também só de tela): quando `totalEstornado >= valor` e o status já é `pago` de novo, mostrar um selo neutro do tipo "Estornado e recebido novamente", para o histórico ficar legível.

Nada mais precisa mudar: migrações, edge function, saldo, comprovante e Fiscal já cobrem as regras 1 a 4.
