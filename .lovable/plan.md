# Aplicar treino a um membro da equipe

Hoje o seletor "Aplicar treino a um aluno" busca apenas na tabela de alunos. Professores/nutricionistas/fisioterapeutas não aparecem porque suas fichas pessoais só existem depois que a própria pessoa abre "Meus Treinos" — e hoje nenhuma ficha de equipe foi criada ainda no banco (verificado).

## O que muda para o usuário

- No diálogo de aplicar treino, o seletor passa a ter dois grupos: **Alunos** e **Equipe**.
- O grupo Equipe lista todos os profissionais (professor, nutricionista, fisioterapeuta, coordenador, admin) pelo nome, com o rótulo "Equipe".
- Ao escolher um profissional, o treino é salvo na ficha pessoal dele — criada automaticamente na hora, caso ainda não exista. Ele vê a ficha em "Meus Treinos".
- O título do diálogo passa a ser "Aplicar treino" (aluno ou equipe).

## Como funciona por trás

### Banco (migration)

- Nova RPC `fn_get_or_create_ficha_equipe_de(_user_id uuid)` (SECURITY DEFINER): mesma lógica da atual, mas para outro usuário; exige que quem chama seja staff e que o alvo tenha papel de staff. Retorna o `id` da ficha.
- Nova RPC `fn_listar_equipe_fichas()`: retorna `user_id` e `nome` dos profissionais ativos (a partir de `profiles` + `user_roles`), para popular o grupo Equipe sem expor dados sensíveis.

### Frontend

- `src/components/student/StudentPicker.tsx`: prop opcional `includeEquipe` (padrão desligado, para não afetar Avaliações). Quando ligada, busca a lista da equipe e renderiza um segundo `CommandGroup` "Equipe". A seleção de um profissional chama `fn_get_or_create_ficha_equipe_de` e devolve o `aluno_id` resultante via `onChange`, mantendo o restante do fluxo inalterado.
- `src/components/student/workout/PersonalizadoEditor.tsx`: usa `includeEquipe`, ajusta título/descrição do diálogo.
- `src/components/student/workout/ImportFromStudentDialog.tsx`: também recebe `includeEquipe`, para importar de/para fichas da equipe.

Nenhum filtro `is_equipe` de listagens de alunos é alterado — as fichas da equipe seguem ocultas em listas, CRM, carteira e relatórios.
