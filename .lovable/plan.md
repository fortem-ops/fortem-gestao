# Plano Semestral para alunos de agregadoras (Wellhub / TotalPass)

Somente plano. Nada será gravado até a sua aprovação, uma etapa por vez.

## O que já foi conferido no banco (11/11/2026)
- `planos_catalogo` já tem as colunas necessárias: `codigo`, `familia`, `versao`, `modalidade_cobranca`, `liberacao_creditos`, `taxa_recorrencia`, `fidelidade_meses`, `licenca_dias`, `avaliacoes_funcionais_meses`, `permite_fixar_horario`, `bota_compressao_mes`, `nivel_clube`, `reposicao_saldo_pct`, `brindes`, `vendavel_desde/ate`. Não existe coluna de agregadora nem de "período de preço fixo".
- Start 2027 usa `liberacao_creditos = 'mensal'`, taxa 0. Pro 2027 usa `avaliacoes_funcionais_meses = {1,6}` com `total_na_compra` (libera tudo na venda).
- A cobrança diária (`fn_recorrencia_2027_devidas`) não filtra por `versao`: lê só `planos_2027_mensalidades`. Um item entra na cobrança somente se uma venda gerar linhas nessa tabela.
- `contrato_templates` (36 modelos) já tem tipos `wellhub`, `gympass` e `totalpass` ativos para os planos de agregadora atuais. A regra de modelo único vale por `plano_tipo + forma_pagamento`.

## Etapas

### Etapa 1: Catálogo e contratos (só banco, tudo desligado)
- Migração: adicionar a `planos_catalogo` as colunas `agregadora_requerida` (texto: `wellhub` / `totalpass`, nulo nos demais) e `preco_fixo_ciclos` (inteiro, nulo nos demais). Mudança apenas aditiva.
- Inserir os 4 itens com `ativo = false`: `versao 2027`, família nova `semestral_2027`, `recorrencia_mensal`, `liberacao_creditos 'mensal'`, 12 créditos, frequência 3x, `taxa_recorrencia 0`, `fidelidade_meses 0`, `licenca_dias 0`, `reposicao_saldo_pct 0`, brindes vazio, `nivel_clube` igual ao do Start 2027, `avaliacoes_funcionais_meses {1,6}`, `vendavel_ate 2026-12-31`, `preco_fixo_ciclos 6`. Somente nos itens Pro: fixar horário ativado e bota com 4 sessões.
- Inserir 2 modelos novos inativos com `plano_tipo` próprio (`semestral_wellhub` e `semestral_totalpass`, cartão recorrente) e texto provisório. Assim não há choque com os modelos de agregadora atuais.
- Verificação: os 4 itens com seus valores e flags, `ativo = false`, e os 2 modelos inativos. A contagem dos demais itens e modelos não muda.

### Etapa 2: Elegibilidade no servidor
- Nova função `fn_semestral_elegivel(aluno, codigo)`. Ela lê o plano de agregadora ativo do aluno pela função canônica e mapeia `planos.tipo` ("Gympass/Wellhub" → wellhub, "Total Pass" → totalpass). Recusa nos casos: agregadora diferente, sem agregadora, CPF que já contratou (busca por CPF em contratos e vendas semestrais, inclusive cancelados) ou fora de `vendavel_ate`.
- A RPC que lista os planos da Nova Venda e a RPC que grava a venda chamam essa função. Itens com `agregadora_requerida` nunca são devolvidos a quem não tem a agregadora.
- Verificação: chamada direta da função para um aluno Wellhub, um TotalPass e um sem agregadora (ensaio revertido), mais a contagem de itens que cada um recebe.

### Etapa 3: Nova Venda (tela) e ativação
- Aba Planos: o grupo "Plano Semestral" aparece só quando o servidor devolve itens. A tela não faz filtro próprio.
- A venda segue o caminho das vendas manuais 2027 recorrentes: `planos_2027_mensalidades` ligada por `venda_origem_id`, 1º ciclo cobrado na hora, ciclo de 30 dias a partir da venda.
- Na ativação, o plano da agregadora é encerrado (`ativo=false`, `data_fim` = data da ativação). Os registros de check-in da agregadora em `contratos` ficam como estão.
- Verificação: venda de ensaio revertida. Contrato, mensalidade nº 1, 12 créditos só após o pagamento e plano da agregadora encerrado.

### Etapa 4: Renovação mensal e cobrança no cartão
- Renovação por ciclo igual à do Start (`fn_renovar_start_2027` estendida à família `semestral_2027`, ou uma cópia dedicada). Créditos não usados expiram no fim do ciclo. Ciclos 1 a 6 usam o preço da venda; do 7º em diante, usam o valor vigente no contrato (ajuste manual).
- Cancelamento: as próximas mensalidades são canceladas e o acesso vai até o fim do ciclo pago.
- Pix Automático: o item fica marcado como elegível, mas desligado (sem botão) até a conclusão das etapas do grupo Pix.
- Verificação: ensaio revertido de D0 do ciclo 2, com mensalidade gerada uma única vez e créditos bloqueados até o pagamento.

### Etapa 5: 2ª Avaliação Funcional condicional
- Na venda, cria-se só o crédito da 1ª avaliação.
- Uma rotina diária (dentro da renovação do ciclo) libera a 2ª avaliação quando todas estas condições valem: o ciclo que começa é o 6º, o contrato está ativo, não há mensalidade vencida em aberto e o crédito ainda não foi dado. Uma marca no contrato impede liberar duas vezes.
- Se o aluno estiver em atraso no início do 6º ciclo, a liberação acontece quando a pendência for paga, ainda dentro do 6º ciclo. Se o ciclo 6 terminar com atraso, a avaliação não é liberada. Confirmar se é essa a regra desejada.
- Verificação: três ensaios revertidos (em dia → libera; em atraso → não libera; segunda execução → não duplica).

### Etapa 6: Upgrade Start → Pro Semestral
- Cobra a diferença proporcional dos dias restantes do ciclo, troca o item do contrato e mantém a data de início, a contagem de ciclos e o período de preço fixo. Fixar horário e bota passam a valer a partir do upgrade. Downgrade é bloqueado no servidor.
- Verificação: ensaio com o valor da diferença conferido à mão, sem nova mensalidade nº 1 e contagem de ciclos mantida.

### Etapa 7: Ligar a venda
- `ativo = true` nos 4 itens. Os modelos de contrato só são ativados depois que o texto jurídico chegar.

## Cobrança diária sem afetar os planos atuais
- O cron cobra apenas linhas de `planos_2027_mensalidades`, e essas linhas só nascem de vendas 2027. Planos atuais nunca geram linhas ali, e `cobranca_recorrente_ativa` / `cobrar-recorrencias-diario` não são tocados.
- Verificação: `select count(*) from planos_2027_mensalidades m join contratos c ... where plano não é 2027` deve dar sempre 0.

## Riscos na Nova Venda
- A lista de planos por família pode mostrar "Start" duplicado (Start 2027 e Start Semestral). Por isso o nome de exibição recebe o grupo "Semestral".
- `planos.tipo` está em formato de exibição. Comparar texto sem mapeamento faria aluno Wellhub não ser reconhecido.
- Regra do Start ("Start sem pagamento até D+3 não libera crédito") e regra do Clube: é preciso conferir que funções escritas para `start_2027` também cobrem a família nova, para evitar créditos não liberados ou multiplicador errado.
- Fiscais de auditoria e o resolvedor de plano principal precisam reconhecer a família nova como plano principal.
- Teste existente `src/test/novaVendaAbas.test.ts` pode precisar de ajuste.

## Verificação geral
A cada etapa: ensaios SQL revertidos, consultas de contagem antes e depois, `bunx vitest run`, tipos e lint. Nada é ativado ao vivo sem o seu OK.

## Pontos para você confirmar
1. Regra da 2ª avaliação com atraso no 6º ciclo (proposta acima).
2. "Uma contratação por CPF" inclui quem cancelou? Proposta: sim, nunca pode recontratar.
3. Se o aluno tiver Wellhub e TotalPass ativos ao mesmo tempo: bloquear e pedir para a equipe resolver?
