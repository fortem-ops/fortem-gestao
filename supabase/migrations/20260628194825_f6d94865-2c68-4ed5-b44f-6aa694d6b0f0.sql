
create table if not exists public.ponto_politica_retencao (
  id uuid primary key default gen_random_uuid(),
  versao text not null default '1.0',
  retencao_jornadas_anos integer not null default 5,
  retencao_eventos_anos integer not null default 5,
  retencao_banco_horas_anos integer not null default 5,
  base_legal text not null default 'Art. 11 da CLT e Art. 7º II e IX da LGPD (Lei 13.709/2018)',
  responsavel_dados text not null default 'Fortem Centro de Treinamento',
  contato_dpo text default null,
  vigente_desde timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id)
);

comment on table public.ponto_politica_retencao is
  'Política de retenção de dados pessoais coletados pelo módulo de ponto (LGPD Art. 37).';

grant select on public.ponto_politica_retencao to authenticated;
grant all on public.ponto_politica_retencao to service_role;

alter table public.ponto_politica_retencao enable row level security;

drop policy if exists "autenticados podem ler politica retencao" on public.ponto_politica_retencao;
create policy "autenticados podem ler politica retencao"
  on public.ponto_politica_retencao for select
  to authenticated
  using (true);

insert into public.ponto_politica_retencao (versao, contato_dpo)
select '1.0', null
where not exists (select 1 from public.ponto_politica_retencao);
