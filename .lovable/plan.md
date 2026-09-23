# Auditoria / Fiscalização — infraestrutura + Fiscal de Pagamentos (PIX)

Objetivo: criar um registro central de inconsistências detectadas automaticamente, uma rotina diária que verifica o financeiro (só PIX/cobranças, sem cartão/recorrência), uma tela para a equipe tratar cada achado e um aviso no Dashboard.

## 1. Tabela de inconsistências

Nova tabela `auditoria_inconsistencias` com: categoria, subtipo, severidade (crítico/atenção/info), descrição, aluno vinculado (opcional), IDs dos registros envolvidos, status (aberto/resolvido/ignorado), nota de resolução, quem resolveu, quando resolveu e quando foi detectado.

Acesso: só equipe lê; só admin altera (resolver/ignorar). Nenhum acesso público.

Para não repetir alerta: índice único parcial sobre categoria + subtipo + registros afetados enquanto o item estiver aberto, e inserção com `ON CONFLICT DO NOTHING`.

## 2. Fiscal de Pagamentos (rotina diária)

Nova função agendada `auditoria-fiscal-pagamentos`, executada 1x por dia. Toda a verificação é comparação de dados em SQL — nenhuma decisão por IA.

Checagens desta primeira versão (só PIX / cobranças já em produção):

1. Cobrança ligada a um contrato que não estava vigente na data da cobrança → crítico.
   Observação: contratos não têm campo `ativo`; a vigência é avaliada por `status` (ativo/suspenso/cancelado/encerrado) e pelo intervalo `data_inicio`–`data_fim`.
2. Valor da cobrança diferente do valor vigente do plano do aluno (`planos.valor` do plano ativo, com tolerância de centavos) → atenção.
3. Cobrança pendente há mais de 5 dias sem tentativa/falha registrada (`cobrancas.tentativas = 0` e nenhuma linha em `cobranca_tentativas`) → atenção.
4. Certificado da integração PIX Inter perto de vencer → **não implementável hoje**: a base só guarda a validade do token de acesso (horas), não a data do certificado. Proposta: incluir essa checagem quando a data de expiração do certificado for cadastrada em configuração. Se preferir, posso adicionar um campo de configuração para essa data nesta mesma entrega.

## 3. Tela "Auditoria"

Nova página em `/auditoria`, visível no menu apenas para coordenação/admin, com:
- lista dos achados, filtros por categoria, severidade e status;
- descrição e link direto para o aluno / contrato / cobrança envolvidos;
- botões "Marcar como resolvido" e "Ignorar", com nota opcional (só admin);
- contador de itens abertos no item de menu, destacado em vermelho quando houver crítico.

A rotina nunca fecha um item — só a pessoa logada.

## 4. Aviso no Dashboard

Novo widget (só coordenação/admin) que aparece quando houver itens abertos: resume a quantidade por severidade e categoria e leva direto para a tela de Auditoria. Aparece em destaque com críticos; itens de "atenção" também aparecem, em tom neutro.

## Detalhes técnicos

- Migração (via ferramenta de migração, com GRANTs + RLS: `SELECT` para `is_staff()`, `UPDATE` para `is_admin(auth.uid())`, `service_role` para a função agendada).
- Índices: `(status, severidade)`, `(categoria, subtipo)`, `aluno_id`; único parcial `(categoria, subtipo, md5(registros_afetados::text)) WHERE status = 'aberto'`.
- Edge function Deno em `supabase/functions/auditoria-fiscal-pagamentos/index.ts` usando service role, com as 3 consultas determinísticas e inserção idempotente. Agendamento por `pg_cron` + `pg_net` chamando a função 1x/dia (06:00 BRT) — cadência diária, sem custo relevante de execução.
- Frontend: `src/pages/Auditoria.tsx`, hook `src/hooks/useAuditoria.ts` (lista + contadores + mutação de resolução via `useSupabaseMutation`), widget `src/components/dashboard/AuditoriaWidget.tsx` incluído no `widgetMap`/layout padrão de coordenação e admin, rota protegida em `App.tsx` e item no `AppSidebar` (seção Sistema, `isCoordAdmin`).
- Sem alteração em cobranças, contratos, planos ou na integração PIX existente.
