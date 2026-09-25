# Converter Lead/Prospect em Cliente Avulso

## O que muda para o usuário

Um novo botão **"Converter em cliente avulso"** aparece em três lugares:

1. **Perfil do aluno** (painel de Pipeline) — quando o cadastro está como lead ou prospect.
2. **Pipeline** — no card (menu de ações) e no painel lateral do card, somente no funil Prospects.
3. **Cadastros > Leads e Cadastros > Prospects** — nas ações de cada linha, ao lado de "Converter em Prospect"/"Converter em Aluno".

Ao clicar, abre uma confirmação curta com campo opcional de observação (ex.: "Só quer Nutrição"). Ao confirmar:

- O cadastro passa a ser **Cliente Avulso** e aparece em Clientes Avulsos.
- Sai do funil comercial (não conta mais como lead em aberto nem gera alertas do Fiscal de Pipeline).
- Dados, histórico, anamnese e origem do lead são mantidos.
- A partir daí, a venda de serviços avulsos segue o fluxo normal.

Quem pode: Coordenação, Administração, Nutricionista e Fisioterapeuta (mesma regra do cadastro de avulsos). Professores não veem o botão.

Nada muda em preços, contratos, créditos ou nos demais fluxos de conversão.

## Detalhes técnicos

- **Migração**: nova função `fn_converter_em_avulso(_aluno_id uuid, _observacao text)` SECURITY DEFINER, `search_path=public`, EXECUTE apenas `authenticated`. Valida papel (`is_coordinator_or_admin` ou `has_role` nutri/fisio) e que o aluno está em etapa do funil Prospects ou com status lead/prospect. Atualiza `alunos.status='avulso'`, `current_pipeline_stage_id=null`; registra a observação em `pipeline_metadata` (nota) e em `audit_log`. Antes de gravar, confirmar no schema se `pipeline_movements.to_stage_id` aceita nulo — se aceitar, registra movimento "Convertido em cliente avulso"; se não, fica só o audit_log.
- **Frontend**:
  - `src/lib/leads.ts`: `convertToAvulso(alunoId, observacao)`.
  - Novo `src/components/leads/ConvertToAvulsoDialog.tsx` (AlertDialog + Textarea, sonner).
  - Pontos de uso: `StudentPipelinePanel.tsx`, `PipelineCard.tsx`, `PipelineLeadDrawer.tsx`, `src/pages/Leads.tsx`, `src/pages/Prospects.tsx`; visibilidade via `useUserRoles` (`isCoordAdmin || isNutriFisio`).
  - Invalidações: `pipeline-alunos`, `leads-list`, `prospects-list`, `clientes-avulsos`, perfil do aluno.
- Fiscal de Pipeline já ignora quem não tem etapa; nenhum ajuste necessário.
