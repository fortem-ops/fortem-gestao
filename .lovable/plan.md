## Problema
Ao importar treino de outro aluno (`ImportFromStudentDialog` → `StudentPicker`), a lista para na letra **L**. Causa: o `StudentPicker` faz `supabase.from("alunos").select(...).order("nome")` sem `range`, então o PostgREST aplica o limite padrão de **1000 linhas**. Como a tabela `alunos` contém leads/prospects/inativos (milhares de registros), o corte cai no meio do alfabeto — só depois é que o filtro client-side remove os não-ativos, restando uma lista visivelmente truncada.

## Correção
**Arquivo:** `src/components/student/StudentPicker.tsx`

Mover o filtro para o **servidor** e paginar a leitura, garantindo trazer todos os ativos/licença sem depender do limite de 1000:

1. No `useQuery`, filtrar direto no banco:
   - `.in("status", ["ativo", "licenca"])` (descarta lead/prospect/inativo/encerrado server-side)
   - Manter `.order("nome")`
2. Implementar leitura paginada em loop com `.range(from, from+999)` até a página retornar menos de 1000 linhas, concatenando os resultados (mesmo padrão já usado em outras telas do projeto após o problema do limite 1000).
3. Manter o filtro extra client-side por `current_pipeline_stage_id ∈ FUNIL_STAGES` (continua removendo quem está em etapa de funil mesmo com status ativo).

Nenhuma alteração de UI, props ou comportamento de seleção — apenas a fonte de dados passa a trazer a lista completa.

## Escopo
- Único arquivo alterado: `src/components/student/StudentPicker.tsx`.
- Afeta também outros lugares que usam o `StudentPicker` (ex.: aplicar treino), corrigindo o mesmo sintoma de "lista cortada".