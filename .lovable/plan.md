# Correção: prévia presa em proposta antiga e "O contrato mudou" sem saída

## O que a leitura do código e do banco já mostra
- **Retomada forçada:** ao abrir `/planos`, a página sempre retoma a proposta guardada no navegador (`restaurarSessao`), inclusive em `?previa=1`. Não existe botão para começar outra.
- **Servidor ao "Alterar":** `fn_checkout_2027_alterar` já invalida o aceite, zera `aceite_id`, volta a etapa para `identificada` e grava uma revisão nova. Ele só recusa quando a etapa é `aguardando_pagamento`/`paga` ("Pagamento em andamento"). A invalidação no servidor está correta. O que fica velho é o lado da tela.
- **Beco sem saída confirmado no código:** quando `tela_pagamento` recusa ("O contrato mudou"), a tela cai em `etapa="revisao"` com `revisao` vazia. TENTAR DE NOVO repete exatamente o mesmo caminho (`estado` → `tela_pagamento`) e falha de novo. Nunca chama `revisar` nem leva ao contrato.
- **Estado da simulação das consultas não é zerado:** o "plano aprovado (simulado)" da tela plano + consultas fica guardado por proposta e não é limpo ao Alterar. Além disso, essa tela não tem botão Alterar. É por isso que o dono "fica na tela do pagamento".
- As propostas do dono de hoje (`0db4b90d`, `86a61427`, ambas em contrato_aceito) e as minhas (`a6811b24`, `88afaa87`, `3a2efa3e`) ficam preservadas.

## Passo 1: reproduzir antes de corrigir (prova)
Em `/planos?previa=1`, como admin, com dados de NICOLAS TESTE e tudo simulado:
1. Uma proposta aceita em 12x sem consultas → Alterar para Power 2x + recorrência + Nutri 4+2 → registrar chamadas, etapa e chaves que diferem.
2. Uma proposta aceita com recorrência + consultas e "plano aprovado" simulado → recarregar → Alterar → registrar se volta à tela das consultas com o estado antigo.
3. Forçar a recusa de `tela_pagamento` → confirmar o loop de TENTAR DE NOVO.
Se a causa não bater com o que está acima, paro e reporto antes do passo 2.

## Passo 2: correção mínima (depois do passo 1)
a) **Começar nova simulação (só na prévia)**
- Em `?previa=1`, se houver proposta guardada, mostrar um aviso "Você tem uma simulação em andamento" com **Continuar** e **Começar nova simulação**. Não retomar automaticamente.
- "Começar nova simulação" apaga a sessão e a marca de confirmação guardadas no navegador e volta ao Passo 1. A proposta nova nasce no cadastro, como hoje. A antiga fica no banco, sem ser apagada.
- Também não retomar quando a proposta guardada não for de prévia, ou quando o servidor recusar o `estado`.
- O público continua como está.

b) **Alterar e divergência sem beco**
- **Servidor (`planos-checkout`, só `tela_pagamento`):** a recusa por divergência ou falta de aceite passa a devolver um código interno `refazer_revisao`. O texto mostrado continua o mesmo.
- **Tela:** ao receber esse código, ou quando o estado não tem aceite, chamar `revisar` e ir ao Passo 6 com o resumo novo e o botão de seguir ao contrato. TENTAR DE NOVO só continua para falhas de rede.
- **Alterar:** limpar a marca de confirmação guardada e o estado simulado das consultas daquela proposta. A limpeza usa uma nova ação admin em `planos-consultas-previa`, que só apaga os registros da prévia (`consultas-previa-f2`) dessa proposta.
- **Tela plano + consultas:** ganha o botão Alterar, enquanto o plano não estiver pago de verdade.
- Nada muda no cálculo, nos contratos, nos aceites nem nas regras de pagamento.

## Passo 3: validação
- **Antes e depois:** repetir os 3 cenários do passo 1. Esperado depois: nenhum loop, Alterar leva ao Passo 6 → contrato → novo aceite → pagamento, e "Começar nova simulação" cria uma proposta nova.
- **Regressões:** público sem `previa` continua retomando e segue bloqueado em recorrência + consultas ("contato com a equipe"). Também conferir 12x combinado, Pix do plano, plano sem consultas e confirmação já paga.
- **Testes novos (Vitest):** escolha retomar/nova na prévia; `refazer_revisao` leva à revisão; Alterar limpa a marca. Testes Deno do código de recusa. Rodar a suíte inteira.
- Conferir no computador e no celular.
- Depois, listar as propostas de teste criadas. Só apago com sua aprovação.

## Publicação
- Funções `planos-checkout` e `planos-consultas-previa` são publicadas por mim. A mudança é só na resposta de recusa e na limpeza da prévia.
- A tela precisa de Publish seu.

## Fora do escopo
Sem cobrança real, e-mail real, chaves, crons ou flags. Banco sem migração. Público continua bloqueado. F4 e F5 não entram.
