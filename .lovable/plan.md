## Objetivo

Na busca global de cadastros (header — "Buscar aluno… ⌘K"):
1. Exibir os grupos na ordem: **Alunos Ativos → Prospects → Leads → (Inativos por último)**.
2. Tornar a busca **insensível a acentos** (ex.: "Marcia" encontra "Márcia", "Joao" encontra "João", e vice-versa).

## Mudanças

### 1. Backend — RPC para busca sem acento
Criar função `public.search_cadastros(termo text)` usando a extensão `unaccent` (já habilitada no projeto). Ela aplica `unaccent(lower(nome)) ILIKE unaccent(lower('%termo%'))` para que acentos no termo digitado e/ou no nome armazenado sejam ignorados na comparação.

Retorna as mesmas colunas hoje consumidas pelo componente: `id, nome, telefone, status, current_pipeline_stage_id`, limitado a 40 linhas, ordenado por `nome`. `SECURITY INVOKER` para respeitar as RLS atuais de `alunos`. `GRANT EXECUTE` para `authenticated`.

### 2. Frontend — `src/components/GlobalCadastroSearch.tsx`
- Substituir o `supabase.from("alunos").select(...).ilike("nome", ...)` por `supabase.rpc("search_cadastros", { termo: t })`.
- Alterar a ordem de renderização dos grupos para uma lista explícita: `["ativo", "prospect", "lead", "inativo"]`, em vez de iterar `Object.keys(grouped)`.

Nenhum outro componente é afetado. Comportamento de navegação ao clicar e badges permanecem iguais.

## Detalhes técnicos

```sql
CREATE OR REPLACE FUNCTION public.search_cadastros(termo text)
RETURNS TABLE (
  id uuid, nome text, telefone text,
  status text, current_pipeline_stage_id uuid
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT a.id, a.nome, a.telefone, a.status, a.current_pipeline_stage_id
  FROM public.alunos a
  WHERE unaccent(lower(a.nome)) ILIKE unaccent(lower('%' || termo || '%'))
  ORDER BY a.nome
  LIMIT 40;
$$;
GRANT EXECUTE ON FUNCTION public.search_cadastros(text) TO authenticated;
```

No componente, a ordem de exibição passa a ser fixa (Ativos primeiro, Inativos por último), atendendo ao pedido.
