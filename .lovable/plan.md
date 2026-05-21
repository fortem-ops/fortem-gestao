## Objetivo
Permitir, na página **Prospects**, visualizar o relatório da avaliação do treino experimental já preenchido para o prospect — sem precisar abrir o perfil do aluno.

## Mudanças

**Arquivo:** `src/pages/Prospects.tsx`

1. Na query `prospects-list`, buscar também a última `avaliacoes` de cada prospect com `tipo = 'experimental'`:
   - `supabase.from("avaliacoes").select("id, aluno_id, data, dados, tipo, protocolo_id, observacoes, avaliador_id, arquivo_url, created_at, updated_at").in("aluno_id", ids).eq("tipo","experimental").order("created_at", { ascending:false })`
   - Reduzir para a mais recente por `aluno_id` e expor como `ultimaAvaliacaoExperimental` em cada linha.

2. Adicionar novo botão de ação por linha (ícone `FileText` do lucide), exibido apenas se existir avaliação experimental:
   - Título: "Ver avaliação experimental".
   - Ao clicar, abre `AssessmentViewerDialog` com a avaliação e o aluno carregados.

3. Adicionar estado `viewerTarget: { avaliacao, student } | null` e renderizar `<AssessmentViewerDialog open={!!viewerTarget} avaliacao={viewerTarget?.avaliacao ?? null} student={viewerTarget?.student} onOpenChange={...} />` no final do componente.
   - O componente já existe em `src/components/student/assessment/AssessmentViewerDialog.tsx` e aceita `Tables<"alunos">` + `Tables<"avaliacoes">`. Para evitar refetch do aluno completo, fazer um `supabase.from("alunos").select("*").eq("id", id).single()` on-demand ao abrir o viewer.

4. Não alterar layout/colunas existentes; o botão entra no grupo de ações já presente, à esquerda do botão "Nova avaliação".

## Não escopado
- Nenhuma mudança em RLS, banco ou no fluxo de preenchimento da avaliação.
- Não mexer no perfil do aluno nem em Leads.