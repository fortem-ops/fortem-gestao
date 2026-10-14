# R6 — Recorrência no cartão aberta ao público

## Situação conferida agora (somente leitura)
- `cobrar-recorrencias-diario` (antigo): **active=false**, às 04:00 UTC. Não há outro job de recorrência.
- Chaves: `planos_recorrencia_ativa=false`, `planos_cartao_real_ativo=true`, `planos_cartao_real_escopo="todos"`, `planos_pagamento_modo_teste="simulacao"`, `planos_checkout_ativo=true`, `planos_teste_valor_max_centavos=100`.
- `planos_2027_mensalidades`: só existem 3 linhas, todas da proposta de teste 21511e24 (já cancelada): 2 pagas e 1 cancelada. **Nenhuma pendente.** Por isso, a 1ª execução terá **0 devidas e 0 cobranças**.

## Ponto que precisa ser resolvido antes do cron
Hoje a função só aceita o modo real com a chave de serviço (ou um token com papel de serviço). Os jobs existentes chamam funções com a chave pública mais um segredo próprio (`x-webhook-secret`), e a chave de serviço não fica disponível para colocar no job. Se o job usar o padrão atual, a função vai recusar com 403 e nunca vai cobrar. Isso é seguro, mas deixa a recorrência sem funcionar.

**Proposta (mudança mínima, só em `planos-recorrencia-diario`):** aceitar também um segredo novo e exclusivo, `PLANOS_RECORRENCIA_CRON_SECRET`, enviado no cabeçalho `x-cron-secret` e comparado em tempo constante. Com esse segredo, a função entra **somente** no modo real normal: não roda a simulação de admin nem o teste real. O segredo é gerado com o gerador de segredos e nunca é registrado em log. O job guarda esse valor da mesma forma que os jobs atuais guardam o deles.

## 1) Cron
- Nome `planos-recorrencia-diario`, horário `0 11 * * *` (08:00 em São Paulo, sem horário de verão). Ele faz um POST para a função com a chave pública, `x-cron-secret` e o corpo `{"trigger":"cron"}`, o que corresponde ao modo real.
- É criado com o comando de SQL avulso, fora das migrações, porque contém a URL e o segredo.
- **Não há risco de cobrança dupla:** o job antigo segue desligado e só lê `cobrancas` e contratos legados. O novo só lê `planos_2027_mensalidades`, com escopo de 2027 garantido no banco (`fn_recorrencia_2027_pode_cobrar`). Além disso, cada mensalidade só aceita uma aprovação (índice único e `idempotency_key` por mensalidade e tentativa), e a reserva bloqueia a linha de forma atômica.

## 2) Ligar `planos_recorrencia_ativa = true`
**Passa a ser possível ao público:**
- Start mensal no cartão por recorrência, com a 1ª mensalidade cobrada na hora e renovação ciclo a ciclo até o cancelamento pela equipe.
- Power/Pro em recorrência: 12 mensalidades com a taxa de R$ 24,90, a 1ª cobrada na hora e as outras 11 pelo cron.
- Cobrança automática diária das mensalidades devidas, com retentativas e aviso interno.

**Continua bloqueado:**
- Recorrência junto com consultas na mesma compra (fase própria, depois).
- Pix Automático no Start.
- Troca de cartão pelo aluno (feita pela equipe).
- E-mail ou WhatsApp de falha ao aluno (só aviso interno).
- Estorno pelo software das linhas de `/planos`.

## 3) Checklist de segurança, conferido por SQL antes de ligar
- [ ] Teto de R$ 30.000 por execução, com alerta interno ao atingir.
- [ ] Máximo de 50 devidas por execução.
- [ ] Retentativas D0/D+1/D+3; na 3ª recusa a mensalidade fica inadimplente e gera um único aviso (comercial/alta, sem CPF nem dados de cartão).
- [ ] Vencimentos nos dias 29–31 passam para o último dia do mês.
- [ ] Resultado incerto fica como `desconhecido`, é conciliado por referência e **nunca** é cobrado de novo.
- [ ] Toda cobrança real, aprovada ou recusada, é espelhada em `pagamentos_rede` (código e mensagem curta, sem cartão).
- [ ] Start sem pagamento até D+3 não libera crédito nem gera o próximo ciclo. Power/Pro inadimplentes mantêm os créditos.
- [ ] O modo de teste continua em `simulacao`, então o teto de R$ 1 não se aplica ao público. Isso é intencional e confirmado.
- [ ] O nome do titular só é mantido em tokens de recorrência ativos e é apagado no encerramento.

## 4) Ordem sugerida
1. Gerar o segredo e publicar a função com a aceitação de `x-cron-secret`, mais um teste unitário (sem segredo recusa, segredo errado recusa, segredo certo entra só no modo real).
2. Criar o cron com a flag **false**. Disparar manualmente uma vez com o mesmo comando do job e esperar `{modo:"real", desligado:true}` e uma linha em `system_logs`.
3. Rodar uma simulação de admin em uma proposta de teste e esperar `0 devidas` sem chamar a Rede.
4. Conferir por SQL: zero mensalidades pendentes e vencidas, e zero linhas novas em `pagamentos_rede`.
5. Ligar `planos_recorrencia_ativa=true`. Disparar o job manualmente uma vez e esperar `devidas=0, cobradas=0`.
6. No dia seguinte, às 11:00 UTC, conferir `cron.job_run_details` e `system_logs`.

**Como desfazer rápido:**
- `planos_recorrencia_ativa=false`: para tudo na hora. O cron continua rodando, mas retorna "desligado".
- `select cron.alter_job(<id>, active := false)` ou `cron.unschedule('planos-recorrencia-diario')`.
- Opcional: `planos_cartao_real_ativo=false` também bloqueia a 1ª mensalidade na tela.

## 5) Elegíveis na 1ª execução
Hoje são **zero**: nenhuma mensalidade pendente existe, e as da 21511e24 estão pagas ou canceladas, com a assinatura cancelada. Só uma venda pública feita depois de ligar a flag criaria mensalidades; a nº2 dela venceria 1 mês depois. Imediatamente antes de ligar, rodar `fn_recorrencia_2027_devidas` (só leitura) e confirmar 0.

## Não será feito
Não religar nem editar `cobrar-recorrencias-diario`. Não tocar em Loja, Corrida, `rede-*` nem `_shared/rede-recorrencia-core.ts`. Não alterar outras chaves. Não fazer cobrança de teste. Não implementar estorno. Não implementar consultas junto com recorrência.

## Pergunta
Aprova o segredo dedicado `x-cron-secret` (recomendado) em vez de tentar colocar a chave de serviço no job, o que não é possível aqui?
