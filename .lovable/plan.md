# Vários agendamentos de serviço de uma vez (perfil do aluno)

## O que muda para a equipe
- Na janela **Agendar serviço**, você pode marcar vários horários, em dias diferentes, antes de confirmar.
- Cada horário marcado entra numa lista "Selecionados" (dia, horário, profissional), com um X para tirar.
- O saldo vai baixando na tela a cada horário marcado: "Saldo: 3 → restam 1 após confirmar". Quando chega a zero, os outros horários ficam bloqueados (exceto se for ilimitado).
- Um botão único **Confirmar N agendamentos**.
- Ao confirmar, cada horário é gravado na ordem. Se algum falhar (vaga tomada no meio tempo, sem crédito), os outros continuam valendo e aparece o resumo: "3 agendados, 1 não agendado: 22/10 09:00 — horário já reservado".
- Primeiro só um serviço por vez (trocar o serviço limpa a seleção), para o saldo ficar claro.

## O que continua igual
- Cada agendamento é o mesmo de hoje: 1 crédito debitado por horário, WhatsApp ao profissional e tarefa criada para cada um.
- App do aluno, Agenda de Serviços, Planos 1 e 2, flags, contratos e cobranças não mudam.

## Detalhes técnicos
- Só front: `AgendarServicoDialog.tsx` troca `horarioId`/`dia` únicos por `selecionados: {dia, horarioId}[]`; dias continuam clicáveis para navegar e os horários viram toggles.
- Saldo restante = `saldo - selecionados.length` (função pura em `src/lib/horariosLivresServico.ts`, com teste: não permite passar do saldo; ilimitado não bloqueia).
- Confirmação chama `fn_agendar_servico_equipe` sequencialmente (sem mudança no banco; a função já checa vaga e crédito por chamada) e dispara `whatsapp-disparo-agenda` para cada sucesso.
