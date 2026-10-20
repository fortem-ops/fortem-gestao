-- FASE 1 — Base do check-in facial (porta de acesso Intelbras SS 3532 MF W)

create sequence if not exists public.facial_device_user_id_seq start with 20000;

create table public.credenciais_facial (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references public.alunos(id),
  device_user_id integer not null unique
    default nextval('public.facial_device_user_id_seq'),
  status text not null default 'sem_facial'
    check (status in ('sem_facial','pendente','ativa','remocao_pendente','removida','erro')),
  foto_path text,
  sincronizado_em timestamptz,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence public.facial_device_user_id_seq
  owned by public.credenciais_facial.device_user_id;

create or replace function public.fn_facial_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger credenciais_facial_touch
  before update on public.credenciais_facial
  for each row execute function public.fn_facial_touch_updated_at();

create table public.facial_consentimentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id),
  tipo text not null check (tipo in ('proprio','responsavel')),
  origem text not null check (origem in ('app_aluno','perfil_equipe')),
  aceito_por uuid references auth.users(id),
  responsavel_nome text,
  aceito boolean not null default true,
  aceito_em timestamptz not null default now(),
  ip_aceite text,
  user_agent text,
  versao_termo text not null,
  texto_termo text,
  revogado_em timestamptz,
  created_at timestamptz not null default now()
);
create index facial_consentimentos_aluno_idx
  on public.facial_consentimentos (aluno_id, aceito_em desc);

create table public.facial_fila (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id),
  device_user_id integer not null,
  acao text not null check (acao in ('cadastrar','atualizar_face','remover')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendente'
    check (status in ('pendente','processando','concluido','erro')),
  tentativas integer not null default 0,
  ultimo_erro text,
  created_at timestamptz not null default now(),
  processado_em timestamptz
);
create index facial_fila_abertos_idx
  on public.facial_fila (created_at) where status in ('pendente','processando');

create table public.facial_eventos (
  id uuid primary key default gen_random_uuid(),
  device_user_id integer,
  aluno_id uuid references public.alunos(id),
  evento_em timestamptz not null,
  resultado text not null check (resultado in (
    'presenca_confirmada','ja_realizado','sem_treino_agendado',
    'nao_reconhecido','aluno_nao_vinculado')),
  aplicado boolean not null default false,
  treino_agendamento_id uuid references public.treino_agendamentos(id),
  bruto jsonb,
  created_at timestamptz not null default now(),
  unique (device_user_id, evento_em)
);
create index facial_eventos_aluno_idx
  on public.facial_eventos (aluno_id, evento_em desc);

create table public.facial_agente_status (
  id integer primary key default 1 check (id = 1),
  ultimo_contato timestamptz,
  dispositivo_online boolean,
  versao_agente text,
  detalhe jsonb
);
insert into public.facial_agente_status (id) values (1) on conflict do nothing;

create table public.facial_config (
  id integer primary key default 1 check (id = 1),
  modo_checkin text not null default 'log' check (modo_checkin in ('log','ativo')),
  janela_antes_min integer not null default 30 check (janela_antes_min between 0 and 180),
  updated_at timestamptz not null default now()
);
insert into public.facial_config (id) values (1) on conflict do nothing;

alter table public.treino_agendamentos
  add column if not exists checkin_em timestamptz,
  add column if not exists checkin_origem text
    check (checkin_origem in ('facial','manual'));

alter table public.credenciais_facial     enable row level security;
alter table public.facial_consentimentos  enable row level security;
alter table public.facial_fila            enable row level security;
alter table public.facial_eventos         enable row level security;
alter table public.facial_agente_status   enable row level security;
alter table public.facial_config          enable row level security;

create policy staff_all_credenciais_facial on public.credenciais_facial
  for all to authenticated using (is_staff()) with check (is_staff());
create policy aluno_own_credenciais_facial on public.credenciais_facial
  for select to authenticated using (aluno_id = fn_current_aluno_id());

create policy staff_all_facial_consentimentos on public.facial_consentimentos
  for all to authenticated using (is_staff()) with check (is_staff());
create policy aluno_own_facial_consentimentos on public.facial_consentimentos
  for select to authenticated using (aluno_id = fn_current_aluno_id());

create policy staff_select_facial_fila on public.facial_fila
  for select to authenticated using (is_staff());

create policy staff_select_facial_eventos on public.facial_eventos
  for select to authenticated using (is_staff());
create policy aluno_own_facial_eventos on public.facial_eventos
  for select to authenticated using (aluno_id = fn_current_aluno_id());

create policy staff_select_facial_agente_status on public.facial_agente_status
  for select to authenticated using (is_staff());

create policy staff_select_facial_config on public.facial_config
  for select to authenticated using (is_staff());
create policy admin_update_facial_config on public.facial_config
  for update to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "Staff pode ver faciais" on storage.objects
  for select to authenticated
  using (bucket_id = 'faciais' and is_staff(auth.uid()));
create policy "Staff pode enviar faciais" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'faciais' and is_staff(auth.uid()));
create policy "Staff pode atualizar faciais" on storage.objects
  for update to authenticated
  using (bucket_id = 'faciais' and is_staff(auth.uid()));
create policy "Admin pode apagar faciais" on storage.objects
  for delete to authenticated
  using (bucket_id = 'faciais' and is_admin(auth.uid()));

create policy "Aluno ve a propria facial" on storage.objects
  for select to authenticated
  using (bucket_id = 'faciais' and fn_current_aluno_id() is not null
         and (storage.foldername(name))[1] = fn_current_aluno_id()::text);
create policy "Aluno envia a propria facial" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'faciais' and fn_current_aluno_id() is not null
              and (storage.foldername(name))[1] = fn_current_aluno_id()::text);
create policy "Aluno atualiza a propria facial" on storage.objects
  for update to authenticated
  using (bucket_id = 'faciais' and fn_current_aluno_id() is not null
         and (storage.foldername(name))[1] = fn_current_aluno_id()::text);