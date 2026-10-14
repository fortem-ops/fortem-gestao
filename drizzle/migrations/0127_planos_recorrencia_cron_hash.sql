create table public.planos_recorrencia_cron_hash (
  id smallint primary key default 1 check (id = 1),
  sha256 text not null,
  criado_em timestamptz not null default now()
);
grant all on public.planos_recorrencia_cron_hash to service_role;
revoke all on public.planos_recorrencia_cron_hash from anon, authenticated;
alter table public.planos_recorrencia_cron_hash enable row level security;
-- sem políticas: só service_role (edge function) lê.