
create or replace function public.fn_notificar_listar_profissionais()
returns table(user_id uuid, full_name text, specialty text, roles text[])
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.full_name, p.specialty,
         array_agg(distinct ur.role::text order by ur.role::text) as roles
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.user_id
  where ur.role::text in ('admin','coordenador','professor','nutricionista','fisioterapeuta')
    and exists (
      select 1 from public.user_roles me
      where me.user_id = auth.uid()
        and me.role::text in ('admin','coordenador','professor','nutricionista','fisioterapeuta')
    )
  group by p.user_id, p.full_name, p.specialty
  order by p.full_name;
$$;

grant execute on function public.fn_notificar_listar_profissionais() to authenticated;

create or replace function public.fn_notificar_expandir_destinatarios(p_grupos jsonb)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g jsonb;
  t text;
  uid uuid;
  rl text;
  result_ids uuid[] := array[]::uuid[];
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role::text in ('admin','coordenador','professor','nutricionista','fisioterapeuta')
  ) then
    return;
  end if;

  for g in select * from jsonb_array_elements(coalesce(p_grupos, '[]'::jsonb))
  loop
    t := g->>'type';
    if t = 'user' then
      uid := nullif(g->>'userId','')::uuid;
      if uid is not null then
        result_ids := result_ids || uid;
      end if;
    elsif t = 'all_profissionais' then
      result_ids := result_ids || array(
        select distinct ur.user_id from public.user_roles ur
        where ur.role::text in ('admin','coordenador','professor','nutricionista','fisioterapeuta')
      );
    elsif t in ('all_admins','all_coordenadores','all_professores') then
      rl := case t
        when 'all_admins' then 'admin'
        when 'all_coordenadores' then 'coordenador'
        when 'all_professores' then 'professor'
      end;
      result_ids := result_ids || array(
        select distinct ur.user_id from public.user_roles ur where ur.role::text = rl
      );
    elsif t = 'role' then
      rl := g->>'role';
      if rl is not null then
        result_ids := result_ids || array(
          select distinct ur.user_id from public.user_roles ur where ur.role::text = rl
        );
      end if;
    end if;
  end loop;

  return query select distinct unnest(result_ids);
end;
$$;

grant execute on function public.fn_notificar_expandir_destinatarios(jsonb) to authenticated;
