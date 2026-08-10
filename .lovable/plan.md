# WhatsApp em reserva de vaga fixa + opções de cancelamento

## 1. Por que a mensagem da Laura não saiu (confirmado no código)

Quando um aluno é vinculado a uma **vaga fixa**, o salvamento roda em modo edição e cria a reserva avulsa por dentro desse fluxo. Os disparos (WhatsApp e e-mail) no `onSuccess` estão condicionados a `!isEditing`, então nenhum deles foi acionado — mesmo tendo sido criado um novo agendamento com aluno.

A trigger do banco também não cobriria: ela só notifica atividades "Treino Experimental" e "Avaliação Funcional" (Reabilitação fica de fora) e é do fluxo de e-mail, não do WhatsApp.

### Correção
Passar a disparar sempre que a operação **resultar em um novo agendamento com aluno**, independentemente de ter partido de uma vaga fixa:
- `whatsapp-disparo-agenda` com `evento: "agendamento_criado"` para a reserva avulsa recém-criada;
- `notify-agenda-evento` (e-mail) seguindo a mesma regra atual de atividades.

## 2. Cancelamento em horário fixo — perguntar o que fazer

Hoje o botão de remover abre uma confirmação única. Passa a abrir, quando o card clicado for uma reserva ligada a uma vaga fixa, um diálogo com três ações:

1. **Cancelar só este dia** — remove a reserva do aluno e mantém a vaga fora da grade naquele dia (nada é ofertado no lugar).
2. **Remover apenas o aluno** — remove a reserva e devolve a vaga livre à grade naquele dia (comportamento atual do delete).
3. **Cancelar todas as futuras** — remove esta reserva e encerra a vaga fixa daqui pra frente, sem afetar datas passadas.

Em todos os casos o WhatsApp de cancelamento continua sendo disparado antes da exclusão, e o estorno de crédito segue pelas regras já existentes (inclusive a janela de 8h).

Cards avulsos comuns (sem vaga fixa por trás) continuam com a confirmação simples de hoje.

## Detalhes técnicos

- `src/components/agenda/AddAgendaDialog.tsx`: no `onSuccess`, trocar a condição `!isEditing` por "houve criação de agendamento" — a reserva avulsa criada no ramo de edição de vaga fixa retorna o registro inserido e deve seguir pelo mesmo caminho de disparo.
- `src/pages/Agenda.tsx`:
  - novo diálogo de cancelamento com as 3 opções, exibido quando o evento é `avulso` com vaga fixa correspondente (mesmo dia da semana/hora/atividade/local);
  - opção 1: `delete` da reserva, mantém a linha em `agenda_servicos_excecoes`;
  - opção 2: `delete` da reserva + `delete` da exceção (lógica já existente);
  - opção 3: `delete` da reserva + encerrar o modelo fixo para o futuro (exclusão do modelo ou exceções das datas futuras, mantendo o histórico).
- Sem mudança de schema.
