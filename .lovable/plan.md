# (1) Leitura — falhas em `portalAgendaE5a.test.tsx`

**Causa:** só o teste ficou desatualizado. O app continua certo.

- O teste espera o menu inferior `Início, Treinos, Benefícios, …`. Em 02/11/2026, no LOTE 4 (Comunidade, alteração `7ba0e01c`), o item **Benefícios** saiu do menu inferior e foi para o menu do perfil. No lugar entrou **Comunidade** (`PortalLayout.tsx:17-21`). O teste foi alterado pela última vez antes disso (`bb12f5f9`, também em 02/11) e não acompanhou a mudança.
- As 4 falhas comparam só a lista de nomes. Um item mudou de nome; a regra da Agenda continua igual.
- O comportamento real foi conferido pelos próprios testes que passam no mesmo arquivo:
  - aluno **só Consultoria**: o menu continua sem Agenda (são 4 itens: Início, Treinos, Comunidade, Evolução). A lista só difere do teste no nome Benefícios/Comunidade;
  - `/portal/agenda` com aluno só Consultoria **redireciona para Treinos** (teste passa);
  - presencial, carregando e erro: a Agenda aparece (só o nome do 4º item difere);
  - o botão de agendar avaliação continua escondido para quem é só Consultoria (teste passa).
- Correção sugerida (não feita): trocar "Benefícios" por "Comunidade" nas 4 listas esperadas do teste. Não precisa mexer no app.

Não abri o portal com um aluno real só Consultoria. A conclusão vem do código e dos testes.

---

# (2) Plano — parcelamento no link `/pagamento/<token>`

## A. Como funciona hoje (verificado)

- **Quem gera o link:** o componente `GerarLinkPagamento`, que aparece no Histórico de Vendas do aluno e em Inscrições da Corrida. Ele chama a função `criar-link-pagamento`, que grava em `links_pagamento` os campos `venda_id`, `token`, `criado_por` e `expira_em`. Se já existe um link válido para a venda, ele é reaproveitado. O link não guarda nenhuma informação de parcelas.
- **O que a página lê:** `validar-link-pagamento` lê a venda, inclusive `vendas.parcelas`, e devolve esse número. A página `PagamentoLink.tsx` só mostra "em Nx" no resumo quando N é maior que 1. Não existe nenhum seletor de parcelas.
- **Como cobra:** `cobrar-link-pagamento` usa o cartão tokenizado e chama `rede-cobrar-token` com `amount = venda.valor_final` e `installments = venda.parcelas`. A cobrança é feita pela Rede, numa transação parcelada pela própria Rede. Se aprovada, grava em `pagamentos_rede`, marca a venda como paga e as `pagamento_parcelas` pendentes como pagas, ativa o contrato e encerra o link.
- **Conclusão:** o parcelamento já existe por baixo. O número vem da venda registrada. O link "Corrida - Pro" R$840 de hoje tem `parcelas = 1` porque a venda foi registrada com 1. Vendas anteriores pelo link saíram em 12x (Power) e 10x (Corrida anual).

## B. Regras atuais de parcelas

- **Planos 2027:** `maxParcelas2027(familia, duracao)`. Power/Pro anual vai até 12x. Consultoria de 4 ou 6 meses vai até 4x/6x. Start é recorrência, sem parcelamento. Os valores saem de `calcularVenda2027`, em centavos, com a sobra na última parcela.
- **Corrida:** `maxParcelasPeriodo` (semestral até 6x, anual até 12x).
- **Sem juros** em todos os casos: o valor total é o mesmo em qualquer número de parcelas. Hoje não existe parcela mínima no código.
- **Agregadoras:** sempre 1x. **Serviços avulsos:** 1x hoje.
- **Reuso:** criar uma função única, "máximo de parcelas da venda", baseada nessas regras existentes (família/duração ou período da Corrida), com um espelho no servidor.

## C. Proposta recomendada

1. **Admin, ao gerar o link:** escolhe o máximo de parcelas (de 1 até o teto da regra do item). Opcionalmente marca "parcelas fixas", e aí o cliente só vê esse número, travado. O padrão é o número já registrado na venda.
2. **Cliente, na página:** vê um seletor de 1x até o máximo, com o valor de cada parcela (centavos, com a sobra na última, sem juros). Com "fixas", vê só o texto "Nx de R$ …", travado.
3. **Servidor valida tudo:** o número enviado pelo navegador é só um pedido. `cobrar-link-pagamento` relê o máximo gravado no link e o teto da regra do item, e recusa se `N < 1`, `N > máximo` ou, no modo fixo, `N ≠ fixo`. O valor sempre vem de `vendas.valor_final`, nunca da página.
4. **Antes de cobrar:** o servidor grava `vendas.parcelas = N` e refaz as `pagamento_parcelas` (só se nenhuma estiver paga). Só então chama a Rede com `installments = N`. Se a cobrança for recusada, nada é baixado, como hoje.
5. **Registro:** a baixa continua igual (`pagamentos_rede`, a venda paga, as parcelas pagas, o contrato ativado). O contrato da venda não muda de valor. Se o texto do contrato citar o número de parcelas, ele mostra o N final. Isso precisa ser conferido na R2.

## D. Tela, banco e o que não muda

- **Só tela:** o campo de máximo/fixo no `GerarLinkPagamento` e o seletor com valores na `PagamentoLink.tsx`.
- **Banco:** colunas novas, que podem ficar vazias, em `links_pagamento`: `parcelas_max` e `parcelas_fixas`. Sem RLS nova (a tabela já é só do servidor).
- **Funções do servidor:** `criar-link-pagamento` passa a receber e validar o máximo, `validar-link-pagamento` passa a devolvê-lo e `cobrar-link-pagamento` passa a receber N, validar e ajustar a venda e as parcelas.
- **Área sensível de cartão:** precisa de ensaio sem cobrança real e de rollback (retirar as colunas e voltar as 3 funções às versões atuais).
- **Não muda:**
  - **links já enviados:** com `parcelas_max` vazio, a página e a cobrança se comportam exatamente como hoje (`venda.parcelas`, sem seletor);
  - `rede-cobrar-token`, recorrência, `/planos`, checkout da Corrida, PIX, Recovery avulso (sempre 1x) e agregadoras.

## E. Riscos e testes

- **Riscos:**
  - cliente forçar um N fora do limite: o servidor recusa;
  - cobrar com N diferente do que foi gravado na venda: o servidor grava antes e confere depois;
  - parcelas duplicadas numa nova tentativa: refazer só se nenhuma estiver paga, numa operação única;
  - contrato citando um número de parcelas errado;
  - venda recorrente gerando link parcelado: bloquear o parcelamento quando `tipo_cobranca = recorrencia`.
- **Testes sem cobrança real:**
  - testes da regra: máximo por item e soma das parcelas igual ao total ao centavo;
  - ensaios SQL com reversão no final: refazer as parcelas e recusar N inválido;
  - função do servidor com cartão simulado ou com a Rede em modo de teste, se ele existir: confirmar o `installments` enviado sem passar cartão;
  - link antigo sem `parcelas_max` idêntico ao de hoje.
- **Cobrança real** só com autorização expressa (Bruna Meyer e estorno depois).

## F. Sub-etapas (cada uma com aprovação separada)

- **P0:** leitura do texto do contrato e das parcelas da venda Corrida (o que cita N) e confirmação de modo de teste da Rede.
- **P1:** banco: colunas em `links_pagamento`, com ensaio e rollback.
- **P2:** funções do servidor: criar, validar e cobrar com validação de N e ajuste das parcelas, com testes simulados.
- **P3:** tela do admin (máximo/fixo) e da página (seletor e valores), mais os testes.
- **P4:** teste real opcional de R$1,00 em 2x, só se autorizado.

## G. Perguntas ao dono

1. **Modo:** o cliente escolhe até um máximo, ou o admin fixa? *Recomendo:* o admin define o máximo, o cliente escolhe dentro dele, e há a opção "fixas" para travar.
2. **Parcela mínima:** existe um valor mínimo por parcela (ex.: R$50)? *Recomendo:* não ter por ora, igual aos planos.
3. **Juros:** sempre sem juros? *Recomendo:* sim, igual a hoje.
4. **Serviços avulsos** (Avaliação, Nutrição pacote) podem ser parcelados pelo link? *Recomendo:* até 3x, ou deixar em 1x por ora.
5. **O link "Corrida - Pro" R$840 de hoje:** basta registrar a venda de novo com o número de parcelas certo e gerar um novo link (já funciona hoje, sem código)? Pode ser a solução imediata enquanto o plano não é aprovado.
