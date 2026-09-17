# Aviso de cancelamento no WhatsApp ao remover agendamento

## O que acontece hoje

Ao remover um agendamento na Agenda, o sistema até tenta avisar, mas a regra de aviso de cancelamento está limitada a três atividades (Reabilitação, Nutrição e Avaliação Física). Para Treino Experimental, Avaliação Funcional, Recovery e as demais, ninguém recebe nada. Também não há qualquer escolha: quem remove não decide se avisa ou não.

## O que muda

1. Na confirmação de remoção do agendamento, aparece uma opção "Avisar profissional e consultor no WhatsApp", **já marcada**. Quem remove pode desmarcar.
2. Se marcada, o aviso é enviado para **todas as atividades**, não só as três de hoje.
3. O aviso vai para o profissional e, quando houver, também para o consultor do agendamento — o aluno não recebe.
4. Se desmarcada, nada é enviado no WhatsApp (o e-mail de cancelamento existente continua como está).
5. O envio continua acontecendo antes da remoção, para que os dados do agendamento ainda estejam disponíveis na mensagem.

Fora de escopo, conforme sua resposta: remover só um dia da recorrência e remover horário fixo na ficha do aluno continuam sem aviso.

## Detalhes técnicos

- `src/pages/Agenda.tsx`: novo estado `avisarWhatsApp` (padrão `true`) com checkbox no `AlertDialog` de remoção; o valor entra no `deleteMutation.mutate(...)` e a invocação de `whatsapp-disparo-agenda` (`evento: "agendamento_cancelado"`) passa a ser condicional. O estado é reiniciado para `true` a cada abertura do diálogo. Vale para todos os botões do diálogo de remoção (Remover, Toda a recorrência, Liberar vaga, Somente este dia, Futuras).
- `supabase/functions/whatsapp-disparo-agenda/index.ts`: no gatilho `agendamento_cancelado`, ignorar o filtro de `atividades` da config quando o chamador enviar `forcar_todas_atividades: true`, mantendo o comportamento atual para os demais gatilhos e para chamadas sem esse campo. A cópia ao consultor já existe nesse fluxo e é reaproveitada.
- Sem migration; a config `Cancelamento → Profissional` permanece como está no banco.
- Redeploy da função `whatsapp-disparo-agenda` ao final; typecheck e build.
