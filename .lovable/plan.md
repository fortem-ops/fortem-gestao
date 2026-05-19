## Objetivo

Corrigir a atribuição da comissão de R$35 da Avaliação Funcional para ir sempre ao **profissional do agendamento da avaliação**, e não ao ADM que registrou.

## Causa raiz

Em `trg_comissao_avaliacao_insert` (e `trg_comissao_anexo_insert`), quando não existe pendência aberta `concluir_avaliacao_funcional` (criada pelo INSERT em `agenda_servicos` com atividade "Avaliação Funcional"), o sistema faz fallback para `NEW.avaliador_id` — que é o ADM logado. Resultado: comissão cai para o ADM.

## Mudança (uma migration)

Substituir `CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_insert()` com esta cadeia de fallback para `_profissional`:

1. `profissional_id` da pendência aberta `concluir_avaliacao_funcional` (igual hoje).
2. Se nulo: buscar em `agenda_servicos` o agendamento mais recente do mesmo `aluno_id` com `atividade ILIKE '%avaliação funcional%' OR atividade ILIKE '%avaliacao funcional%'` cuja `data_especifica` (ou geração da semana) seja ≤ `NEW.data` e mais próxima — pegar `profissional_id`.
3. Se ainda nulo: `alunos.responsavel_id`.
4. Se o resultado for ADM (verificar via `has_role(_profissional, 'admin')`), aplicar fallback 3.
5. Nunca atribuir ao ADM: se ao final continuar admin/nulo, **não gerar comissão** e registrar pendência `concluir_avaliacao_funcional` órfã (descrição: "Sem profissional vinculado — revisar").

Mesma cadeia aplicada em `trg_comissao_anexo_insert` quando `_pend.profissional_id` for nulo ou admin.

## Backfill (opcional, na mesma migration)

Para comissões já criadas com `tipo='avaliacao_funcional'` cujo `profissional_id` seja ADM:
- Recalcular usando a mesma lógica (passos 2→3) e fazer `UPDATE` em `comissionamentos.profissional_id`.
- Se não encontrar substituto, marcar `status='cancelado'` com observação "Reatribuição manual necessária".

## Sem mudanças

- Frontend (`Comissionamentos.tsx`, hooks): nenhuma alteração — RLS `profissional_id = auth.uid() OR coord/admin` já cobre o novo destinatário.
- Regras de Treino Experimental e Carteira: inalteradas.

## Detalhes técnicos

```sql
-- pseudo da resolução
SELECT profissional_id INTO _profissional
FROM agenda_servicos
WHERE aluno_id = NEW.aluno_id
  AND (atividade ILIKE '%funcional%')
  AND COALESCE(data_especifica, CURRENT_DATE) <= NEW.data
ORDER BY COALESCE(data_especifica, NEW.data) DESC, created_at DESC
LIMIT 1;

IF _profissional IS NULL OR public.has_role(_profissional, 'admin') THEN
  SELECT responsavel_id INTO _profissional FROM alunos WHERE id = NEW.aluno_id;
END IF;

IF _profissional IS NULL OR public.has_role(_profissional, 'admin') THEN
  -- não gera comissão; cria pendência órfã
END IF;
```
