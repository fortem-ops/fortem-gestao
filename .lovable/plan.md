# Investigação: aluno com plano de Corrida ativo aparece como "Inativo"

## Resumo do diagnóstico

O que a tela chama de "contrato" no perfil do aluno são registros da tabela `planos`, não `contratos`. O MARCELO tem dois planos, **ambos com `ativo = true`**:

| tipo | atividade | data_fim | created_at |
|---|---|---|---|
| Start+ | treinamento_funcional | 2026-07-26 (vencido) | 10/06/2026 |
| Corrida - Sem Plano | corrida | 2027-04-23 (vigente) | 14/08/2026 13:07 |

O status exibido é calculado no frontend por `getDisplayStatus` (`src/lib/studentStatus.ts`), que só olha **um** plano — e por regra de negócio esse plano é o "principal" (`atividade = 'treinamento_funcional'`). Planos de Corrida são deliberadamente ignorados para efeito de status. Como o plano principal está vencido (26/07) e não há licença vigente, o resultado é "Inativo", mesmo com `alunos.status = 'ativo'` no banco.

Ou seja: **não é bug de ordenação nem de filtro por `tipo='plano'` vs `'servico'` — é uma regra explícita que exclui Corrida do cálculo de status.**

## Onde está cada peça

1. **Perfil do aluno** — `src/pages/StudentProfile.tsx:87-107` (query `aluno_display_status`):
   busca todos os planos com `ativo = true`, ordena por `created_at desc` e então faz
   `planos.find(p => p.atividade !== 'corrida') ?? planos[0]`.
   O comentário no código é explícito: "O status de exibição segue o plano principal (não-Corrida)".
   Por isso a tela mostra Start+ / 26-07-2026 e ignora o plano de Corrida.
   O mesmo objeto alimenta `getDisplayStatus` em `StudentProfile.tsx:124` e `StudentSummary.tsx:528`.

2. **Regra de status** — `src/lib/studentStatus.ts:30-62`: só é "Ativo" se houver licença vigente, plano auto-renovável (`isAutoRenewPlan`) ou `planEnd >= hoje`. Nota importante: **o `alunos.status` do banco não é usado** para decidir ativo/inativo — só para os casos `lead`, `prospect` e `avulso`. Então corrigir `alunos.status` no banco não muda a tela.

3. **Lista "Alunos Ativos"** — `src/pages/StudentList.tsx:186-191` e `260-270`: busca planos com `ativo = true` **sem filtrar atividade** e depois pega `planos.find(p => p.aluno_id === student.id)` — ou seja, o **primeiro plano que vier na resposta, sem ordenação nenhuma**. Aqui não há nem o `!== 'corrida'` do perfil: é indeterminístico. No caso do MARCELO ele pegou o Start+ (vencido) → `getDisplayStatus` devolve "encerrado" → o filtro de `mode = 'ativos'` (linha 332-334) o exclui da lista.

   Consequência: a lista e o perfil podem discordar entre si, e um aluno com dois planos ativos pode aparecer ou sumir dependendo da ordem devolvida pelo PostgREST.

4. **Coluna "Tipo de plano" e filtros** da lista usam o mesmo `planTipo` derivado desse plano arbitrário, então também são afetados.

## Dimensionamento (dados reais de hoje)

- Alunos com plano de Corrida ativo e vigente: **14**
- Desses, **sem** plano principal vigente (o caso do MARCELO): **4** — 3 com `alunos.status = 'ativo'` e 1 `prospect`.
- Especificamente com plano principal **vencido** + Corrida vigente: **1** (MARCELO).
- Contexto geral: dos 222 alunos com `status = 'ativo'` no banco, 25 não têm plano principal ativo e 18 têm plano principal ativo porém já vencido — esses aparecem como "Inativo" na tela pelo mesmo mecanismo, independentemente de Corrida.

## Conclusão sobre o alcance

É **sistêmico, não pontual**, e tende a crescer exatamente com o lançamento da Assessoria de Corrida: todo aluno que comprar Corrida sem ter plano principal vigente (ex-aluno que volta pela Corrida, ou corredor que só faz Corrida) vai nascer marcado como "Inativo" no perfil e ficar fora da lista de Alunos Ativos. Hoje isso já atinge 4 pessoas.

Há dois pontos separados a decidir antes de qualquer correção:

- **Regra de negócio:** aluno que só tem plano de Corrida deve contar como "Ativo"? A regra atual foi escrita de propósito para não contar. Se sim, `getDisplayStatus` precisa considerar qualquer plano vigente (ou um conceito novo de "ativo em alguma modalidade"), e possivelmente um rótulo distinto (ex.: "Ativo · Corrida").
- **Bug real independente da regra:** a `StudentList` escolhe o plano sem ordenação nem filtro de atividade, divergindo do perfil. Isso é inconsistência a corrigir de qualquer forma.

Nenhuma alteração foi feita. Posso preparar o plano de correção assim que você definir a regra de negócio do item acima.
