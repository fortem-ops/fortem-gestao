# Corrigir "Erro ao salvar" em Relatórios

## O que está acontecendo

Ao salvar um relatório (por exemplo "Relatórios Técnicos" ou "Reabilitação"), o banco recusa o registro. A tela mostra apenas "Erro ao salvar".

Causa confirmada nos registros de rede: a tabela de avaliações só aceita uma lista fixa e antiga de tipos — funcional, composicao_corporal, pliometria, forca, experimental, kinology, funcional_v2. Os tipos criados depois em Administração (relatorioforca, reabilitacao) não estão nessa lista, então qualquer salvamento deles é bloqueado.

## O que muda

1. **Liberar os tipos cadastrados**: a regra fixa do banco é substituída por uma verificação dinâmica — o tipo enviado precisa existir na tabela de Tipos/Relatórios cadastrados. Assim, todo tipo criado em Administração passa a salvar normalmente, e tipos inexistentes continuam sendo recusados.
2. **Manter compatibilidade** com os registros antigos, cujos tipos permanecem válidos.
3. **Mensagem de erro mais clara** na tela de Relatórios, indicando o motivo quando o banco recusar o registro, em vez de só "Erro ao salvar".

## Detalhes técnicos

- Migration:
  - `ALTER TABLE public.avaliacoes DROP CONSTRAINT avaliacoes_tipo_check;`
  - Trigger `BEFORE INSERT OR UPDATE` com função `SECURITY DEFINER`, `search_path = public`, que valida `NEW.tipo IN (SELECT slug FROM avaliacao_tipos)` ou nos slugs legados (`funcional`, `composicao_corporal`, `pliometria`, `forca`, `experimental`, `kinology`, `funcional_v2`), levantando exceção com mensagem descritiva caso contrário.
  - Sem alteração de RLS, grants ou dados existentes.
- Frontend: em `DynamicAssessment.tsx` (e, se aplicável, nos demais handlers de `AssessmentForm.tsx`), exibir a mensagem retornada pelo backend no toast de erro.

## Verificação

- Salvar um relatório de "Relatórios Técnicos" e um de "Reabilitação" e confirmar que aparecem no histórico.
- Conferir que Avaliações Premium (funcional_v2, composição) continuam salvando.
- Typecheck, build e testes.
