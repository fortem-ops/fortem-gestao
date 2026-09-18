# Mostrar todos os professores na Carteira de Alunos

## O problema

A lista de professores da tela Carteira é montada a partir dos alunos já existentes: só aparece quem
já tem pelo menos um aluno sob sua responsabilidade. A professora Yasmim Rodrigues Avila está
cadastrada com o perfil de professora, mas hoje tem 0 alunos atribuídos — por isso ela não aparece
nem no filtro nem na lista de destino ao transferir alunos.

Qualquer profissional novo cai no mesmo problema: fica invisível justamente quando se quer dar o
primeiro aluno a ele.

## O que muda

- O filtro "Filtrar por professor" e a lista "Selecione o professor destino" passam a mostrar todos
  os profissionais da equipe (professores, nutricionistas, fisioterapeutas e coordenação), tenham
  eles alunos ou não.
- Yasmim passa a aparecer e pode receber alunos por transferência.
- Nada mais muda: agrupamento por professor, as três colunas de status, ações e permissões
  continuam como estão.

## Detalhes técnicos

1. Migration: nova função `fn_listar_profissionais()` `SECURITY DEFINER` (search_path `public`),
   retornando `user_id, full_name, role` de `profiles` cruzado com `user_roles` para os papéis
   `professor`, `nutricionista`, `fisioterapeuta`, `coordenador`, `admin`, ordenado por nome.
   `GRANT EXECUTE ... TO authenticated`. Necessária porque a policy de `user_roles` só permite
   leitura de terceiros para coordenação/admin, e a tela é usada por professores.
2. `src/pages/CarteiraAlunos.tsx`: a query `professors-carteira` passa a chamar essa RPC em vez de
   derivar os ids de `alunos`. Manter o merge com os `responsavel_id` que porventura não retornem na
   RPC, para que nenhum nome já exibido suma (`profMap` continua resolvendo o agrupamento).
3. Validação: typecheck, build e conferência na tela de que Yasmim aparece nas duas listas.
