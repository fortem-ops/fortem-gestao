-- Habilitar extensões necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior, se existir (idempotente)
do $$
begin
  perform cron.unschedule('ponto-pendencias-diario');
exception when others then null;
end $$;

-- Agenda a Edge Function ponto-notificar-pendencias
-- 22h Brasília (UTC-3) = 01h UTC, seg-sex de Brasília = ter-sáb UTC (2-6)
select cron.schedule(
  'ponto-pendencias-diario',
  '0 1 * * 2-6',
  $$
  select net.http_post(
    url := 'https://dmudgqedzeosfpehpgep.supabase.co/functions/v1/ponto-notificar-pendencias',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);