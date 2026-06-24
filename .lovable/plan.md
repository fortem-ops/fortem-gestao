## Diagnóstico inicial

O console mostra `TypeError: f.includes is not a function` dentro do chunk `BancoTreinos`. Em `src/pages/BancoTreinos.tsx` há vários `.includes` (linhas 55, 149, 372, 539, 810, 1070, 1172). Os mais frágeis são os que assumem array vindo do banco (`formData.dias`, `effDias`, `userRoles`). Como o erro derruba a página inteira via ErrorBoundary, ele também impede o fluxo "Importar treino para aluno", que é renderizado a partir da mesma página.

Os outros 4 sintomas relatados precisam de investigação dirigida — não há erros ainda nos logs porque o usuário provavelmente não chegou a disparar o fluxo. Vou abrir cada arquivo, reproduzir e corrigir um a um.

## Plano de correção

### 1. BancoTreinos (e "Importar treino para aluno")
- Localizar a chamada `.includes` que recebe valor não-array. Suspeitos principais:
  - `formData.dias` / `effDias` (template vindo do banco pode estar como string ou null).
  - `userRoles` (defaultado a `[]`, mas vale revisar).
- Adicionar coerções defensivas: `Array.isArray(x) ? x : []` antes de qualquer `.includes`.
- Validar que o "Importar treino para aluno" volta a funcionar após o crash sumir.

### 2. Upload de arquivos no perfil do aluno
- Abrir `StudentUploads` (aba `uploads` em `StudentProfile.tsx`).
- Reproduzir o upload, inspecionar erro real (storage bucket / RLS de `uploads` / política em `storage.objects`).
- Corrigir o ponto exato: política de bucket, header `Authorization` na chamada, ou conversão de path.

### 3. Conversão Prospect → Aluno
- Abrir `src/components/pipeline/ConvertToAlunoDialog.tsx` (usado por `Prospects.tsx`).
- Reproduzir e capturar erro (provável RLS em `alunos` / `pipeline_movements` ou edge function sem token).
- Aplicar correção pontual.

### 4. Notificar — seleção individual de pessoas (caso Gustavo Dubois)
- A lista do `RecipientPicker` vem do RPC `fn_notificar_listar_profissionais`, que só retorna dados se o `auth.uid()` atual tiver role em `('admin','coordenador','professor','nutricionista','fisioterapeuta')`.
- Verificar via SQL qual role o usuário Gustavo Dubois possui em `user_roles`.
  - Se faltar role apropriada → atribuir a role correta (provavelmente `professor`) via `insert`.
  - Se a regra atual está correta mas deveria incluir outros papéis (ex.: `recepcao`) → ajustar o RPC para liberar a leitura da lista a todo usuário autenticado, mantendo a restrição de envio nas funções de gravação.

### 5. Verificações finais
- `npx tsc --noEmit` para garantir zero erros de tipo após as mudanças de front-end.
- Confirmar no preview que: BancoTreinos abre, importar treino funciona, upload conclui, conversão prospect→aluno cria o aluno, e o Gustavo Dubois consegue ver e marcar pessoas individualmente.

## Observações técnicas

- Nenhuma alteração de schema deve ser necessária além, possivelmente, do ajuste do RPC `fn_notificar_listar_profissionais` (item 4) — qualquer migração será criada via tool `supabase--migration`.
- Mudanças do item 1 são puramente front-end (sanitização defensiva), sem alterar lógica de negócio.
- Antes de aplicar o item 4, vou consultar o banco para saber a role atual de Gustavo Dubois e decidir entre "atribuir role" (dado) vs "relaxar RPC" (schema).
