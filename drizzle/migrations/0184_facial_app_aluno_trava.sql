alter table public.facial_config add column if not exists app_aluno_habilitado boolean not null default false;

create or replace function public.fn_facial_app_aluno_habilitado()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and coalesce((select app_aluno_habilitado from public.facial_config where id = 1), false)
$$;
revoke all on function public.fn_facial_app_aluno_habilitado() from public, anon;
grant execute on function public.fn_facial_app_aluno_habilitado() to authenticated;

create or replace function public.fn_facial_config_app_aluno(p_habilitado boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Somente administradores podem alterar esta opção' using errcode = '42501';
  end if;
  if p_habilitado is null then raise exception 'Valor obrigatório'; end if;
  update public.facial_config set app_aluno_habilitado = p_habilitado where id = 1;
  if not found then raise exception 'Configuração facial não encontrada'; end if;
  return p_habilitado;
end $$;
revoke all on function public.fn_facial_config_app_aluno(boolean) from public, anon;
grant execute on function public.fn_facial_config_app_aluno(boolean) to authenticated;

drop policy if exists "Aluno atualiza a propria facial" on storage.objects;