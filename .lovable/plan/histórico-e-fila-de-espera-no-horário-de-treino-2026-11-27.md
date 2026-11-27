# Histórico e fila de espera no horário de treino

Na janela que abre ao clicar num horário da Agenda de Treinos (onde aparecem os alunos agendados), adicionar duas seções novas abaixo da lista de alunos.

## 1. Na fila de espera
- Lista de quem está aguardando vaga naquele horário e dia, em ordem de entrada: nome do aluno e data/hora em que entrou na fila.
- Quando não houver ninguém: "Ninguém na fila de espera."
- Hoje a equipe só vê a quantidade; passa a ver os nomes (somente leitura, sem botões de ação).

## 2. Histórico do horário
Linha do tempo, da mais recente para a mais antiga, com data/hora, aluno, o que aconteceu e quem fez:
- Agendou: pelo próprio aluno (portal) ou pela equipe (nome de quem incluiu).
- Cancelou / removido: quem cancelou (aluno ou nome do profissional) e se o crédito foi devolvido.
- Presença ou falta marcada, e check-in (com a origem, ex.: facial).
- Entrou na fila / saiu da fila / foi avisado de vaga.
- Quando o autor não estiver registrado (agendamentos antigos), aparece "Autor não registrado".

Visível para Admin, Coordenador e professores (todos que já abrem essa janela).

## Detalhes técnicos
- Fontes já existentes: `treino_agendamentos` (created_at/created_by, cancelado_em/cancelado_por, credito_estornado, checkin_em/checkin_origem, status), `portal_fila_espera` (status, created_at, updated_at) e `audit_log` para inclusões/remoções da equipe. Nomes via `profiles` (equipe) e `alunos`.
- Nova migration com `fn_historico_horario_treino(p_slot_id uuid, p_data date)` SECURITY DEFINER, `search_path = public`, verificação de papel de equipe no servidor, retorna eventos já ordenados + fila ativa; REVOKE de anon, GRANT a authenticated.
- Novo componente `src/components/agenda/HistoricoHorarioTreino.tsx`, usado na janela do horário em `src/pages/AgendaTreinos.tsx`; recarrega junto com o refetch existente.
- Teste de regressão em `src/test/` cobrindo a montagem/ordem dos eventos e a regra de "autor não registrado"; vitest e eslint ao final.
- Precisa Publish para aparecer no app publicado.
