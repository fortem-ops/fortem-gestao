# Cadastros > Alunos Perdidos

## Situação atual
Claudete Kist está na etapa "Aluno perdido" do funil. Hoje 60 cadastros estão nessa etapa. Leads e Prospects só listam as etapas abertas do funil, por isso ela não aparece em nenhuma lista de Cadastros.

## O que será feito
1. Novo item no menu: **Cadastros > Alunos Perdidos**, logo depois de Clientes Avulsos.
2. Nova página com todos os cadastros na etapa "Aluno perdido": nome, telefone, responsável, motivo da perda, data em que foi perdido e a última etapa antes da perda. Busca por nome e filtro por motivo e por responsável.
3. Ações em cada linha (só Coordenação e Administração; Nutri/Fisio só no avulso, igual ao que já existe):
   - **Retomar**: escolher uma etapa do funil Prospects (Novo lead, Informações encaminhadas, Prospect, Treino experimental agendado, Follow Up). Já vem sugerida a etapa em que estava antes da perda. O motivo da perda é apagado e a mudança fica no histórico do funil.
   - **Converter em cliente avulso**: usa o botão que já existe.
   - **Converter em aluno**: usa a mesma tela de conversão do Pipeline (escolher plano e vender).
   - Abrir perfil.
4. A busca global (Ctrl+K) passa a mostrar esses cadastros no grupo "Perdidos" e abre a nova página.

## Detalhes técnicos
- Rota `/alunos-perdidos`, página `src/pages/AlunosPerdidos.tsx`, item em `AppSidebar.tsx`.
- Consulta: `alunos` com `current_pipeline_stage_id` = etapa "Aluno perdido" (paginada), mais `pipeline_movements` (último movimento para essa etapa: `from_stage_id`, `moved_at`).
- Retomar: `fn_move_pipeline(_to_stage_name, _source 'manual', _notes 'Retomado de perdido')` + limpar `alunos.motivo_perda`.
- Converter: `ConvertToAvulsoButton` e `ConvertToAlunoDialog` (fullConvert, destino "Aluno ativo").
- Sem alterações no banco.
