# CPF primeiro e preenchimento automático no /assinar

## Objetivo
Na tela de assinatura, o CPF passa a ser o primeiro campo. Ao digitar um CPF válido, os dados
cadastrais (nome, nascimento, telefone, e-mail e contato de emergência) vêm preenchidos
automaticamente quando a pessoa já existe como aluno, prospect ou já assinou um documento antes.

## Situação atual (verificada)
- O formulário mostra Nome, Nascimento, CPF, Telefone, E-mail e Contato de emergência, nessa ordem.
- Já existe uma tentativa de preenchimento automático, mas ela **nunca funciona nessa tela**:
  a busca por CPF hoje exige um usuário da equipe logado, e /assinar é uma página pública.
- Essa busca também olha apenas documentos já assinados, e por um campo de CPF antigo em texto —
  não encontra alunos nem prospects, que hoje são localizados por CPF codificado.

## O que será feito
1. **Ordem do formulário**: CPF vira o primeiro campo, com destaque e texto de apoio
   ("Digite seu CPF para buscarmos seus dados"). Os demais campos seguem abaixo, na ordem atual.
2. **Busca pública e segura por CPF**: nova rotina pública que, dado um CPF válido, procura
   nesta ordem: aluno/prospect cadastrado → último documento assinado. Retorna apenas os campos
   necessários para preencher o formulário.
3. **Preenchimento**: ao completar 11 dígitos válidos, os campos vazios são preenchidos e aparece
   um aviso discreto "Encontramos seu cadastro — confira e ajuste se precisar". O que a pessoa já
   tiver digitado não é sobrescrito. Se não houver cadastro, segue o preenchimento manual, sem erro.
4. **Proteção contra abuso**: limite de tentativas por origem e por CPF, para que a busca não possa
   ser usada para varrer dados. CPF inválido nem chega a consultar.

## Detalhes técnicos
- `src/components/legal-annex/StudentDataForm.tsx`: reordenar campos (CPF primeiro), trocar a
  chamada `supabase.functions.invoke("lookup-by-cpf")` por uma nova função pública
  `lookup-cadastro-publico`, preencher só campos vazios, estado de "buscando…" e aviso de sucesso.
- Nova Edge Function `lookup-cadastro-publico` (sem JWT), com service role:
  valida CPF, calcula o hash igual ao usado no sistema, busca em `public.alunos` por `cpf_hash`
  (nome, data_nascimento, telefone, email) e, se não achar, em `public.legal_annexes` por `cpf_hash`
  (inclui `emergency_contact_name`/`emergency_contact_phone`, mais recente primeiro).
  Retorna `{ found, data }` apenas com esses campos — nunca CPF, id ou dados financeiros.
- Rate limit reaproveitando o padrão de `fn_check_rate_limit` (ex.: 10 consultas por IP a cada
  10 minutos), com resposta 429 amigável.
- `lookup-by-cpf` (uso interno da equipe) permanece como está.
- Nenhuma alteração em preços, contratos de Corrida, RLS existente ou outras telas.

## Validação
- CPF de aluno existente → dados preenchidos; CPF de prospect → dados preenchidos;
  CPF desconhecido → formulário vazio, sem mensagem de erro.
- Fluxo completo de assinatura continua funcionando em /assinar e /assinar-experimental.
