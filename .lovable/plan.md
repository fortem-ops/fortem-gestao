# Deduplicação de cartões salvos — relatório de investigação

Nada foi alterado. Abaixo o que os arquivos e o banco mostram hoje.

## 1. Verificação de duplicata antes do INSERT

Não existe nenhuma. São três caminhos que inserem em `cartoes_salvos`, todos com INSERT cego:

- `rede-tokenizacao-webhook/index.ts` (linha ~253): a única condição é `registro && !registro.cartao_salvo_id`, ou seja, "esta tokenização ainda não gerou cartão". Não há consulta por `aluno_id + last4 + validade + brand` antes do insert.
- `rede-salvar-cartao/index.ts` (linha ~426): INSERT direto após tokenização aprovada, sem consulta prévia.
- `rede-cobrar-cartao/index.ts` (linha ~356): INSERT direto quando `save_card` e aprovado, e ainda com `is_default: true` (não zera o `is_default` dos outros cartões do aluno antes).

Resultado: recadastrar o mesmo cartão sempre cria uma linha nova.

## 2. Tamanho real do problema hoje

Query executada agrupando cartões ativos por `aluno_id + last4 + expiration_month + expiration_year`: **zero grupos com mais de um ativo**. A tabela tem 8 linhas no total (6 ativas, 5 alunos).

O caso mais próximo é um aluno de teste (`23f8...`) com 4 cartões: dois com `last4 4715` (um inativo, validade 03/2032; um ativo, 09/2029) e outros dois last4 distintos. Ou seja: o mesmo plástico foi recadastrado, mas com validade diferente digitada, então nem a chave last4+validade pegaria — apenas `last4` pegaria.

Conclusão: o risco é real e estrutural, mas o passivo atual é praticamente nulo. É correção preventiva, não limpeza de dados em massa.

## 3. Para qual registro os contratos apontam

Hoje, **nenhum**: `contratos.cartao_token_id` está nulo em todas as 8 linhas (nenhum cartão tem contrato vinculado).

Pela lógica do código, quando houver duplicata:

- A Fase 2 (`rede-tokenizacao-webhook`) vincula sempre o cartão **recém-criado** aos contratos ativos de recorrência do aluno — mas apenas onde `cartao_token_id IS NULL`. Contratos que já tinham cartão vinculado continuam apontando para o **registro antigo**.
- Isso é o ponto frágil: o aluno recadastra porque o cartão antigo falhou, o novo registro é criado, e o contrato antigo segue apontando para o token velho — a recorrência continua tentando o cartão errado. Não "quebra" com erro, degrada silenciosamente.
- `cobrar-recorrencias-diario` lê o cartão por `contratos.cartao_token_id` e exige `ativo = true` + uma `rede_tokenizacoes` com `status = 'active'`; se o antigo foi desativado por returnCode 54, a cobrança apenas é registrada como `cartao_inativo`, mesmo existindo um cartão novo válido.

## 4. Constraints existentes

Não há nada que impeça duplicatas. Em `cartoes_salvos` existem apenas:

- PK em `id`
- índice não-único `cartoes_salvos_aluno_idx (aluno_id) WHERE ativo = true`
- FK para `alunos`, CHECK em `origem`

Nenhuma UNIQUE envolvendo `aluno_id`, `last4`, validade, `brand` ou `token_rede`. É 100% ausência de verificação na aplicação.

## 5. Recomendação

Nenhuma das três opções puras resolve bem. A análise por opção:

- **(a) desativar o antigo e ativar só o novo** — comportamento mais correto do ponto de vista da Rede: cada tokenização gera um `token_rede` novo e é o único token garantidamente utilizável; reaproveitar o token antigo é arriscado. Mas exige repontar `contratos.cartao_token_id` (e `planos.cartao_token_id`) do antigo para o novo, senão cria exatamente o problema do item 3.
- **(b) não criar o novo, manter o antigo** — é a pior: o aluno recadastra justamente quando o cartão antigo falhou; manter o token velho perpetua a recusa e o novo token válido é descartado.
- **(c) atualizar `token_rede` do registro existente** — mantém identidade estável (contratos continuam válidos sem repontar), mas sobrescreve o histórico de tokenização e complica a relação com `rede_tokenizacoes.cartao_salvo_id`, que passa a ter várias tokenizações apontando para o mesmo cartão com dados divergentes.

**Recomendação: (a) com repontamento**, ou seja um "substituir":

1. Detectar cartão ativo do mesmo aluno com mesmo `last4` (chave apenas por `last4`, não por validade — o caso real mostrou validade digitada diferente para o mesmo plástico).
2. Criar o novo registro (token novo, validade nova, brand novo).
3. Desativar o antigo (`ativo = false`) e marcar motivo.
4. Repontar `contratos.cartao_token_id` e `planos.cartao_token_id` do antigo para o novo.
5. Registrar em `system_logs` a substituição (cartão antigo, novo, contratos repontados).
6. Aplicar isso nos três pontos de insert, idealmente numa função única compartilhada (`_shared`) para não divergir.

Sobre constraint no banco: uma UNIQUE parcial `(aluno_id, last4) WHERE ativo = true` é tentadora como rede de segurança, mas se a aplicação errar a ordem (inserir antes de desativar) ela derruba um cadastro legítimo. Sugestão: implementar primeiro a lógica de substituição e o log, medir, e só depois avaliar a constraint.

Ponto adicional encontrado no caminho: `rede-cobrar-cartao` insere com `is_default: true` sem zerar o `is_default` dos outros cartões do aluno — pode resultar em mais de um cartão padrão. Vale corrigir junto quando a dedupe for implementada.
