# F3 — Cartão das consultas (com plano em recorrência) + 2 ajustes da F2

## Ajustes visuais da F2
1. Espaço vazio entre "R$ … por mês · 12 cobranças" e "Pagamento das consultas": localizar o elemento oculto/aviso vazio que reserva altura e remover a margem sobrando (desktop e celular).
2. Bloco CONSULTAS: mostrar "6x de R$ 270,00 (total R$ 1.620,00)" conforme as parcelas escolhidas, atualizando na hora; sobra de centavos na última parcela (mesma regra das vendas 2027).

## F3 — Cartão das consultas
- Segunda tokenização e captura na Rede, separadas da do plano: novo cartão digitado (pode ser o mesmo), compra iniciada pelo titular, criptograma próprio por transação, 1 a 6x, sem desconto.
- Valor sempre o congelado na obrigação das consultas (servidor), nunca o enviado pela tela.
- Só libera depois do plano pago/ativado; retomável por 7 dias com preço e aceite congelados; após o prazo ou cancelamento do plano, exige novo aceite (regras da F1).
- Uma reserva por proposta + obrigação das consultas: clique duplo, recarregar ou repetir não gera segunda cobrança. Resultado desconhecido bloqueia nova tentativa até conciliar por consulta à Rede pela referência.
- Ao aprovar: espelhar em pagamentos da Rede e na cobrança da consulta, no padrão existente. NÃO cria venda, créditos, ativação nem e-mail (isso é F5).
- Habilitado somente na prévia admin (sessão admin conferida no servidor, proposta de prévia/teste). Visitante segue vendo "contato com a equipe".
- Nesta entrega: só simulação (Rede simulada) e ensaios no banco desfeitos ao final. Teste real (máx. R$ 1,00) apenas quando você pedir depois — fica travado.
- Nada de número completo/CVV/CPF em registros; só bandeira e 4 últimos.

## Não muda
Chaves, crons, flags, cron antigo de recorrência, planos sem recorrência, 12x combinado, Pix do plano, Loja, Corrida.

## Testes
Simulação: aprovado, recusado, desconhecido (bloqueio), repetição sem duplicar, antes do plano pago (recusa), prazo de 7 dias vencido (novo aceite), não-admin/público (recusa). Regressões completas + conferência visual desktop/celular.

## Detalhes técnicos
- Reaproveitar `_shared/planos-cartao-rede.ts` (tokenizar/cobrar/consultarPorReferencia) e o fluxo de `planos-checkout/fluxo-cartao.ts` com dependências injetáveis; nova ação na função de prévia das consultas (`cartao_consultas`, `status_consultas`), referência própria distinta da do plano.
- Tentativas com finalidade `consultas` (coluna criada na F1) e trava atômica por obrigação; liquidação por RPC dedicada que só espelha (`pagamentos_rede`/`cobrancas`) e marca a obrigação paga.
- Possível migração pequena só se a RPC de espelho das consultas não existir na F1 (ensaiada em transação desfeita, com script de reversão).
- Publish: a função de prévia precisa ser publicada; a tela precisa de Publish do app.
