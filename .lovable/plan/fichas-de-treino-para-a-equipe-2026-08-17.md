# Fichas de treino para a equipe

Nova área "Meus Treinos" no menu Técnico, disponível para todo o staff (professor, nutricionista, fisioterapeuta, coordenador, admin). Cada membro da equipe passa a ter suas próprias fichas de treino, com o mesmo editor, banco de treinos, cargas e exportação em PDF já usados para alunos.

## O que o usuário vê

- Item "Meus Treinos" no grupo Técnico da barra lateral.
- Página com o histórico de fichas da própria pessoa: criar do zero, importar do Banco de Treinos (Fase 1, 5-3-1, M102, Plan Strong, Personalizado…), importar de outra ficha, visualizar, editar, imprimir e excluir.
- Coordenador/admin veem apenas as próprias fichas nessa página (não é uma tela de gestão da equipe).

## Como funciona por trás

Para reaproveitar 100% do módulo de treinos (editores, PDFs, cargas, progressão), cada membro da equipe recebe um registro interno de "ficha de equipe" na tabela `alunos`, criado automaticamente no primeiro acesso e vinculado ao `user_id` do usuário logado.

Esse registro é marcado com uma nova coluna `alunos.is_equipe = true` e fica **fora** de tudo que é operação de alunos.

### Banco de dados (migration)

- `alunos`: nova coluna `is_equipe boolean not null default false` + índice parcial.
- RPC `fn_get_or_create_ficha_equipe()` (SECURITY DEFINER, exige staff via `is_staff()`): retorna o `id` da ficha de equipe do usuário logado, criando-a se não existir (nome = nome do profile, `status = 'ativo'`, `is_equipe = true`, `user_id = auth.uid()`).
- Política de RLS em `treinos` já cobre staff; nenhuma política nova é necessária, apenas garantir que o staff possa ler/gravar treinos da própria ficha.

### Isolamento (evitar que a equipe apareça como aluno)

Adicionar o filtro `is_equipe = false` (ou `is_equipe is not true`) nas consultas que listam/agregam alunos:

- `src/pages/StudentList.tsx` (ativos e inativos), `Prospects.tsx`, `Leads.tsx`, `CarteiraAlunos.tsx`, `Clube.tsx`, `Comissionamentos.tsx`
- Pipeline/CRM (`src/lib/pipeline.ts`, páginas de pipeline e relatório de CRM)
- Seletores de aluno: `AddAgendaDialog`, `VendaDialog`, `ImportFromStudentDialog`, `GlobalCadastroSearch`
- Widgets/dashboards e relatórios que contam alunos (`useDashboardData`, `AlertsWidget`, `src/pages/relatorios/*`)
- Funções de banco que contam carteira/evasão (`fn_carteira_total_ativos`, `fn_carteira_ativos_por_profissional`, `fn_detect_evasao`, `fn_pipeline_relatorio`) recebem o mesmo filtro na migration.

### Frontend

- Nova página `src/pages/MeusTreinos.tsx`: resolve a ficha via RPC e renderiza o componente de treinos existente (`StudentWorkouts`) com esse registro, título "Meus Treinos".
- Rota `/meus-treinos` em `src/App.tsx` (protegida por staff).
- Item no array `tecnicoItems` de `src/components/AppSidebar.tsx` com ícone `Dumbbell`.

## Trade-off

A alternativa seria uma tabela separada `treinos_equipe`, sem tocar em `alunos`. Ela evita o filtro em ~15 consultas, mas exigiria reescrever os cinco editores de prescrição e as exportações de PDF, que hoje gravam sempre em `treinos` com `aluno_id`. O caminho escolhido reaproveita todo o módulo sem duplicação, ao custo do filtro `is_equipe` nas listagens.
