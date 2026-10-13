# Checkout e pagamento da página pública /planos

Nada é executado antes do OK do dono. Cada fase termina com uma conferência no banco e pode ser revertida sozinha. Pix Automático fica fora. O go-live 2027 só acontece no fim, com um pedido separado.

## O que já existe (lido agora)
- `propostas_planos_2027` já guarda a escolha, o tipo de identificação, `aluno_id`, `vinculo_por_telefone`, `verificacao_vinculo`, `status`/`status_real` e só os 3 últimos dígitos do CPF.
- O aceite de contrato existe hoje em `contratos_documentos`: texto gerado, versão do template, variáveis, aceite, data, IP e assinatura. Ele usa `links_contrato` (token com validade, uso único, origem) e as funções `aceitar-contrato-token` e `aceitar-contrato-documento`. A Corrida tem o próprio `corrida-aceitar-contrato`. Ainda não há campo para o hash do texto.
- O cartão pela Rede já funciona na Loja e na Corrida: o cartão é tokenizado (`rede_tokenizacoes`, `cartoes_salvos`), o checkout usa um token com validade (`links_cartao`), a cobrança sai por criptograma, há limite de tentativas e aviso de recusa. O número do cartão e o CVV não passam pelo sistema.
- O Pix à vista pelo Inter já funciona na Loja e na Corrida (`loja-criar-pix`, `corrida-criar-pix`, `corrida-status-pix`), e o pix-webhook já está corrigido.
- `cobrar-recorrencias-diario` está pausado pela chave `cobranca_recorrente_ativa`. Hoje ele pega toda cobrança pendente de contrato ativo `cartao_recorrencia` com cartão salvo, sem separar 2027 do legado.

## Fase 0 — Conferência inicial (só leitura)
- Contar as propostas, os contratos `cartao_recorrencia` ativos que são legado, as cobranças pendentes e os cartões salvos.
- Conferir o ambiente da Rede com `rede-ambiente-check` e verificar se existe 3DS no fluxo atual.
- Confirmar que os 5 templates jurídicos estão ativos por família e forma de pagamento.
- Pronto quando: os números de referência estiverem anotados para as comparações das fases seguintes.

## Fase 1 — Identificação (celular ou CPF)
- Nova função pública `fn_planos_identificar` recebe `{tipo: 'telefone'|'cpf', valor}`.
- O CPF é validado pelos dígitos no navegador e de novo no servidor. A comparação usa só `cpf_hash` (o mesmo hash já usado no cadastro).
- A resposta é sempre a mesma: `{existe, nome_mascarado}`, com só as iniciais (ex.: "N. T."). Nunca devolve o id do aluno.
- O limite por IP e por valor é o mesmo da busca por telefone. O CPF nunca vai na URL, no log nem em system_logs.
- **Prova de que é a pessoa:** depois do "sim, sou eu", o servidor manda um código de 6 dígitos para o WhatsApp do cadastro (ou para o e-mail, se não houver WhatsApp), mascarado na tela. O código vale 10 minutos, aceita 5 tentativas e só pode ser usado uma vez. Ele fica guardado só como hash, numa tabela nova `planos_verificacoes`.
- Sem o código validado, a compra segue como "novo" e a equipe confere o vínculo depois. Assim ninguém atrela uma cobrança ao cadastro de outra pessoa.
- **Novo aluno:** o cadastro mínimo (nome, WhatsApp, e-mail, CPF cifrado + hash) só é criado no pagamento aprovado (Fase 5). Antes de criar, o sistema checa duplicidade por `cpf_hash` e telefone. Se encontrar alguém, liga a compra ao cadastro existente e avisa a equipe, sem criar um novo.
- Pronto quando: a mesma pergunta der a mesma resposta para quem existe e para quem não existe, o limite bloquear, e nenhum CPF aparecer em system_logs.

## Fase 2 — Fluxo do checkout e o que fica gravado
```text
5 Identificação -> 6 Revisão -> 7 Contrato (aceite) -> 8 Pagamento -> 9 Confirmação
   proposta          proposta      contrato_documento      venda+cobranças   ativação
   (rascunho)        (revisada)    (aceito, hash)          (pendente->paga)
```
- Uma única função `fn_checkout_2027_avancar(proposta_id, chave_sessao, etapa)` recalcula tudo no servidor com `calcularVenda2027` (mesma regra, em SQL ou função) a partir do catálogo. O valor que vem do navegador é ignorado.
- **Idempotência:** cada proposta tem uma `chave_sessao` (aleatória, guardada no navegador) e uma única venda. Reclicar ou recarregar retoma a mesma etapa.
- Com duas abas abertas, a segunda vê "pagamento em andamento". Um índice único por proposta impede duas cobranças.
- **Status da proposta:** rascunho → identificada → contrato_aceito → aguardando_pagamento → paga | falhou | expirada.
- Uma proposta parada expira em 24 horas (o Pix em 30 minutos). Uma proposta expirada pode ser retomada pelo mesmo link: o sistema recalcula e cria um contrato novo se o template mudou.
- Uma recusa no cartão deixa a proposta em `falhou`, sem venda ativa, e permite tentar de novo até 3 vezes.

## Fase 3 — Contrato
- O template é escolhido pelo `familia` + `cartao_recorrencia`/`cartao_parcelado` + `ativo`, e as variáveis vêm de `contratos2027.ts`. Isso segue a regra já registrada; o Pix à vista usa o contrato de parcelado.
- O texto final é mostrado inteiro, com rolagem obrigatória e uma caixa "li e aceito".
- O sistema reaproveita `contratos_documentos` e acrescenta `hash_texto` (SHA-256), `user_agent` e `origem='site'`. O aceite registra data e hora do servidor e o IP.
- O texto aceito fica guardado em HTML. O PDF é gerado a partir dele, sem criar armazenamento novo de arquivos.
- O aceite do site não usa login, então será uma função nova presa à proposta e à `chave_sessao`, reaproveitando a lógica de `aceitar-contrato-token`.

## Fase 4 — Pagamento (só aluno de teste e Rede em sandbox)
**a) Cartão à vista ou em até 12x (Power/Pro):** reaproveita a tokenização da Rede (o cartão é digitado no formulário da Rede, nunca no nosso) e a cobrança por criptograma da Loja, em uma nova função `planos-cobrar-cartao`. Ela lê o valor da venda no banco, nunca do navegador. O 3DS e o antifraude seguem o que a Fase 0 confirmar.

**b) Recorrência no cartão:** o mesmo cartão tokenizado é salvo em `cartoes_salvos`. A primeira mensalidade é cobrada no ato e as 11 seguintes (Power/Pro) ficam em `cobrancas`, com vencimento mensal. O Start tem 1 por ciclo, renovado pela `fn_renovar_start_2027`.
- **Como religar a rotina só para 2027:** acrescentar na busca de `cobrar-recorrencias-diario` o filtro `contratos.catalogo_id` pertencente a um item com `versao` preenchida, e criar uma chave nova `cobranca_recorrente_2027_ativa`. A chave antiga `cobranca_recorrente_ativa` continua desligada e passa a valer só para o legado.
- **Prova de que o legado não é cobrado:** rodar em modo "simulação" (lista quem seria cobrado, sem cobrar) e conferir que todos os contratos da lista são 2027 e que a contagem dos legados é 0.

**c) Pix à vista:** cobrança imediata no Inter, com o mesmo código de `loja-criar-pix`: QR Code e copia-e-cola, válido por 30 minutos. A tela consulta o status a cada 5 segundos e a baixa vem pelo pix-webhook. A Loja e a Corrida continuam sem mudança.

**d) Consultas e corrida:**
- Se o plano está em 12x, as consultas entram nas mesmas parcelas, separadas por parcela em `plano`/`servicos`.
- Se não, as consultas são uma cobrança à parte (até 6x no cartão ou Pix).
- A corrida é sempre uma cobrança separada, ligada ao mesmo contrato.
- Tudo é gravado em `vendas` (`origem='site_2027'`), `cobrancas` (1 por parcela ou mensalidade), `pagamentos` (só na aprovação) e `planos`. A baixa e a conciliação usam o TID (cartão) e o txid (Pix), como já acontece hoje.

**e) Testes:**
- Rede em sandbox com cartões de teste, Pix de R$ 1,00 e só o NICOLAS TESTE (a lista `vendas_2027_teste_aluno_ids`).
- A página fica em `?previa=1` até o go-live.
- Não dá para validar sem cobrança real: a aprovação de um cartão real em produção, o 3DS do banco emissor, a liquidação real da Rede e a cobrança das mensalidades seguintes.
- Proposta: 1 compra real de valor baixo pelo dono, depois estornada, só com um pedido explícito.

## Fase 5 — Pós-pagamento
- O plano e o aluno são ativados por uma função única e idempotente, a mesma usada pela venda do admin. Ela também move o aluno para o funil de Aluno e o põe no Clube.
- Os créditos seguem `liberacao_creditos` e `fn_creditos_mensais_2027`.
- Confirmação por WhatsApp e e-mail, com o mesmo modelo da Loja. A equipe recebe um aviso pelo `notificar-venda-paga`.
- **Reposição de saldo de 50%:** só quando o aluno já tem um plano ativo no momento da compra e a compra é feita até 30 dias depois. O cálculo é feito no servidor com `fn_plano_principal_ativo`. O valor só é lançado depois da aprovação, para conferência do admin; o site não desconta preço sozinho.
- Licença e trancamento continuam como hoje (`aluno_licencas`), sem nada novo no site.

## Fase 6 — Segurança e LGPD
- Tabelas novas com RLS e sem leitura pública. Todo acesso de quem não está logado passa por função `security definer` com `search_path` fixo.
- O preço é sempre recalculado no servidor. Limite por IP em todas as etapas, mais o campo invisível (honeypot) que já existe.
- Turnstile (CAPTCHA) só no envio do código e no pagamento, se o dono aprovar.
- Os logs guardam só o id da proposta e os últimos 3 dígitos do CPF.
- O consentimento é registrado com a versão da política de privacidade.

## Fase 7 — Admin
- Nova aba "Vendas do site" nas Propostas, com filtros por status, a linha do tempo da proposta (identificação, contrato, tentativas, pagamento) e o motivo da recusa.
- Ações:
  - Reenviar o link de pagamento, que reaproveita `links_pagamento`.
  - Concluir manualmente, com o mesmo fluxo da venda 2027 do admin.
  - Confirmar o vínculo com o cadastro.
  - Cancelar.
- Só admin e coordenador veem esta aba.

## Fase 8 — Riscos e como reverter
| Fase | Risco | Como reverter |
|---|---|---|
| 1 | Revelar se um CPF existe | Resposta igual + limite; tirar a busca por CPF do ar desligando uma chave |
| 2-3 | Contrato com o template errado | Validação por família/forma antes de mostrar; desativar o checkout por chave |
| 4a/c | Cobrança dupla | Índice único por proposta + idempotência; estorno só com pedido |
| 4b | Rotina cobrar o legado | Simulação antes; chave 2027 separada; desligar a chave volta tudo |
| 5 | Ativação dupla do plano | Função idempotente por venda |
| Legado | Loja, Corrida, venda do admin e renovação | Sem editar as funções delas; conferir as contagens antes e depois |

Cada fase é uma mudança pequena, com o critério "contagens iguais ao da Fase 0, fora as linhas de teste".

## Perguntas para o dono
1. **Comprovação do Aluno/Ex-aluno:** código por WhatsApp (recomendado) ou só confirmar a data de nascimento? O código é mais seguro; a data de nascimento pode ser descoberta.
2. **Novo aluno:** criar o cadastro só depois do pagamento aprovado (recomendado) ou já na identificação?
3. **CAPTCHA (Turnstile)** no código e no pagamento? Recomendo sim.
4. **Reposição de saldo:** aplicar sozinha no site ou só marcar para a equipe aprovar? Recomendo marcar para aprovar.
5. **Compra real de validação**, de valor baixo e depois estornada, antes do go-live? Recomendo sim, com um pedido explícito na hora.
6. **Validade do Pix à vista:** 30 minutos (recomendado) ou 24 horas?

## Detalhes técnicos
- Novo: `planos_verificacoes` (hash do código, tentativas, validade).
- Colunas novas em `propostas_planos_2027`: `chave_sessao`, `venda_id`, `expira_em`, `tentativas_pagamento`.
- Colunas novas em `contratos_documentos`: `hash_texto`, `user_agent`.
- Índice único `vendas(proposta_id)`.
- Funções: `fn_planos_identificar`, `fn_planos_codigo_enviar/validar`, `fn_checkout_2027_avancar`, `planos-aceitar-contrato`, `planos-cobrar-cartao`, `planos-criar-pix`, `planos-status`.
- Mudança mínima em `cobrar-recorrencias-diario` (filtro + chave 2027 + modo simulação).
- Testes unitários: identificação com resposta igual, recálculo de valores e filtro só-2027 da rotina.
