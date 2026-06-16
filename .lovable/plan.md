## Problema

No banner "Lembrete de avaliações pendentes" do Dashboard, o item de Treino Experimental aparece com a palavra genérica "Aluno" em vez do nome real (ex.: "…do aluno **Aluno**").

## Causa

Em `src/components/dashboard/LembreteAvaliacoesPendentesBanner.tsx` o nome é resolvido por `nameMap.get(o.agenda.aluno_id) || "Aluno"`. Quando o `agenda_servicos.aluno_id` aponta para um registro que não existe mais em `public.alunos` (verificado no banco: há 33 agendamentos de Treino Experimental/Avaliação Funcional com `aluno_id` órfão), o `nameMap` não tem entrada e o fallback `"Aluno"` é renderizado como se fosse o nome.

## Correção

Editar apenas `src/components/dashboard/LembreteAvaliacoesPendentesBanner.tsx`:

1. Após montar `nameMap`, **descartar** ocorrências cujo `aluno_id` não está presente no mapa (agenda órfã) — não faz sentido cobrar uma avaliação para um aluno que não existe mais.
2. Como salvaguarda, trocar o fallback `"Aluno"` por algo que torne o problema visível em vez de parecer um nome válido (ex.: usar o nome resolvido sem fallback, já que itens sem nome são filtrados na etapa 1).

Sem alteração de banco, RLS, outras telas, ou lógica de detecção de pendência.

## Validação

Recarregar o Dashboard como professor: o banner do Treino Experimental deve exibir o nome real do aluno (ex.: "…do aluno **Frederico Luiz…**"). Itens de agenda órfãos deixam de aparecer no banner.