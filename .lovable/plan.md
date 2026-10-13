# Fase 2 do checkout /planos 2027 — Identificação → Revisão → Contrato → Pagamento (tela) → Confirmação

Sem cobrança real. A tela de pagamento fica como etapa reservada ("pagamento em breve") até a Fase 4. Tudo só em `?previa=1` e só com o aluno de teste.

## 1. Etapas e telas (mobile-first, design FORTEM)
```text
5 IDENTIFICAÇÃO -> 6 REVISÃO -> 7 CONTRATO -> 8 PAGAMENTO -> 9 CONFIRMAÇÃO
   (já existe)      resumo       texto+aceite   reservado      status final
```
- Barra de etapas no topo, títulos em maiúsculas, Archivo, vermelho da marca, cantos retos, voz "você", sem exclamação. Textos novos em `planosPublicoTextos` (`revisao.*`, `contrato.*`, `confirmacao.*`).
- **Revisão:** plano, período, forma de pagamento, consultas e corrida, com o total e as parcelas vindos do servidor. Botão "Alterar" volta às escolhas sem perder a proposta.
- **Contrato:** dados do contratante (nome, CPF obrigatório, data de nascimento, endereço com CEP), depois o texto integral com rolagem; o botão "Aceito o contrato" só libera com a caixa "Li e aceito" marcada e após rolar até o fim.
- **Pagamento (reservado):** mostra a forma escolhida e "O pagamento será liberado em breve". Nenhuma chamada à Rede ou ao Inter.
- **Confirmação:** resumo da proposta e próximos passos; nesta fase a proposta fica em `contrato_aceito`.

## 2. Regras de identificação e cadastro
- Novo aluno/prospect: proposta + lead nascem na identificação (como hoje). Cadastro de aluno só no pagamento aprovado (Fase 5).
- Aluno e ex-aluno: vínculo só com o código por e-mail validado (já pronto). Sem código, segue como "novo".
- **CPF no contrato:** obrigatório, dígitos validados no navegador e no servidor. Se for de um cadastro existente e a proposta não estiver vinculada pelo código, o servidor recusa com mensagem neutra ("Este CPF precisa ser confirmado. Volte e identifique-se como aluno.") mostrando no máximo as iniciais; marca `aluno_suspeito_id` para a equipe. Nunca devolve id, e-mail ou telefone.
- Se a proposta estiver vinculada, o CPF digitado precisa bater com o `cpf_hash` do cadastro.
- O CPF da proposta é guardado cifrado + hash (mesma cifra do cadastro); a tela só mostra os 3 últimos dígitos.

## 3. Contrato
- Template: `contrato_templates` por `plano_tipo = planos_catalogo.familia` + forma (`cartao_recorrencia` ou `cartao_parcelado`; Pix à vista usa parcelado) + `ativo`. Pix Automático aparece só no texto dos templates de recorrência, como já está; a página não oferece Pix Automático.
- **Problema conhecido:** os 5 templates 2027 estão desligados (ativo = false). Para testar na prévia, a função aceita o template desligado apenas quando a proposta é do aluno de teste (lista `vendas_2027_teste_aluno_ids`). Ninguém mais consegue gerar contrato até o go-live.
- Variáveis: mesma lógica de `src/lib/contratos2027.ts` reproduzida no servidor (função em `_shared`), com teste que compara as duas saídas para não divergir.
- Valores sempre recalculados no servidor a partir do catálogo (mesma regra de `calcularVenda2027`, em centavos); valor do navegador é ignorado.
- Gravação em `contratos_documentos`: `conteudo_gerado` (HTML), `template_id`, `template_versao`, `regulamento_versao`, `variaveis_utilizadas` (CPF mascarado), `aceite=true`, `data_aceite` (hora do servidor), `ip_aceite`, novas colunas `hash_texto` (SHA-256 do texto exato exibido), `user_agent`, `origem='site'`, `proposta_id`. O navegador envia o hash do texto que viu; o servidor regera e só aceita se os hashes forem iguais.
- Como ainda não há aluno nem contrato comercial, o documento fica preso à proposta (`aluno_id` e `contrato_id` nulos) e é ligado ao contrato na Fase 5.

## 4. Estados, expiração e idempotência
- Status: `rascunho → identificada → contrato_aceito → aguardando_pagamento → paga | falhou | expirada`. Nesta fase só os três primeiros (+ `expirada`) são usados.
- `chave_sessao` aleatória (gerada no servidor na criação, guardada no navegador); toda ação exige `proposta_id` + `chave_sessao`. Só o hash da chave fica no banco.
- `expira_em` = última atividade + 24h. Rotina nenhuma é criada: a expiração é avaliada na hora de cada chamada.
- Recarregar ou voltar: `fn_checkout_2027_estado` devolve a etapa atual e o resumo; a tela retoma dali.
- Reclicar "Aceito": idempotente (um documento por proposta, índice único). Duas abas: a segunda vê o mesmo estado.
- Proposta expirada: pode ser retomada pelo mesmo navegador; recalcula valores e, se o template ou o valor mudou, invalida o aceite antigo (fica no histórico) e pede novo aceite.
- Alterar escolhas depois do aceite volta para `identificada` e exige novo aceite.

## 5. Banco (migrações previstas)
1. `checkout_2027_estrutura`: colunas em `propostas_planos_2027` (`chave_sessao_hash`, `expira_em`, `etapa_atualizada_em`, `cpf_cifrado`, `cpf_hash`, dados do contratante cifrados quando sensíveis, `contrato_documento_id`); colunas em `contratos_documentos` (`hash_texto`, `user_agent`, `origem` default 'admin', `proposta_id`) + índice único parcial `(proposta_id)`; check de status ampliado.
2. `checkout_2027_funcoes`: `fn_checkout_2027_estado`, `fn_checkout_2027_revisar`, `fn_checkout_2027_contrato_gerar`, `fn_checkout_2027_aceitar`, todas `security definer`, `search_path` fixo, EXECUTE só para `service_role`; chamadas por uma edge function nova `planos-checkout` (que captura IP e user agent).
- RLS: nenhuma leitura pública nova; anônimo só fala com a edge function. Linhas existentes de `contratos_documentos` não mudam (colunas novas nulas/default).
- Rate limit: reaproveita `fn_planos_limite` por IP e por proposta (ex.: 60/h por IP, 20 aceites/h por proposta).
- Chave de liga/desliga `planos_checkout_ativo` (false) em `sistema_config`; com false, só o aluno de teste passa.

## 6. Segurança, LGPD e o que NÃO muda
- CPF nunca em URL, log, system_logs nem erro; logs só com id da proposta e 3 últimos dígitos.
- Consentimento: aceite registra a versão do regulamento e da política de privacidade.
- Não serão tocados: catálogo 2027 (planos/serviços/templates seguem inativos), go-live, `fn_venda_2027_criar`, cron do cartão, `cobrar-recorrencias-diario`, Rede, Inter, pix-webhook, Loja, Corrida, venda e contratos do admin, `aceitar-contrato-token`/`aceitar-contrato-documento`, `gerarDocumentoContrato`.
- Riscos: contrato errado (mitigado por validação família/forma + teste); texto divergente entre navegador e servidor (comparação de hash); vazamento por CPF (resposta neutra + limite); reversão: desligar `planos_checkout_ativo` e a tela volta ao fluxo atual de proposta.

## 7. Testes (sem cobrança)
- Unitários: transições de estado válidas/inválidas; expiração 24h; idempotência do aceite; hash igual navegador/servidor; escolha do template por família × forma; variáveis do servidor = `contratos2027.ts`; CPF obrigatório e duplicidade com resposta neutra; nenhum CPF nos logs.
- Ponta a ponta na prévia com NICOLAS TESTE: identificar → revisar → aceitar → confirmação; recarregar retoma; segunda aba mostra mesmo estado.
- Consultas no banco: 1 documento por proposta, `hash_texto` preenchido, `origem='site'`; contagens da Fase 0 iguais (fora as linhas de teste); planos/serviços/templates 2027 ativos = 0; pix_cobrancas=19, pagamentos=3, cobrancas pendentes=625, crons 34/33.

## 8. Subfases (cada uma aprovada separadamente)
- **2A — Banco:** as duas migrações + chave desligada. Entrega: colunas/funções criadas, contagens inalteradas.
- **2B — Servidor:** edge function `planos-checkout` + variáveis/valores no servidor + testes unitários. Entrega: chamadas por curl só com o aluno de teste.
- **2C — Telas Revisão e Contrato:** tela, aceite, retomada. Entrega: aceite gravado na prévia.
- **2D — Telas Pagamento (reservada) e Confirmação** + teste ponta a ponta e conferência final.

## Decisões em aberto
1. **Templates desligados:** liberar o template inativo só para o aluno de teste (recomendo) ou ativar os 5 templates agora (afeta outras telas que listam contratos ativos)?
2. **Bloqueio do teste:** o CPF e o celular do NICOLAS TESTE são compartilhados com outros cadastros, então ele não é identificado. Dar a ele um CPF de teste só dele (recomendo) ou usar outro cadastro de teste?
3. **Dados do contratante para o novo aluno:** pedir endereço completo já no contrato (recomendo, o contrato precisa) ou só nome, CPF e nascimento?
4. **Rolagem obrigatória** até o fim do texto antes de liberar o aceite: manter (recomendo) ou só a caixa "Li e aceito"?
5. **PDF do contrato:** oferecer download do texto aceito já nesta fase (gerado no navegador, sem armazenamento novo) ou só na Fase 5 por e-mail?
