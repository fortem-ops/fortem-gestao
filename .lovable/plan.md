## Problema

O CPF `659.592.300-97` digitado para **Carla Luciane Soares Furtat** já pertence a outro aluno cadastrado (**Carlos Augusto Piccinini**). Existe um índice único parcial no banco (`alunos_cpf_unique_idx` sobre os dígitos do CPF), então o `UPDATE` falha com o erro bruto do Postgres `duplicate key value violates unique constraint`. Como o erro não é tratado, o usuário vê a mensagem técnica e o CPF nunca é salvo — por isso "não aparece o CPF" no cadastro dela.

A regra de unicidade do CPF está correta e deve continuar (CPF é identificador único de pessoa). O que precisa mudar é **a forma como o sistema trata e comunica esse conflito**, em todos os fluxos que gravam CPF.

## Objetivo

Para todos os cadastros existentes e futuros:
1. Validar CPF antes de gravar e impedir gravação silenciosamente quebrada.
2. Mostrar mensagem clara identificando **qual aluno já possui aquele CPF**.
3. Tratar o erro `23505` (duplicate key) caso ele ainda chegue ao banco, traduzindo para mensagem amigável.
4. Validar formato do CPF (dígito verificador) antes de salvar.

## Mudanças por fluxo

### 1. `src/lib/cpfValidation.ts` (novo helper)
- `normalizeCpf(cpf)` — devolve apenas dígitos.
- `isValidCpfDigits(cpf)` — valida dígito verificador (mesma lógica já usada em `clube.ts` e `legal-annex/StudentDataForm.tsx`, centralizada).
- `findAlunoByCpf(cpf, excludeId?)` — consulta `alunos` por `regexp_replace(cpf,'[^0-9]','','g') = <digits>`, retorna `{ id, nome }` ou `null`. Usa `.neq("id", excludeId)` quando estiver editando.
- `formatDuplicateCpfMessage(existing)` — texto: "CPF já cadastrado para **<nome>**. Verifique se digitou corretamente ou edite o cadastro existente."
- `translateCpfDbError(error)` — se mensagem contém `alunos_cpf_unique_idx`, devolve a mesma mensagem amigável (sem nome, pois pode falhar na corrida).

### 2. `src/components/student/EditDadosCadastraisDialog.tsx`
- Antes do `UPDATE`, se `form.cpf` mudou:
  - validar formato; se inválido → toast e abortar.
  - chamar `findAlunoByCpf(form.cpf, alunoId)`; se achar → toast com nome e abortar.
- Envolver o `UPDATE` em try/catch usando `translateCpfDbError` como fallback.

### 3. `src/components/legal-annex/StudentDataForm.tsx` (e fluxo `LegalAnnexFlow.tsx` / edge `submit-legal-annex`)
- O componente já valida formato via `validateCPF`. Acrescentar checagem de duplicidade ao sair do campo CPF (após `lookup-by-cpf`): se já existe outro aluno com o CPF e não é o mesmo registro sendo preenchido, mostrar aviso.
- Na edge `submit-legal-annex`: ao gravar/atualizar `alunos`, capturar erro 23505 do índice CPF e responder `409` com mensagem clara, exibida pelo front.

### 4. `src/components/pipeline/ConvertToAlunoDialog.tsx`
- Mesma validação prévia + tratamento de erro 23505 no insert de `alunos`.

### 5. `src/components/student/ImportStudentsCSVDialog.tsx` / `src/lib/studentImport.ts`
- Para cada linha com CPF:
  - normalizar e validar dígito; linhas inválidas vão para relatório de erro.
  - antes do upsert, fazer lookup por CPF; se existir outro aluno, marcar linha como conflito (relatório final mostra "CPF já cadastrado para X").
- Tratar `23505` no `insert`/`update` como fallback.

### 6. Edge `lookup-by-cpf` (sem mudança de contrato)
- Já existe e retorna `found:true` com dados — o front passa a usar isso para sugerir "este CPF pertence a Fulano" antes de tentar gravar.

### 7. Sem migração de schema
- O índice único `alunos_cpf_unique_idx` permanece como está. Nenhum dado existente é alterado. O CPF de Carlos Piccinini fica intocado; cabe ao usuário decidir se o CPF realmente é de Carla ou de Carlos e corrigir no cadastro certo.

## Mensagens (PT-BR)
- Conflito: **"CPF já cadastrado para <NOME>. Verifique se foi digitado corretamente."**
- Inválido: **"CPF inválido. Confira os dígitos."**
- Erro genérico do banco no índice de CPF: **"CPF já cadastrado no sistema."**

## Fora de escopo
- Tela para "mesclar" cadastros duplicados.
- Remoção da regra de unicidade.
- Alteração do CPF de Carlos Piccinini ou da Carla — o usuário decide qual está correto após ver a mensagem clara.