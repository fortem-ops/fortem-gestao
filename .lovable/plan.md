# Venda dos planos 2027 no ar, sem consultas no site

## Decisão
O site vende só o plano (Start, Power, Pro): cartão parcelado, recorrência e Pix, como já validado. Nutrição e fisioterapia passam a ser fechadas pela equipe e lançadas no balcão. F3, F4 e F5 ficam pausadas. Nada é apagado: código, tabelas e migrações de F1, F2 e F3 continuam lá, sem uso.

## Estado atual (lido agora)
- Checkout público: **ligado**. Cartão real: **ligado**, para **todos**. Recorrência 2027: **ligada**. E-mail de confirmação: **ligado**. Turnstile: **ligado**. Modo de teste: **simulação** (teto do teste de R$ 1,00). Envio de código por e-mail: **liberado**.
- Cron novo das mensalidades 2027 ativo às 08:00 de Brasília. Cron antigo inativo (conferir de novo no go-live).
- O passo 4 de 5 da página ("Acompanhamento") hoje lista os pacotes com preço. Esses preços também aparecem no resumo, nos detalhes, na barra do celular e no pagamento.
- A proposta nasce direto no banco (`fn_proposta_plano_2027_criar`) e recebe a lista de consultas que o navegador envia.
- **Contato:** o número usado na página de planos é `WHATSAPP_FORTEM = 5135199451`, sem o 55 do Brasil. O da página da Corrida é `555135199451`. O primeiro deve abrir o WhatsApp errado, então proponho usar **+55 51 3519-9451** (`555135199451`) nos dois lugares. Confirme se é esse o número oficial.

## 1. Página pública (só tela)
- O passo "Acompanhamento" passa a ser um aviso: "Quer incluir nutrição ou fisioterapia? Fale com a equipe", com botão de WhatsApp e mensagem pronta com o plano escolhido. Nenhum pacote para escolher e nenhum preço.
- Resumo, Detalhes, barra do celular e pagamento deixam de mostrar a linha "Consultas" e passam a usar só o total do plano. A lista de consultas enviada fica sempre vazia.
- Grupo de corrida, pagamento e textos do plano continuam iguais.

## 2. Servidor recusa consultas
- `fn_proposta_plano_2027_criar` passa a recusar qualquer proposta com consultas, com a mensagem "Consultas são contratadas com a equipe". Isso vale também para a prévia admin, porque a simulação fica pausada.
- `planos-checkout` recusa iniciar ou pagar uma proposta pública que tenha consultas gravadas (proteção extra para propostas antigas).
- Não muda nada no balcão (`fn_venda_2027_criar` e `fn_venda_2027_gravar`), nas vendas antigas com consultas, no cálculo, nos contratos e no estorno. Propostas antigas continuam aparecendo em Financeiro → Propostas de contratos.
- Isso exige **uma migração pequena**, que só troca a função de criar proposta. Ela terá um script de volta. Antes, confiro se você já preparou isso no banco.

## 3. Simulação de consultas escondida
- O desvio para a tela de plano + consultas separadas (F2/F3) deixa de ser chamado. Ele fica atrás de uma constante desligada no código, sem apagar nada.
- A função `planos-consultas-previa` fica publicada, mas sem ser chamada. Ela só atende admin.
- O bloqueio "contato com a equipe" para recorrência + consultas fica redundante, porque nenhuma proposta nova terá consultas. Ele **continua no lugar**: não abre nada e protege propostas antigas.

## 4. Checklist de go-live
**Publicar**
- A tela (Publish seu): página de planos sem consultas, e também as correções de "Alterar" e "Começar nova simulação" que ainda não foram publicadas.
- As funções (publicadas por mim): `planos-checkout`, por causa da recusa extra.
- O banco: a migração do item 2.

**Configurações:** todas já estão ligadas como deveriam. Nada a mudar. O modo de teste deve continuar em "simulação".

**Compra real de teste (só quando você autorizar):** NICOLAS TESTE, até R$ 1,00. Em cada forma, confiro:
- a aprovação na Rede ou no Inter;
- a ativação no perfil (plano, contrato, créditos);
- o registro em cobranças e pagamentos;
- um e-mail, um aviso interno e nada em relatórios ou comissão;
- o estorno, só se você pedir.
Formas: Pix à vista, cartão 3x e recorrência Start (1ª mensalidade).

**Riscos em aberto**
- A causa do erro de cartão 107 da Rede não foi confirmada. O teste real dirá.
- Uma compra pública de verdade cobra o valor cheio. Não existe ensaio público de baixo valor.
- O cron só foi provado com zero mensalidades devidas. A 1ª cobrança automática real só acontece um mês depois da 1ª venda com recorrência.
- Confirmar o recebimento do e-mail da Fase E na caixa de teste.
- Corrigir o número do WhatsApp (item acima).

## 5. Regressões e conferência
- Testes automáticos:
  - página: aviso no lugar dos pacotes, sem preço de consultas, lista enviada vazia;
  - servidor: recusa com consultas e aceita sem consultas;
  - balcão com consultas continua funcionando, em ensaio no banco desfeito.
- Rodar a suíte inteira e os testes do pagamento: 12x, Pix, recorrência simples, Start, cron sem devidas, estorno, e-mails (Fase E) e Alterar/nova simulação.
- Ensaio no banco desfeito: proposta pública com consultas recusada, proposta sem consultas criada, venda de balcão com Nutri ok.
- Conferência no computador e no celular: passos 1 a 5, aviso com o WhatsApp, pagamento sem consultas e prévia admin.

## Fora do escopo
Sem cobrança, estorno ou e-mail real. Sem mudar chaves, crons ou flags. Sem tocar Loja, Corrida (só o número, se você aprovar), funções da Rede nem o cron antigo. F3, F4 e F5 pausadas. As propostas de teste continuam guardadas.
