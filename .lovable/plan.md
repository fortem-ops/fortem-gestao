# Diagnóstico — Créditos do plano não aparecem em `PortalHome`

Investigação apenas — nenhuma alteração feita. Respondendo às 3 perguntas:

## 1. De onde a página interna busca os números

Arquivo: `src/components/student/StudentPlan.tsx` (é o componente que renderiza "Créditos de Serviços" no perfil/financeiro do aluno — `ContratoFinanceiro.tsx` também consulta `ciclos_credito`, mas só pra créditos de treino do ciclo, não pra Nutrição/Reabilitação/Aval. Funcional).

Query (linhas ~106-176): lê `planos` do aluno + `consumo_servicos` do plano, e **calcula** os créditos a partir do array `planos.servicos` (texto tipo `"2 Consultas Nutrição"`), sem tocar em `creditos_aluno`:

```
base     = parseServiceCount(plano.servicos, "Consultas Nutrição")   // ex.: 2
comprado = count(consumo_servicos.tipo_registro='compra')
usado    = count(consumo_servicos com agenda_id OR tipo_registro='uso_manual')
total    = base + comprado
```

Ou seja, a fonte de verdade para "1/2 usados" que aparece na tela interna é `planos.servicos` (JSON de texto) + `consumo_servicos` — **não** `creditos_aluno`.

## 2. Existe linha `creditos_aluno` com `origem_tipo='plano'` para Bruna?

`aluno_id` da Bruna: `b7f99527-9f4a-448b-9cca-78017bbc0cb2` (`teste.pro@fortem.app`).

Resultado da consulta em `creditos_aluno`:

| origem_tipo | atividade | ativo | inicial | usada |
|---|---|---|---|---|
| servico     | Nutrição  | true  | 4       | 1     |

Ou seja: **nenhuma linha com `origem_tipo='plano'`**. Existe apenas 1 crédito avulso ("servico") de Nutrição, comprado à parte. Nada de plano.

Cross-check com o restante dos dados dela:
- `planos`: 1 registro Pro ativo, `servicos = {"2 Avaliação Funcional","2 Consultas Nutrição","2 Consultas Reabilitação"}`, vigência 12/01/2026–12/01/2027.
- `consumo_servicos`: 1 Aval. Funcional + 2 Consultas Nutrição, todos `tipo_registro='uso_manual'`. É daí que sai o "1/2" e "2/2" que aparece internamente.

Isso confirma: as linhas de `creditos_aluno` origem_tipo='plano' para serviços inclusos **nunca foram criadas** para ela.

## 3. Existe trigger/função que deveria popular essas linhas?

Sim, existe uma trigger em `planos` (`trg_sync_creditos_on_plano_change` → `fn_sync_creditos_on_plano_change`), **mas ela só desativa créditos quando o plano é desativado — nunca cria linha nenhuma.**

O único lugar do banco que insere `creditos_aluno` com `origem_tipo='plano'` é `fn_processar_venda` (trigger em `vendas`), e mesmo assim ela cria **apenas 1 linha por venda de plano, com `atividade='Treino'`** — usa `planos_catalogo.quantidade_creditos`. Não cria linhas separadas para Avaliação Funcional / Nutrição / Reabilitação. Esses serviços vivem exclusivamente no array `planos.servicos` + `consumo_servicos`.

Ou seja: **o modelo atual nunca materializa serviços inclusos no plano em `creditos_aluno`**, para nenhum aluno — não é um problema específico da Bruna nem de contratos migrados. É consequência de dois modelos paralelos:

- **Modelo A (interno / StudentPlan / ContratoFinanceiro):** `planos.servicos` (texto) + `consumo_servicos`.
- **Modelo B (Portal / `PortalHome` seção "Incluso no seu Plano"):** `creditos_aluno` com `origem_tipo='plano'`.

O Portal foi escrito assumindo o Modelo B, que ninguém popula para serviços de plano — só para Treino (via venda) e para serviços avulsos.

Adicional: o plano da Bruna aparentemente nem passou pelo `fn_processar_venda` (não há sequer a linha `Treino` origem_tipo='plano'), então provavelmente foi criado manualmente/importado direto na tabela `planos`. Isso reforça que o problema é do modelo, mas há também um caso à parte de "planos que nunca geraram nenhum crédito porque não vieram por venda".

---

## Como quer seguir?

Três caminhos possíveis para o fix (só pra alinhar antes de eu escrever o plano de implementação):

**(a) Ajustar o Portal para ler o mesmo modelo do interno.** Trocar a query da seção "Incluso no seu Plano" em `PortalHome.tsx` para ler `planos.servicos` + `consumo_servicos` (igual `StudentPlan`). Mudança só de front, zero migração. Rápido e resolve todos os alunos, inclusive os já existentes. Deixa de fora quem só usa `creditos_aluno` como fonte, mas nesse ponto ninguém usa esse modelo para serviços de plano.

**(b) Popular `creditos_aluno` retroativamente + criar trigger em `planos`.** Backfill de linhas `origem_tipo='plano'` para cada item em `planos.servicos` de todos os planos ativos, com `quantidade_usada` derivada de `consumo_servicos`. Mais uma trigger `AFTER INSERT/UPDATE` em `planos` para manter sincronizado dali pra frente. Manteria o Portal como está, mas duplica fonte de verdade (risco de drift entre `creditos_aluno.quantidade_usada` e `consumo_servicos`).

**(c) Híbrido:** só backfill + trigger, mas fazendo `creditos_aluno` uma view materializada / apontar Portal para uma view que UNION `creditos_aluno` (avulsos) + derivado de `planos.servicos` (inclusos). Mais correto conceitualmente, mais trabalho.

Minha recomendação é **(a)** — é o caminho de menor risco e alinha as duas telas na mesma fonte de verdade que já é usada em toda a operação hoje (venda, agenda, consumo manual). Me diz qual seguir que eu já monto o plano de implementação.
