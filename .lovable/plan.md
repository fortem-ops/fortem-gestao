# /planos: visual claro + parcelas escolhidas no pagamento

## Referências encontradas
- Memória do protótipo aprovado: Archivo, vermelho FORTEM, cantos retos, títulos em caixa alta, voz "você", fluxo de 5 etapas, rodapé fixo com "Detalhes".
- Logo vermelho do projeto (`fortem-logo-red.png`).
- **Não encontrei** imagens do protótipo nem o Manual de Identidade Visual no projeto. A memória não define cores de fundo. Peço que você envie 2 ou 3 capturas do protótipo (celular e computador) e a página de cores do manual. Sem elas, uso a proposta abaixo.

## 1) Visual claro

**Antes:** a página usa um tema próprio escuro (fundo quase preto, cartões cinza-escuros, vermelho como destaque).
**Depois (proposta, a confirmar com as imagens):**
- Fundo branco, cartões em cinza bem claro com borda fina, texto quase preto.
- Vermelho FORTEM só em botão principal, etapa atual, preço e seleção.
- Barra de 5 etapas e rodapé fixo do celular em branco com linha de separação.
- Contraste mínimo AA (4,5:1 no texto). O vermelho atual no branco passa para botões; texto pequeno em vermelho fica um tom mais escuro.

**Como isolar:** a página já tem um escopo próprio (marca na raiz da página com variáveis de cor só dela). Basta trocar os valores desse bloco para o tema claro. O app interno (tema escuro) não muda, porque usa outro escopo.
**Ajustes necessários:** janelas que abrem por cima da página (Detalhes, avisos, listas de seleção) ficam fora desse escopo e hoje herdam o tema escuro do app. Vou aplicar o mesmo escopo a elas só quando abertas dentro do /planos. Também vou revisar cores fixas nos componentes de pagamento, cadastro, contrato, confirmação e aviso de consultas.
**Validação:** capturas antes/depois de cada etapa no computador e no celular, e uma checagem do app interno (painel, financeiro) para confirmar que continua escuro.

## 2) Parcelas escolhidas na tela de pagamento

### a) O contrato cita o número de parcelas?
Não. Conferi os 5 contratos 2027 ativos. Os de cartão parcelado dizem "à vista no PIX ou em até 12x no cartão". A geração do contrato não usa o número de parcelas. **O texto, o aceite e o hash do contrato não mudam.**
O número escolhido fica registrado na tentativa de pagamento e depois na venda e nas parcelas geradas. Regra mantida: 12x comprado no dia 14 gera 12 parcelas no dia 14 de cada mês, todas pagas (29 a 31 vão para o último dia do mês). O e-mail mostra o número efetivamente pago.

### b) Impacto
- **Passo 5:** escolhe só a forma (cartão parcelado, recorrência ou Pix). O resumo, os Detalhes e o rodapé mostram "R$ X em até 12x no cartão".
- **Cálculo e revisão:** hoje o número de parcelas faz parte do resumo guardado na revisão. A tela de pagamento compara o cálculo atual com esse resumo. Se o número mudar no pagamento, essa comparação dispararia "O contrato mudou". **Correção:** o resumo da revisão guarda as parcelas como "até 12" para o cartão parcelado. O total continua conferido ao centavo. A escolha final de 1 a 12 entra só no início do pagamento, que já recalcula o valor no servidor.
- **Tela de pagamento (cartão):** seletor de 1x a 12x com o valor de cada parcela, recalculado pelo servidor. O total é o mesmo em qualquer número de parcelas (sem juros), com a sobra de centavos na última.
- **Ativação, e-mail, estorno:** usam as parcelas da tentativa aprovada, que já são gravadas hoje. A mudança é usar esse número no lugar do número escolhido no passo 5. O estorno não muda, porque já trabalha por cobrança.
- **Banco:** precisa de uma migração pequena em 3 funções do checkout (cálculo, início do pagamento e ativação/e-mail, se ainda lerem o número da proposta). Mostro o texto da migração e o script de volta antes de aplicar, como você pediu.

### c) Sem mudança
Recorrência (12 mensalidades Power/Pro; Start mensal) e Pix à vista seguem iguais e não mostram seletor.

### d) Compatibilidade
- Propostas já existentes, que têm o número de parcelas gravado, continuam valendo: esse número aparece como opção já marcada e ainda pode ser trocado no pagamento.
- O balcão (calculadora de vendas e `fn_venda_2027_criar`) não é tocado.
- O site continua vendendo só o plano. As consultas seguem dormentes.

## Riscos
- Sem as imagens do protótipo, o tom das cores pode não ser o que você aprovou.
- A comparação da revisão é o ponto sensível. Os testes vão cobrir trocar as parcelas sem disparar "O contrato mudou" e o bloqueio quando o total muda de verdade.
- O cartão real (Rede) recebe o número escolhido no pagamento. Isso só é confirmado numa compra real de teste, quando você autorizar.

## Publish pendente
Recomendo **esperar** e publicar uma vez só, junto com estes ajustes. O que está pendente (página sem consultas e correções do "Alterar" e "Começar nova simulação") é seguro, mas publicar agora mudaria o site duas vezes em pouco tempo. Exceção: se você quer o site vendendo já, pode publicar agora; nada nestes ajustes depende disso.

## Ordem de execução (após aprovação)
1. Você envia as imagens do protótipo e do manual (ou aprova a proposta de cores acima).
2. Visual claro (só a página) e capturas antes/depois.
3. Eu mostro a migração das parcelas e o script de volta; você aprova.
4. Aplico a migração, ensaio em transação desfeita e atualizo o checkout e a tela.
5. Regressões: Vitest, testes do pagamento, 12x/3x/1x, Pix, recorrência Power e Start, "Alterar" depois do aceite, estorno e dados do e-mail em simulação. Sem cobrança, estorno ou e-mail real; chaves, crons e flags intactos.

## Detalhes técnicos
- Tema: alterar os tokens do bloco `[data-planos2027="true"]` em `index.css` (`color-scheme: light`). Portais Radix (Dialog/Sheet/Select) ganham `data-planos2027` no conteúdo.
- O resumo de `fn_checkout_2027_calcular`/revisão normaliza `parcelas` para o cartão parcelado. `fn_checkout_2027_pagamento_iniciar` aceita `parcelas` 1..12 e valida com `calcularVenda2027`-equivalente no servidor. A ativação e `email_dados` leem as parcelas da tentativa aprovada.
- `planos-checkout` recebe `parcelas` em `pagar_cartao`/`tokenizar_cartao`; é preciso publicar a função.
