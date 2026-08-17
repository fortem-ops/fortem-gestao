update public.whatsapp_disparos_config
set horario_fixo = '20:40:00'
where id = 'b41e481e-d101-4a10-94b9-2e26a65a4823';

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin perform cron.unschedule('whatsapp-resumo-ponto-diario'); exception when others then null; end $$;

select cron.schedule(
  'whatsapp-resumo-ponto-diario',
  '40 23 * * 0-5',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1) || '/functions/v1/whatsapp-resumo-ponto',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);