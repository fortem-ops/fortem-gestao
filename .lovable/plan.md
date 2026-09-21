# Link de pagamento para inscrições de Corrida pendentes

Permitir que a equipe envie um link direto de pagamento para quem criou o pedido da Corrida mas nunca concluiu o pagamento. O aluno abre o link, revisa/aceita o contrato (se ainda faltar) e paga por cartão ou Pix — sem refazer o cadastro.

## 1. Botão na tela interna (/corrida/inscricoes)

No painel de detalhe da inscrição, no bloco "Progresso", quando o Pagamento estiver Pendente (ou recusado) aparece o botão **Gerar link de pagamento**. Ao clicar, o link é criado, copiado automaticamente para a área de transferência e a tela mostra "Link copiado!" com o endereço visível para conferência.

## 2. Nova rotina interna `corrida-criar-link-pagamento`

Autenticada, exige coordenação/administração (mesmo padrão de `loja-estornar-pedido`: `auth.getUser` + `is_coordinator_or_admin`). Recebe `venda_id`, confere que a venda existe e não está paga, gera um token aleatório (`crypto.randomUUID()` sem hífens + segundo UUID, alta entropia), grava em `corrida_links_pagamento` (venda_id, token, criado_por) e devolve `https://soufortem.com.br/corrida/pagamento/{token}`. Se já existir link válido e não usado para a venda, reaproveita.

## 3. Nova rotina pública `corrida-validar-link-pagamento`

`verify_jwt = false`, rate limit pelo helper `_shared/corrida-rate-limit.ts`. Recebe `{ token }` e retorna:
- `invalido` quando não existe, ou `expirado` quando `expira_em` passou;
- `ja_pago` quando a venda está com `status_pagamento = 'pago'`;
- caso válido: dados do aluno (nome, e-mail), venda (valor, parcelas, descrição/itens do resumo gravado em `observacoes`), `contrato_id` e os `contratos_documentos` com conteúdo e situação de aceite.

`usado_em` preenchido não bloqueia: só é marcado quando o pagamento é aprovado (parte 5), então o link pode ser reaberto após falhas.

Para o cartão, a função também emite um novo token de checkout em `links_cartao` para o aluno da venda (mesmo formato usado por `corrida-criar-pedido`), pois o token original pode ter expirado. É esse token que `rede-salvar-cartao` e `corrida-cobrar-pedido` já esperam.

## 4. Nova página pública `/corrida/pagamento/:token`

Rota fora do wizard, sem login. Estados: carregando, erro amigável (link inválido/expirado), já pago, e a tela de pagamento.

A tela de pagamento reaproveita o componente existente `src/components/corrida/PagamentoStep.tsx` em um novo modo: recebe o pedido já pronto (`venda_id`, `contrato_id`, `cartao_token`, documentos) via a prop `pedido` que já existe, mais uma prop opcional `modoLink` que impede a criação de um novo pedido. Todo o resto (aceite de documentos, formulário de cartão, tokenização, Pix com QR code, polling, telas de erro/sucesso) continua sendo o mesmo código, chamando `corrida-aceitar-contrato`, `rede-salvar-cartao`, `corrida-status-tokenizacao`, `corrida-cobrar-pedido`, `corrida-criar-pix` e `corrida-status-pix` já existentes.

Ajuste mínimo em `corrida-criar-pix`: aceitar um `venda_id` já existente e, nesse caso, pular a chamada a `corrida-criar-pedido`, seguindo direto para a cobrança Inter. O caminho atual do wizard fica inalterado.

## 5. Marcar o link como usado

No helper compartilhado `_shared/corrida-pagamento-aprovado.ts` (já executado tanto no cartão aprovado quanto na liquidação do Pix via webhook), acrescentar a marcação de `usado_em = now()` nos links daquela venda que ainda estejam em aberto. Assim falhas e abandonos mantêm o link válido, e só o pagamento aprovado o encerra.

## Detalhes técnicos

- Rota registrada em `src/App.tsx` como pública e com carregamento sob demanda, igual às demais páginas públicas de Corrida.
- `supabase/config.toml`: `verify_jwt = false` para `corrida-validar-link-pagamento`; `corrida-criar-link-pagamento` valida o usuário em código.
- Nenhuma migration: a tabela `corrida_links_pagamento` já existe.
- Sem alterações de preço ou condições comerciais da Corrida.

## Teste final

Gerar um link real para uma venda pendente existente, abrir a página pública, concluir aceite e pagamento, confirmar que o contrato fica ativo, a venda vai para pago e o link é marcado como usado. Dados de teste criados para a verificação são apagados ao final.
