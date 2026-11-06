# Agenda de Serviços, Recovery mensal e compra avulsa (portal)

## Parte 1 — concluída
- "Avaliação Física" saiu da aba Serviços do portal. Era o único ponto no portal; equipe, relatórios, catálogo e agenda não foram tocados.
- Nenhum aluno tem agendamento de Avaliação Física (nem futuro nem passado), então nada muda para ninguém.

## Ponto de atenção antes da Parte 4 (pagamentos)
Hoje, quando uma venda de serviço é criada (tipo "servico", fora do catálogo 2027), o gatilho `fn_processar_venda` já cria o crédito no momento em que a venda é criada, **antes do pagamento**. Se o portal criar a venda do Recovery por esse caminho, o aluno ganharia o crédito sem pagar.

Proposta: o item "Recovery - 1 sessão" é marcado com uma flag nova (`liberar_apos_pagamento`) que faz `fn_processar_venda` pular esse item, e o crédito entra só quando a venda passa a "pago", por um gatilho próprio com uma chave única por venda (um único crédito por venda). Se a venda for estornada ou cancelada, o crédito é desativado quando ainda não foi usado. O resto do legado não muda.

## Parte 2 — Recovery mensal (Pro e Corrida)
- Nova função diária `fn_recovery_mensal` (cron diário, só o sistema pode executar). `fn_creditos_mensais_2027` não é alterada.
- Elegíveis: plano vigente com nome Pro (versões antigas), VIP, "Corrida - Start", "Corrida - Start+", "Corrida - Power", "Corrida - Pro", "Corrida - Prospect" e "Corrida - Sem Plano". Fora: agregadores e quem já recebe a bota pelo Pro 2027.
- 4 créditos por ciclo por aluno, no total (Pro + Corrida = 4). O ciclo começa no início do plano elegível mais antigo e vale até a véspera do ciclo seguinte; ao abrir um ciclo novo, o saldo anterior é desativado. Reexecutar não duplica (chave por aluno + ciclo).
- Bloqueado se houver pagamento vencido há mais de 3 dias (`creditos_2027_tolerancia_dias`) e, no cartão recorrente, se a mensalidade do ciclo não estiver paga.
- Liberação inicial: quem já é elegível recebe 4 menos as sessões de Recovery já agendadas ou feitas no ciclo atual. Sem pontos.
- Portal mostra "X de 4 sessões neste ciclo" e "renova em dd/mm". A agenda da equipe usa o mesmo saldo (as duas funções de agendamento debitam de `creditos_aluno`; confirmo e informo como).

## Parte 3 — Serviços no padrão dos treinos
- Cartões retos com ícone, nome e saldo; ao escolher, seletor de dia (14 dias, só dias com horário) e grade Manhã/Tarde/Noite com os mesmos chips dos treinos (livre, OCUPADO, AGENDADO).
- Folha "CONFIRMAR [SERVIÇO]" com horário, dia, local, profissional, crédito usado, saldo restante e regra das 8 horas.
- Sem crédito: "Falar com a equipe"; no Recovery também "Comprar 1 sessão por R$ XX,00".
- "Meus agendamentos" inclui serviços futuros com cancelamento; histórico mantido.

## Parte 4 — Compra avulsa de Recovery (R$ 50)
- Item novo no catálogo de serviços: "Recovery - 1 sessão", 1 sessão, R$ 50,00, ativo, sem comissão, editável pelo gestor.
- Função nova só para o aluno logado, para ele mesmo: reaproveita a venda pendente e o link válido se já existirem; senão cria uma venda pendente com o valor do catálogo e um link, e abre /pagamento/:token (PIX e cartão, mesmo caminho dos links "generica").
- Crédito só depois do pagamento aprovado (ver ponto de atenção acima).
- Verifico e informo se a venda dá os 30 pontos de "Serviço contratado", sem mudar essa regra.

## Verificação
Ensaios SQL desfeitos no final para todos os casos pedidos, revisão de segurança, checagem de tipos, compra testada até a tela de pagamento sem cobrar, e uma linha por parte no roadmap. Um pagamento real só com sua autorização (cadastro NICOLAS TESTE e estorno depois).
