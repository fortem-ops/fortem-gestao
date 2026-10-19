# /corrida: "Já sou aluno ou ex-aluno"

## O que muda
- O botão "Já sou aluno" passa a se chamar **"Já sou aluno ou ex-aluno"**.
- Ao digitar o CPF, a busca encontra também ex-alunos (inativos), não só os ativos.
- Ex-aluno encontrado: os dados dele (nome, e-mail, telefone, endereço) são preenchidos automaticamente, como já acontece com quem é ativo.
- Preço e regras para ex-aluno: como não tem plano ativo, ele segue o caminho de **"só corrida"** (o mesmo de hoje para aluno sem plano de treino). Não recebe preço de aluno ativo nem cortesias de plano.
- Se o mesmo CPF tiver mais de um cadastro, o ativo tem prioridade.

## Fora do escopo
- Prospects e clientes avulsos continuam fora da busca (seguem para "Matricule-se").
- Nenhuma mudança em preços, parcelas, contratos ou Planos 1 e 2.

## Detalhes técnicos
- `CaminhoSection.tsx`: trocar o título do card.
- `corrida-lookup-cpf`: trocar `.eq("status","ativo")` por `.in("status",["ativo","inativo"])`, ordenar com ativo primeiro; `decidirRota` já devolve `somente_corrida` quando não há plano ativo.
- Conferir também `corrida-*` que recebe o pedido (resolução do aluno por `cpf_hash`) para não criar um cadastro duplicado do ex-aluno.
- Adicionar teste em `corrida-identidade.test.ts` (ex-aluno sem plano → `somente_corrida`); publicar só a função de busca.
