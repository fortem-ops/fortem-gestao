# Corrigir a aba "Editar" do aluno (caso Frederico)

## O que aconteceu

Confirmado no banco. Ao salvar a tela "Editar" do aluno, o sistema:

1. desativa TODOS os planos ativos do aluno, e
2. cria um plano novo, solto, com os dados do formulário.

No Frederico o plano ligado ao contrato ativo (início 30/04/2026, vigente até 30/04/2027) foi desativado, e hoje às 13:49 nasceram dois planos "Start+" duplicados — um inativo e um ativo — sem ligação com o contrato. Por isso ele aparece como "plano inativo" mesmo tendo contrato ativo.

## O que será feito

### 1. Enxugar a tela "Editar" do aluno

A tela passa a ter apenas:
- Frequência semanal
- Professor responsável
- Consultor responsável
- Observações

Sai dessa tela: nome, e-mail, telefone, data de nascimento, status, e todo o bloco de plano (tipo, valor, data de início, consultas). Dados cadastrais continuam em "Editar dados cadastrais" e planos continuam pelo fluxo normal de contratação/cancelamento.

Com isso, salvar essa tela nunca mais mexe em plano.

### 2. Consertar os dados do Frederico

- Reativar o plano ligado ao contrato ativo.
- Remover os dois planos duplicados criados hoje por engano.
- Conferir depois que o aluno volta a exibir plano ativo.

### 3. Verificar se houve outros casos

Buscar outros alunos com planos duplicados criados pelo mesmo caminho (plano do contrato ativo desativado e plano solto ativo criado depois). Se aparecerem, informo a quantidade antes de corrigir qualquer coisa — nada em massa sem sua confirmação.

## Detalhes técnicos

- `src/components/student/EditStudentDialog.tsx`: remover a busca de plano principal/`planDefaults`, remover o bloco de update/insert em `planos` no `onSubmit`; o update em `alunos` passa a gravar só `frequencia_semanal`, `responsavel_id`, `consultor_id`, `observacoes`.
- Novo formulário enxuto dentro do próprio dialog (ou variante `mode="vinculo"` em `StudentFormFields`), preservando os seletores de professor/consultor já existentes. `StudentFormFields` continua intacto para `AddStudentDialog`.
- `EditDadosCadastraisDialog` e o fluxo de contratos ficam inalterados.
- Correção de dados do Frederico via SQL pontual (UPDATE/DELETE em `planos`), não migração de schema.
