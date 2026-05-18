## Objetivo

1. Adicionar ações **"+Nova Avaliação"** e **"Converter em Aluno"** em cada linha de `/prospects`.
2. Em **Aluno → Resumo → Dados Cadastrais**, permitir editar os dados e adicionar campos novos (CPF, RG, CEP e endereço completo).

---

## 1. Prospects — novas ações

Arquivo: `src/pages/Prospects.tsx`

Na coluna "Ações" de cada linha, acrescentar dois botões ícone (com tooltip), antes do botão de Pipeline:

- **+Nova Avaliação** (ícone `ClipboardPlus`)  
  → navega para `/alunos/{id}?tab=avaliacoes&new=1`.
- **Converter em Aluno** (ícone `UserCheck`)  
  → abre o `ConvertToAlunoDialog` (já existente) com `alunoId`, `alunoNome`, `fullConvert=true`.  
  Ao fechar com sucesso, abrir automaticamente o `VendaDialog` (tela de venda de planos) para o mesmo aluno, já com cadastro completo.

Detalhes:
- Adicionar estado local `convertId` e `vendaId` (com nome).
- Após o `ConvertToAlunoDialog` chamar `onOpenChange(false)` em sucesso, definir `vendaId` para abrir `VendaDialog`.  
  Como o `ConvertToAlunoDialog` atual fecha sempre via `onOpenChange(false)`, adicionar uma prop opcional `onConverted?: () => void` chamada depois do `toast.success` apenas quando `fullConvert=true`. Usar essa prop em Prospects para abrir a venda.
- Invalidate de `prospects-list` ao concluir.

### Pequeno ajuste em `ConvertToAlunoDialog.tsx`
Adicionar prop opcional `onConverted?: () => void` e chamá-la após `toast.success(...)` no caminho `fullConvert`. Sem mudança de comportamento padrão.

---

## 2. Dados Cadastrais editáveis com campos novos

### 2.1 Banco de dados
Migration única adicionando colunas faltantes em `public.alunos`:

- `rg text`
- Demais colunas já existem (`cpf`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `email`, `telefone`, `data_nascimento`, `sexo`).

### 2.2 Novo componente `EditDadosCadastraisDialog.tsx`

Local: `src/components/student/EditDadosCadastraisDialog.tsx`.

Dialog focado só nos dados cadastrais (separado do `EditStudentDialog` que mistura plano). Campos:

- Nome, Data de nascimento, Sexo
- CPF (com máscara), RG
- Telefone, Email
- CEP (com lookup ViaCEP via `fetchCep`), Logradouro, Número, Complemento, Bairro, Cidade, UF

Validação com `zod`. Salva via `supabase.from("alunos").update(...)`. Invalida `["aluno", id]`. Botão "Salvar".

### 2.3 Atualizar `StudentSummary.tsx`

Na seção **Dados Cadastrais**:
- Adicionar botão "Editar" (`Pencil`) no cabeçalho da seção, visível somente para Coordenador/Admin (já existe `isCoordAdmin`).
- Adicionar cards para **CPF**, **RG**, **Sexo** e **Endereço** (CEP + linha formatada).
- O botão abre `EditDadosCadastraisDialog`. Ao salvar, refaz a query do aluno (lift up: passar `onUpdated` que invalida a query do StudentProfile, ou chamar `queryClient.invalidateQueries(["aluno", student.id])`).

---

## Arquivos

**Criar**
- `src/components/student/EditDadosCadastraisDialog.tsx`

**Editar**
- `src/pages/Prospects.tsx` — ícones de Nova Avaliação e Converter em Aluno; estados; abertura de `VendaDialog`.
- `src/components/pipeline/ConvertToAlunoDialog.tsx` — prop `onConverted`.
- `src/components/student/StudentSummary.tsx` — novos cards (CPF, RG, Sexo, Endereço) + botão editar.

**Migration**
- Adicionar `rg text` em `public.alunos`.
