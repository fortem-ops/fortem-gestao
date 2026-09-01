# Perfil do aluno: visão técnica para professores

## Objetivo

Quando o login for de professor (sem papel de coordenador/admin), o perfil do aluno mostra apenas as abas técnicas:

Resumo · Treinos · Frequência · Avaliações · Tarefas · Observações · Uploads

Ficam ocultas: Pipeline, Clube FORTEM, Plano/Serviços, Carteira e Pagamentos.

Coordenadores e admins continuam vendo todas as abas, sem nenhuma mudança.

## Comportamento

- As abas comerciais/financeiras não aparecem na barra e seu conteúdo não é montado.
- Acesso direto por link (`?tab=plano`, `?tab=contrato`, etc.) para um professor cai em "Resumo", em vez de abrir uma aba escondida.
- Nutricionista e fisioterapeuta seguem a mesma regra técnica já aplicada hoje no restante do sistema.

## Detalhes técnicos

Em `src/pages/StudentProfile.tsx`:
- Usar o hook existente `useUserRoles()` e derivar `podeVerComercial = roles?.isCoordAdmin`.
- Montar a lista de abas válidas dinamicamente: base técnica sempre, mais `pipeline`, `clube`, `plano`, `financeiro`, `contrato` apenas quando `podeVerComercial`.
- Renderizar condicionalmente os `TabsTrigger` e `TabsContent` dessas cinco abas com o mesmo critério.
- Enquanto os papéis ainda carregam, não renderizar as abas restritas (evita piscar conteúdo).

Nada de mudança em RLS, dados ou nos componentes de cada aba.
