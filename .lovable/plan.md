# Horários lotados aparecendo como disponíveis no portal

## O que foi confirmado
- Sexta 27/11, 16:00 e 16:30: a equipe reduziu a capacidade desses horários para 1 vaga só nesse dia (edição pontual), e cada um já tem 1 aluno agendado (Airton às 16:00, Taís às 16:30). Ou seja, estão lotados.
- O portal conta as vagas lendo os agendamentos do dia direto da tabela. Pela regra de privacidade, o aluno só enxerga os próprios agendamentos, então a conta dá 0 ocupados e o portal mostra "1 vaga".
- Como o portal acha que há vaga, ele não mostra a opção de fila de espera. O servidor, que enxerga tudo, sabe que está lotado. Por isso a aluna fica sem conseguir agendar nem entrar na fila.
- Esse problema atinge qualquer horário de treino, não só os que têm capacidade reduzida. Só fica mais visível quando a capacidade é pequena.

## Correção
1. Criar uma função segura no servidor que devolve, para uma data, quantos lugares estão ocupados em cada horário de treino. Ela devolve só números, nunca nomes nem quem agendou, e só para usuários logados.
2. O portal passa a usar essa contagem para mostrar vagas e "LOTADO". Assim, horários cheios mostram a opção "Avisar quando vagar" (fila de espera).
3. Conferir se a agenda de serviços do portal (Nutrição, Reabilitação etc.) tem o mesmo problema de privacidade ao marcar um horário como "OCUPADO" e, se tiver, corrigir da mesma forma.
4. Adicionar um teste de regressão que garante que o portal usa a contagem do servidor, e não a leitura direta da tabela.

## Detalhes técnicos
- Migration: `fn_portal_ocupacao_treinos(p_data date)` com SECURITY DEFINER, `search_path` fixo e STABLE. Retorna `(slot_id uuid, ocupadas int)` e conta os status `agendado/confirmado/realizado/faltou`, os mesmos de `fn_portal_fila_espera_entrar`. Fica executável por `authenticated`, sem `anon`.
- `PortalAgenda.tsx`: a query `portal-vagas-dia` passa a chamar o RPC. `ocupadas` sai do mapa por `slot_id`. A capacidade continua vindo de `aplicarExcecaoNoSlot`. As invalidações atuais continuam iguais.
- Verificar como `ocupadosSet` dos serviços é carregado (agenda_servicos sob RLS) e aplicar o mesmo padrão se for preciso.
- Teste em `src/test/`. Rodar vitest e eslint. Validar com SQL revertido que as 16:00 e 16:30 de 27/11 voltam `ocupadas = 1`.
- A mudança na tela do portal só chega aos alunos depois de publicar.
