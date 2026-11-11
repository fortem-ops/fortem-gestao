# Plano Semestral: link para o aluno pagar a 1ª mensalidade pelo celular

Nada é executado antes da sua aprovação. A venda do ANTONIO VAN BASTEN MACHADO não é tocada em nenhuma etapa.

## O que já existe (conferido) e será reaproveitado
- **Link de pagamento `/pagamento/:token`** (tabela `links_pagamento`, uma linha por venda): nasce em "Histórico de vendas" pelo botão que hoje só copia o link. Vale 7 dias, é reaproveitado se ainda estiver válido e fica marcado como usado depois de pago. Gerar e enviar exige admin ou coordenador.
- **Na página do link**, o aluno já cadastra o cartão pela tokenização da Rede (com o nome do titular, mesmo componente da Corrida/Loja) e paga. A cobrança passa por `rede-cobrar-token`, que desde a correção de 11/11 leva a venda de balcão recorrente ao caminho da 1ª mensalidade (reserva + baixa única + `fn_semestral_ativar_venda`). Ou seja: a agregadora só encerra depois do pagamento aprovado.
- **Aceite online do contrato** já existe em outra página (`/contrato/:token`, tabela `links_contrato`). A página de pagamento só mostra o contrato, não colhe o aceite.
- **Link só para cadastrar cartão** (`links_cartao`, 24 h) também existe. Não serve aqui, porque não cobra.
- **Turnstile** (proteção contra robôs) existe, mas só no /planos público.
- **Envio:** WhatsApp oficial só com modelo aprovado na Meta, e os disparos automáticos devem continuar desligados. Já o e-mail pelo Resend (`nao-responda@soufortem.com.br`) já é usado nas confirmações de Loja e Corrida.

## 1. Fluxo do aluno
1. Na venda Semestral aguardando pagamento ("Nenhum cartão salvo"), a equipe clica em **"Enviar link de pagamento ao aluno"** e escolhe "WhatsApp" ou "E-mail".
2. O aluno abre o link e vê o **resumo**: plano (ex.: Start Semestral 3x), valor da 1ª mensalidade, recorrência a cada 30 dias, sem fidelidade, e que o cartão fica salvo para os próximos ciclos.
3. **Aceite do contrato** da agregadora dele (versão 2), na mesma página e reaproveitando a gravação do aceite online (data, IP, formato "aceite digital pelo link de pagamento"). Sem aceite, o botão de pagar fica travado.
4. **Cadastro do cartão** pela tokenização da Rede, com o nome do titular.
5. **Pagamento da 1ª mensalidade** com um único botão. Se aprovar, a ativação é a mesma da 4B (12 Treinos, Bota no Pro, Avaliação, nº 2, encerramento da agregadora). Se recusar, aparece o motivo, nada é ligado e ele pode tentar outro cartão no mesmo link.

## 2. Segurança
- **Link:** um por venda, token aleatório longo, sem login. A página só mostra o primeiro nome do aluno, o plano e o valor. Nada de CPF, endereço ou dados de outros alunos.
- **Validade:** sugiro 72 horas, e nunca depois da data de expiração da venda (ver item 4).
- **Uso único:** depois de pago, o link mostra só "Pagamento confirmado". Reabrir o link não cobra de novo, e clique repetido cai na mesma reserva (trava da 4B).
- **Elegibilidade conferida de novo no servidor na hora de pagar:** agregadora certa ainda ativa, CPF sem outra venda Semestral paga e prazo até 31/12/2026. Se falhar, nada é cobrado e a equipe é avisada.
- **Proteção contra robôs:** Turnstile no botão de pagar, igual ao /planos.
- **Venda encerrada:** se a venda tiver sido desistida ou expirada, ou se o Pix Automático estiver reservado, o link recusa.

## 3. Envio (o mais simples)
- **WhatsApp:** botão que abre o wa.me no celular/computador da equipe, com a mensagem pronta e o link. Não envia nada sozinho e não precisa de modelo na Meta, porque é a própria equipe que manda.
- **E-mail pelo Resend:** e-mail único com o link, só se o aluno tiver e-mail.
- **Recomendação:** começar só com WhatsApp (mais rápido e sem risco). O e-mail fica como etapa opcional.

## 4. "Desistir da venda" e a expiração de 7 dias
- O link **vence junto com a venda**. A validade é o que vier primeiro: 72 h ou a data em que a venda expiraria.
- "Desistir da venda" e a expiração automática **invalidam o link na hora**, pelo mesmo `fn_semestral_encerrar_sem_pagamento`.
- Se o pagamento estiver em andamento ou incerto, a venda não expira (regra da 4C) e o link mostra "pagamento em análise".
- Gerar o link de novo devolve o mesmo, se ainda for válido. Se estiver vencido e a venda ainda estiver aberta, gera um novo, e o antigo deixa de valer.

## 5. Etapas
- **Etapa A — servidor:** link da venda Semestral, validade, invalidação em desistência/expiração, rechecagem da elegibilidade e do aceite antes de cobrar, e ajuste do caminho "já pago" do link para usar a mesma regra de venda de balcão (hoje esse trecho só reconhece `origem = manual`).
- **Etapa B — página do aluno:** resumo, aceite, cartão e pagamento, com Turnstile.
- **Etapa C — tela da equipe:** botão "Enviar link de pagamento ao aluno" com WhatsApp pronto e "Copiar link".
- **Etapa D (opcional):** envio por e-mail pelo Resend.
- **Etapa E:** ensaio revertido com aluno Wellhub e TotalPass e com a Rede simulada. Teste real só se você pedir, com a Bruna e R$ 1,00.

## Testes de regressão
- Regra pura da validade do link (72 h, nunca depois da expiração da venda).
- Link recusado depois de pago, desistido, expirado ou sem aceite.
- Rechecagem de elegibilidade que falha (agregadora encerrada nesse meio-tempo, ou CPF já usado).
- Clique repetido na mesma reserva, sem segunda cobrança.
- Mensagem pronta do WhatsApp sem nenhum dado sensível.

## Como verificar no banco
- Link da venda (`links_pagamento`): validade, usado ou não, venda ligada.
- Aceite gravado (`contratos_documentos.aceite`, data, IP).
- Tokenização, cartão salvo e `pagamentos_rede` (approved, um só).
- Venda paga, nº 1 paga, plano e créditos ativos, nº 2 criada uma vez e agregadora encerrada só depois.
- Venda desistida ou expirada: link sem valor e nada ligado.

## Dúvidas para você decidir
1. **Validade do link:** 72 h (sugerido), 24 h ou 7 dias?
2. **Aceite do contrato:** obrigatório na página do link (sugerido), ou a equipe colhe o aceite à parte?
3. **Envio:** só WhatsApp por enquanto (sugerido), ou WhatsApp e e-mail já na primeira entrega?
4. **Recusa do cartão:** o aluno pode tentar outro cartão no mesmo link (sugerido), ou só a equipe reabre?
5. **Quem pode enviar:** admin e coordenador (como hoje), ou também consultor/professor?
6. **Mensagem do WhatsApp:** posso escrever uma proposta curta para você aprovar.
