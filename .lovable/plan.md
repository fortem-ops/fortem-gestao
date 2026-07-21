# Plano: Corrigir lista de Alunos Ativos mostrando 0 resultados

## Contexto
- O banco possui 202 alunos `status='ativo'` com planos vigentes e as policies de RLS de `alunos` usam `is_coordenador_ou_admin()` / `is_professor_staff()`.
- As funções `is_coordenador_ou_admin()` e `is_professor_staff()` estão corretas: elas consultam `auth.uid()` da sessão ativa. O teste via ferramenta de leitura retornou `false` porque não há sessão autenticada nesse contexto.
- Portanto, o bug de "0 alunos" provavelmente está no frontend (`StudentList.tsx`), não nas policies.

## Passos

1. **Instrumentar `StudentList.tsx` com logs de diagnóstico**
   - Adicionar `console.log` em cada etapa: início do fetch, resposta bruta do Supabase, contagem de registros, após filtros, após `useMemo`.
   - Logar também o `user.id` e role do usuário logado (via `AuthContext` / `user_roles`) para confirmar que a sessão está ativa e com privilégio.

2. **Adicionar query de diagnóstico autenticada no componente**
   - Incluir uma chamada de teste que faz `SELECT count(*) FROM alunos` diretamente pelo cliente Supabase autenticado, separada da lógica principal, para confirmar se a RLS permite leitura.

3. **Revisar a lógica de filtro e exibição**
   - Verificar se a query principal usa `.range()`, `.limit()`, paginação ou ordenação que pode estar retornando vazio.
   - Confirmar se o `useMemo` que calcula "alunos ativos" não está filtrando tudo por causa de uma condição sobre planos, datas ou status.
   - Garantir que o estado de loading e erro sejam tratados de forma visível.

4. **Implementar correção e fallback robusto**
   - Corrigir o root cause identificado no passo 3.
   - Adicionar estado de erro visível com botão "Tentar novamente".
   - Adicionar retry na query principal (`retry: 2`).
   - Garantir que, se a query retornar vazio por RLS ou outro motivo, o usuário veja uma mensagem clara em vez de skeleton infinito.

5. **Validar via preview do app**
   - Verificar no console do navegador se os logs aparecem e se a lista carrega corretamente.
   - Capturar screenshot da tela de Alunos Ativos após a correção.

## Notas
- Não serão alteradas policies de RLS nem funções de role, pois elas estão corretas.
- O foco é identificar e corrigir a falha no carregamento/exibição dos dados no frontend.