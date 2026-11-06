# Corrigir ponto bloqueado após 21h

## Causa (confirmada)
O servidor do banco está em horário UTC. A função que registra o ponto usa a "data de hoje" do servidor, que vira o dia às 21h de Brasília (00h UTC). A partir daí o sistema procura a jornada do dia seguinte, não encontra a entrada da Thaís e recusa a saída com "Não é possível encerrar jornada não iniciada". Os registros dela mostram saídas sempre antes das 21h (a mais tarde em 05/11 às 20:59), o que bate com o relato.

Afeta todos os profissionais que trabalham depois das 21h, não só a Thaís.

## Correção
1. Nova migração alterando `fn_ponto_registrar` para calcular o dia em horário de Brasília: `(now() AT TIME ZONE 'America/Sao_Paulo')::date`. Nenhuma outra regra (geofencing, ordem dos eventos, tolerâncias) muda.
2. Revisar e aplicar a mesma troca nas funções de ponto que usam a "data de hoje" para achar a jornada (como `fn_ponto_estado_atual`, que define qual botão aparece), para que o botão mostrado e o registro concordem.
3. Não alterar registros antigos.

## Verificação
- Ensaio no banco, desfeito no final: jornada iniciada às 14h, saída simulada às 21h30 de Brasília é aceita e cai no mesmo dia.
- Conferir que registros antes das 21h continuam iguais.
- Pedir à Thaís que bata a saída hoje depois das 21h para confirmar.
