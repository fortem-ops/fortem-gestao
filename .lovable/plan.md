# P4 — Aviso à equipe e e-mail de confirmação quando a proposta do site fica paga

## O que existe hoje (verificado)
- Só `fn_checkout_2027_pix_liquidado` (Pix real, via aviso do Inter ou consulta de reserva) marca a proposta como paga (`etapa_checkout='paga'`, `pago_em`, `pagamento_tipo`, `pagamento_ref`).
- **Cartão ainda não marca a proposta como paga.** O cartão real não está ligado: a função recusa sem chamar a Rede. O cartão simulado só aprova a tentativa e não preenche `pago_em`. Por isso o P4 nasce preso ao Pix, e o cartão chama o mesmo ponto quando for ligado (fase futura).
- O aviso "Nova proposta do site" é criado dentro de `fn_proposta_plano_2027_criar`: grava em `notificacoes` (categoria comercial, prioridade alta) para admins e coordenadores, num bloco que, se falhar, só anota o erro na proposta. O aviso novo usa o mesmo mecanismo.
- O e-mail pelo Resend já existe em `planos-codigo`, com o remetente e o endereço de resposta aprovados.

## Arquitetura
```text
fn_checkout_2027_pix_liquidado  (mesma transação, resultado 'baixado')
   └─ fn_checkout_2027_pos_pagamento(proposta)          [novo, SQL]
        ├─ cria aviso interno UMA vez (trava: notificacao_pagamento_id IS NULL)
        └─ nada de venda/pagamento/aluno/contrato
pix-webhook / status_pagamento  (depois que a baixa volta 'baixado' ou 'ja_processado')
   └─ chama a função planos-confirmacao (edge, só servidor)
        ├─ fn_checkout_2027_email_reservar(proposta): UPDATE atômico que só
        │   reserva se enviado_em IS NULL e a reserva anterior tem mais de 10 min
        ├─ chave planos_email_confirmacao_ativo = false → não envia, registra "desligado"
        ├─ teste_admin → não envia a cliente (ver abaixo)
        ├─ envia pelo Resend → marca email_confirmacao_enviado_em
        └─ falha → registra email_confirmacao_erro + system_logs (sem CPF); a baixa continua
```
- **Aviso duplicado:** é impossível, porque a criação acontece na mesma transação da baixa, com a linha da cobrança travada. A baixa só roda uma vez (o segundo aviso volta `ja_processado`) e a coluna `notificacao_pagamento_id` impede outro aviso.
- **E-mail duplicado:** o webhook e a consulta de reserva podem chamar ao mesmo tempo, mas só um consegue a reserva, porque ela é feita por um UPDATE condicional. O envio só é marcado depois do OK do Resend. Uma reserva presa por mais de 10 minutos pode ser retomada, e isso também cobre o reenvio.
- **Reenvio:** como `ja_processado` também chama planos-confirmacao, um e-mail que falhou é tentado de novo no próximo aviso ou na próxima consulta. A equipe também pode reenviar com a ação `reenviar` (só admin, verificado no servidor).
- **Cartão (futuro):** quando o cartão real marcar a proposta como paga, chama a mesma `fn_checkout_2027_pos_pagamento` e a mesma planos-confirmacao. Nada novo agora.

## Propostas de teste de admin
- O aviso sai com o título começando por "[TESTE]" e o checklist trocado por "Teste de admin: não ativar nada".
- O e-mail nunca vai a cliente. Só é enviado se o e-mail da proposta for o do NICOLAS TESTE (lista de teste fixa) **e** a chave estiver ligada. Nos demais casos, a função devolve o rascunho montado (assunto e corpo) sem enviar, para conferir na tela de teste.

## Textos para aprovação

### Aviso interno (notificação)
Título: `Nova compra do site — pagamento aprovado: {nome}` (com `[TESTE] ` na frente quando for teste de admin)

Descrição:
```text
{Plano} {frequência} · {serviços ou "sem serviços"}
Pagamento: {Pix à vista | Cartão em {N}x} · Total R$ {valor} · aprovado em {dd/mm/aaaa hh:mm}
Vínculo: {aluno vinculado (verificado por e-mail) | possível cadastro existente, confira | novo cadastro}
CPF final {ultimos3} · WhatsApp {whatsapp}

Ativar manualmente:
1. Criar ou vincular o aluno (confira o vínculo acima)
2. Criar o plano
3. Gerar contrato e documentos
4. Liberar créditos 2027
5. Lançar mensalidades/recorrência
6. Configurar reposição (Pro/Treino)
7. Incluir no Clube
Veja em Leads > Propostas do site.
```
Categoria comercial, prioridade alta, destinatários: admins e coordenadores (os mesmos da "Nova proposta do site"). Nunca aparece o CPF completo.

### E-mail de confirmação
Assunto: `FORTEM — pagamento confirmado`

Corpo:
```text
Olá, {primeiro nome}.

Recebemos o seu pagamento. Obrigado por escolher a FORTEM.

Resumo
Plano: {Plano} {frequência}
{Serviços: ... (só se houver)}
Forma de pagamento: {Pix à vista | Cartão de crédito em {N}x}
Total: R$ {valor}

Próximos passos
Nossa equipe vai entrar em contato pelo WhatsApp {whatsapp mascarado, ex.: (51) 9****-1234} para agendar a sua ativação e o início do programa.

Se tiver alguma dúvida, basta responder este e-mail.

Equipe FORTEM
```
Sem CPF, sem dados de cartão, tratamento por "você" e sem exclamações (padrão do código já aprovado). Remetente: FORTEM <nao-responda@soufortem.com.br>; resposta para contatofortem@gmail.com.

## Chave de liberação
- Nova configuração `planos_email_confirmacao_ativo = false`. Enquanto estiver desligada, nenhum e-mail sai; fica registrado "desligado" e o e-mail pode ser enviado depois que você liberar.
- O aviso interno não depende dessa chave.

## Banco (migração prevista `checkout_2027_pos_pagamento`)
- Colunas novas em `propostas_planos_2027`, todas opcionais: `notificacao_pagamento_id`, `email_confirmacao_reservado_em`, `email_confirmacao_enviado_em`, `email_confirmacao_erro`.
- Funções novas: `fn_checkout_2027_pos_pagamento`, `fn_checkout_2027_email_reservar`, `fn_checkout_2027_email_resultado` e `fn_checkout_2027_email_dados` (monta o resumo sem CPF). Todas só para o servidor, com search_path fixo.
- `fn_checkout_2027_pix_liquidado` passa a chamar `fn_checkout_2027_pos_pagamento` quando dá `baixado`. É um bloco protegido: se o aviso falhar, só anota o erro e **não desfaz a baixa**.
- O valor `planos_email_confirmacao_ativo=false` entra pela ferramenta de dados, não pela migração.

## Arquivos
- Nova função `supabase/functions/planos-confirmacao/index.ts` (só servidor), mais `texto.ts` (monta assunto e corpo) e testes.
- O envio pelo Resend sai para `_shared/resend.ts`, usado por planos-confirmacao. `planos-codigo` fica como está, sem mudança.
- `pix-webhook/planos-baixa.ts`: depois de `baixado`/`ja_processado`, chama planos-confirmacao sem esperar a resposta. O pix-webhook em si não muda.
- `planos-checkout/index.ts`: só a consulta de reserva do `status_pagamento` passa a chamar planos-confirmacao quando há baixa.
- Uma regra nova em `planos-checkout/AGENTS.md`.

## Testes (sem cobrança real, sem e-mail a cliente, sem Inter/Rede)
- **Unitários:** montagem do texto (sem CPF e sem cartão, WhatsApp mascarado, "[TESTE]"), regra de envio (chave desligada, teste de admin, lista de teste), falha do Resend sem lançar erro, CPF nunca no log.
- **No banco, com transação desfeita** e uma proposta de teste de admin, usando cobrança e tentativa fictícias:
  - A baixa gera um aviso.
  - O segundo aviso não gera outro.
  - Duas reservas de e-mail seguidas: só a primeira vence.
  - Uma falha registrada não desfaz a baixa.
- **planos-confirmacao chamada de verdade** com a chave desligada: responde "desligado", sem enviar e sem chamar o Resend.
- O aviso do Inter já publicado continua com os mesmos testes passando.

## Riscos
- **Aviso perdido se o bloco falhar:** fica anotado na proposta e em system_logs, e a ação `reenviar` refaz.
- **E-mail com dados errados:** só sai depois que você aprovar o texto e ligar a chave.
- **Chamada sem esperar resposta não chegar à função:** a próxima consulta ou o próximo aviso tenta de novo, e a reserva impede envio em dobro.

## Reversão
- Desligar a chave (os e-mails param na hora).
- Reaplicar a versão atual de `fn_checkout_2027_pix_liquidado`, sem a chamada do aviso.
- As colunas novas ficam sem uso; nenhuma tabela é apagada.

## Não muda
Cartão real, Loja, Corrida, Pix Automático, catálogo, cron e dados de alunos. Nada cria venda, pagamento, aluno ou contrato. `planos_checkout_ativo=false`, modo simulação, nenhuma cobrança.

## Decisões em aberto
- Cartão **simulado** aprovado em proposta de teste de admin também deve gerar o aviso "[TESTE]"? Proposta: não; o aviso só sai quando a proposta realmente fica paga.
