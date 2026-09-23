# Fiscal de Agenda de Serviços (categoria `agenda_servicos`)

## O que o levantamento mostrou (lido no banco hoje)

- `agenda_servicos` tem: `atividade` (Treino Experimental, Reabilitação, Avaliação Funcional, Nutrição), `local` (texto livre, na prática 3 salas: Reabilitação, Treinamento, Nutrição), `profissional_id`, `aluno_id` (47 horários sem aluno), `tipo` (`fixo` = semanal por `dia_semana`; `avulso` = `data_especifica`), `horario_inicio`/`horario_fim` (hora, sem data). Datas retiradas da agenda ficam em `agenda_servicos_excecoes`.
- Não existe coluna de sala separada: "sala" = `local`.
- Plano Max: existem 7 variantes no catálogo e 2 planos Max no histórico, mas **nenhum plano Max ativo hoje**. A checagem 1 vai nascer com 0 casos.
- Os planos guardam os serviços contratados em `planos.servicos` (ex.: "2 Consultas Nutrição", "2 Consultas Reabilitação").
- Contagem aproximada de sobreposições nos últimos 30 dias (sem refinar): 29 pares — inclui horários vazios, que serão excluídos.
- O fiscal de pagamentos já roda diariamente às 09:00 UTC (`auditoria-fiscal-pagamentos-diario`); o de créditos roda sob demanda.

## Checagem 1 — Max sem Nutrição ou sem Fisioterapia (atenção)

- Alvo: aluno com plano ativo cujo `tipo` contém "Max" (sem Corrida/agregadora).
- Para cada serviço obrigatório (Nutrição; Reabilitação = fisioterapia), procura agendamento em `agenda_servicos` do aluno com a atividade correspondente, dentro da vigência do plano (`data_inicio` até `data_fim`), avulso com data na vigência ou fixo ativo.
- Um item por serviço faltante: subtipo `max_sem_nutricao` e/ou `max_sem_fisioterapia`. Se faltar os dois, são 2 itens (regra "E", não "OU").
- Carência: só alerta se o plano começou há mais de 30 dias (evita alerta no dia da venda). Ajustável.

## Checagem 2 — Conflito de sala/profissional

- Só horários com aluno (`aluno_id` preenchido).
- Compara pares no mesmo dia real, com intervalo que realmente se cruza (`inicio_a < fim_b` e `inicio_b < fim_a`) — sobreposição real, não só mesmo horário de início:
  - avulso x avulso: mesma data;
  - fixo x fixo: mesmo dia da semana;
  - fixo x avulso: dia da semana da data avulsa, ignorando se essa data está nas exceções do fixo.
- Janela: de hoje até 30 dias à frente (conflitos futuros, que ainda dá para resolver).
- Subtipos: `conflito_profissional` (mesmo profissional) — **crítico**, pois ninguém atende dois ao mesmo tempo; `conflito_sala` (mesmo local, profissionais diferentes) — **atenção**.
- Exceção proposta: "Sala de Treinamento" fica fora do conflito de sala (é ambiente coletivo; treinos experimentais simultâneos são normais). Conflito de profissional continua valendo lá.
- `registros_afetados` guarda os 2 ids, data, horários, local e profissional.

## Tela

- `/auditoria`: nova opção "Agenda de Serviços" no filtro de categoria e rótulos dos 3 subtipos.
- Widget do Dashboard: rótulo da categoria.
- Contador no menu: já soma todas as categorias abertas — só confirmar que entra.
- Botão/rotina para rodar o fiscal igual aos outros.

## Detalhes técnicos

- Migração: `fn_auditoria_fiscal_agenda_servicos()` SECURITY DEFINER, `search_path=public`, EXECUTE só `authenticated` (checando staff/admin dentro) e `service_role`; revogar de `anon`/`public`. Mesmo padrão de deduplicação dos fiscais existentes (não duplica item aberto com mesma chave; não reabre ignorados).
- Se `auditoria_inconsistencias.categoria` tiver CHECK, recriar incluindo `agenda_servicos` com todos os valores antigos (verificar antes).
- Agendamento diário: adicionar ao cron junto do fiscal de pagamentos (09:00 UTC) — só com sua confirmação.
- Arquivos: `src/pages/Auditoria.tsx`, `src/components/dashboard/AuditoriaWidget.tsx`, `src/hooks/useAuditoria.ts` (se houver disparo manual), `AppSidebar.tsx` (só conferir).
- Antes de gravar: rodar a lógica como SELECT e mostrar a lista de casos; nenhum dado de agenda, crédito ou plano é alterado.

## Pontos para você confirmar

1. Checagem 1 só para Max (hoje 0 casos) ou também para qualquer plano que tenha Nutrição/Reabilitação em `servicos`?
2. Carência de 30 dias para a checagem 1 está boa?
3. Excluir "Sala de Treinamento" do conflito de sala?
4. Rodar diariamente pelo cron ou só pelo botão?
