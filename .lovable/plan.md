# Reduzir a pressão de disco sem aumentar a instância

Nada é executado antes da aprovação do dono, item a item. A instância continua Tiny; o card de redimensionamento fica sem aplicar.

## O que já foi visto (leitura)
- Saúde do banco agora: funcionando, sem reinícios, memória 59%, disco 21%, conexões 27/60. Único alerta em 48h: **leitura/gravação de disco** às 01:06 UTC (22:06 Brasília) de 21/10, com 20% de folga restante.
- O `audit_log` tem **9 índices, e 4 deles são cópias** de outros:
  - três índices iguais em (tabela, data): `idx_audit_log_tabela`, `audit_log_tabela_created_at_idx`, `idx_audit_tabela`;
  - dois iguais em (usuário, data): `audit_log_user_id_idx`, `idx_audit_user_data`.
  Cada registro de auditoria grava em todos eles, o que aumenta a escrita em disco sem nenhum ganho.
- Consultas mais pesadas: inadimplências (0,46 s em média, 1.663 vezes), créditos ativos (0,26 s, 2.440 vezes), ciclos de crédito (0,36 s), tarefas pendentes (13 mil vezes).
- Horários dos crons (UTC → Brasília):
  - a cada 5 min (4 jobs: whatsapp ponto, resumo agenda, facial agente, agenda próximos) → 288 execuções/dia cada, cerca de 1.150 por dia somados, cada uma gravando um registro do cron e uma resposta HTTP;
  - a cada 30 min: rate-limit (2), verificar PIX;
  - 00:00 → 21:00 presenças; 01:00 (ter–sáb) → 22:00 pendências do ponto; 03:00 → 00:00 renovação de planos + resync do clube + evasão; 03:15 → 00:15 receitas; 23:40–23:55 → 20:40–20:55 resumo/alertas do ponto e fim dos treinos.
  - O alerta das 22:06 (Brasília) coincide com **ponto-pendencias-diario (01:00 UTC)** somado aos 4 crons de 5 min.

## Item 1 — Diagnóstico complementar (só leitura)
- Ler o tempo de cada execução de cron nas horas do alerta (histórico do cron e respostas HTTP), cruzar com as 3 horas em laranja do painel.
- Ver o plano de execução (sem executar) das consultas que varrem o `audit_log` inteiro, para achar quem gera as 132 varreduras (provável: a limpeza mensal de 5 anos ou alguma tela de contagem).
- Medir o tamanho de cada índice do `audit_log`.
- Sem migração, sem publicar. Risco: nenhum.

## Item 2 — Retenção de 7 dias em histórico de crons e respostas HTTP
- Uma rotina diária, às 06:00 UTC (03:00 Brasília, fora dos picos), apaga do histórico de execuções de cron e da tabela de respostas HTTP só o que tem mais de 7 dias, em lotes pequenos.
- Não toca em nenhum cron de negócio, cobrança, recorrência, Rede, Inter ou Pix: mexe só nesses dois registros técnicos.
- Impacto: cerca de 150 MB a menos para manter e varrer; menos escrita de manutenção. O espaço já ocupado no disco não diminui sozinho (só passa a ser reaproveitado).
- Risco: perder histórico técnico com mais de 7 dias (só serve para depuração).
- Reverter: desligar a rotina (um comando). Os registros apagados não voltam.
- Precisa de migração (criar a rotina). Não precisa publicar.

## Item 3 — Auditoria: remover índices duplicados (sem tocar em dados)
- Apagar só as 4 cópias de índice listadas acima, mantendo um índice de cada tipo. Os registros e a retenção de 5 anos continuam iguais.
- Para as 132 varreduras completas: criar um índice novo só se o Item 1 mostrar que alguma consulta frequente não usa os índices existentes. Hoje a data, a tabela, o registro, o usuário e a operação já têm índice.
- Impacto: cada registro de auditoria passa a gravar 4 índices a menos (menos escrita em disco), e o espaço desses índices fica livre.
- Risco: baixo; as consultas usam o índice igual que fica.
- Reverter: recriar os índices com a mesma definição (salva antes em um script de volta).
- Precisa de migração. Não precisa publicar.

## Item 4 (opcional, para decisão do dono) — Crons de 5 minutos
- Os 4 crons de 5 min são a maior fonte de escrita contínua. Opções, sem mudar nada agora:
  - manter como está (o Item 2 já limita o acúmulo);
  - passar facial-verificar-agente para 15 min (atraso máximo no aviso do agente: 15 min em vez de 5);
  - rodar os de WhatsApp e agenda só no horário de funcionamento.
- Cada mudança muda quando as mensagens/avisos saem, então só com aprovação do dono, uma a uma.

## Ordem sugerida
1 → 3 (índices) → 2 (retenção) → acompanhar o painel por 3 a 7 dias → decidir o Item 4.

## Detalhes técnicos
- Item 2: `cron.schedule` diário com `DELETE ... WHERE end_time < now() - interval '7 days'` em `cron.job_run_details` e `created < now() - interval '7 days'` em `net._http_response`, em lotes.
- Item 3: `DROP INDEX` de `audit_log_tabela_created_at_idx`, `idx_audit_tabela`, `idx_audit_user_data`; manter `idx_audit_log_tabela`, `audit_log_user_id_idx`. Rollback em `scripts/audit-log-indices.rollback.sql` com os `CREATE INDEX` originais.
- Item 1 usa só `EXPLAIN` (sem ANALYZE) e leituras de estatísticas.
