# Plano/Serviços não mostra o Start+ ativo (Marcelo Spillari Viola)

## O que está acontecendo (verificado no banco)

O aluno tem três planos marcados como ativos, todos com início em 23/04/2026:

| Plano | Tipo | Atividade | Fim | Renovação automática | Criado em |
|---|---|---|---|---|---|
| a0b6e001 | Start+ | treinamento_funcional | 23/04/2027 | sim | 14/08/2026 (renovação atual) |
| a8c68250 | Corrida - Sem Plano | corrida | 23/04/2027 | sim | 14/08/2026 |
| f15e6b96 | Start+ | treinamento_funcional | 26/07/2026 | **não** | 10/06/2026 (registro antigo) |

A aba Plano/Serviços busca os planos ativos ordenando **só por data de início**. Como as três datas de início são idênticas, o desempate é aleatório e o registro antigo (f15e6b96) pode ser escolhido como "o plano". Esse registro já venceu (26/07/2026) e não tem renovação automática, então a tela conclui "nenhum plano ativo" e não tenta o próximo candidato — mesmo existindo um Start+ vigente até 2027.

Isso divergindo de outras telas é esperado: o resumo, a listagem e o status usam a regra canônica (`fn_plano_principal_ativo` / `selecionarPlanoExibicao`, que ordenam por data de criação e escolhem o plano vigente), e por isso mostram o Start+ corretamente.

## O que fazer

1. **Unificar a seleção do plano na aba Plano/Serviços**: em vez da consulta própria com ordenação por data de início, buscar todos os planos ativos do aluno e passar pela função canônica já existente (`selecionarPlanoExibicao` em `src/lib/planoPrincipal.ts`), que:
   - ordena por data de criação (mais recente primeiro),
   - separa plano principal de planos de Corrida,
   - escolhe o primeiro plano **vigente** em vez de descartar tudo ao encontrar um vencido.
   Resultado: o Start+ vigente aparece, e o registro antigo deixa de mascarar o atual.

2. **Manter os blocos já existentes** (planos futuros, cards de Corrida, créditos de serviços, licenças) sem mudança de comportamento — apenas passam a derivar do mesmo plano escolhido.

3. **Limpeza do registro duplicado (opcional, precisa da sua confirmação)**: o Start+ antigo f15e6b96 continua com `ativo = true` apesar de vencido e substituído pela renovação de 14/08. Desativá-lo é o correto do ponto de vista de dados, mas mexe em histórico financeiro/contratos, então só faço se você autorizar. A correção do item 1 já resolve a exibição mesmo sem essa limpeza.

## Detalhes técnicos

- Arquivo principal: `src/components/student/StudentPlan.tsx`, query `["plano_ativo", student.id]` (linhas ~106–177). Substituir a lógica de escolha (`order("data_inicio")` + `find(atividade !== "corrida")` + retorno `null` quando vencido) por `selecionarPlanoExibicao(planosAtivos)`.
- A checagem de vencimento passa a usar `planoVigente()` do mesmo módulo, aplicada candidato por candidato, em vez de abortar no primeiro.
- Nenhuma alteração de schema, RLS ou função de banco no item 1.
