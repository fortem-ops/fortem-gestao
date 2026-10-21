alter table public.credenciais_facial
  add column if not exists foto_origem text
  check (foto_origem in ('porta', 'upload', 'ausente'));

-- Fotos que já existem no banco (enviadas pela equipe/aluno) são 'upload'.
update public.credenciais_facial set foto_origem = 'upload'
 where foto_path is not null and foto_origem is null;

create or replace function public.fn_facial_importar_listar(p_max integer default 1)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object('ids', coalesce(jsonb_agg(device_user_id order by device_user_id), '[]'::jsonb))
    from (
      select device_user_id from public.credenciais_facial
       where status = 'ativa' and foto_path is null and foto_origem is null
       order by device_user_id
       limit least(greatest(coalesce(p_max, 1), 1), 5)
    ) t
$$;

create or replace function public.fn_facial_importar_aluno(p_device_user_id integer)
returns uuid
language sql
security definer
set search_path = public
as $$
  select aluno_id from public.credenciais_facial
   where device_user_id = p_device_user_id
     and status = 'ativa' and foto_path is null and foto_origem is null
$$;

create or replace function public.fn_facial_importar_gravar(
  p_device_user_id integer,
  p_foto_path text,
  p_ausente boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_aluno uuid;
begin
  select aluno_id into v_aluno from public.credenciais_facial
   where device_user_id = p_device_user_id
     and status = 'ativa' and foto_path is null and foto_origem is null
   for update;
  if v_aluno is null then
    return jsonb_build_object('ok', false, 'erro', 'credencial não elegível');
  end if;

  if coalesce(p_ausente, false) then
    update public.credenciais_facial set foto_origem = 'ausente' where aluno_id = v_aluno;
    return jsonb_build_object('ok', true, 'resultado', 'ausente');
  end if;

  if p_foto_path is null or split_part(p_foto_path, '/', 1) <> v_aluno::text or position('..' in p_foto_path) > 0 then
    return jsonb_build_object('ok', false, 'erro', 'caminho inválido');
  end if;
  update public.credenciais_facial
     set foto_path = p_foto_path, foto_origem = 'porta'
   where aluno_id = v_aluno;
  return jsonb_build_object('ok', true, 'resultado', 'importada');
end;
$$;

revoke all on function public.fn_facial_importar_listar(integer) from public, anon, authenticated;
revoke all on function public.fn_facial_importar_aluno(integer) from public, anon, authenticated;
revoke all on function public.fn_facial_importar_gravar(integer, text, boolean) from public, anon, authenticated;
grant execute on function public.fn_facial_importar_listar(integer) to service_role;
grant execute on function public.fn_facial_importar_aluno(integer) to service_role;
grant execute on function public.fn_facial_importar_gravar(integer, text, boolean) to service_role;

-- fn_facial_solicitar: foto enviada por usuário passa a ser 'upload' (mantém 'porta' só se for o mesmo caminho importado)
create or replace function public.fn_facial_solicitar(p_aluno_id uuid, p_acao text, p_foto_path text default null, p_apagar_foto boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_cred public.credenciais_facial%rowtype; v_id uuid;
begin
  if p_aluno_id is null or not public.fn_facial_pode_agir(p_aluno_id) then
    raise exception 'Sem permissão para este aluno' using errcode = '42501';
  end if;
  if p_acao not in ('cadastrar','atualizar_face','remover') then raise exception 'Ação inválida'; end if;
  perform pg_advisory_xact_lock(hashtext('facial_solicitar:' || p_aluno_id::text));
  if exists (select 1 from public.facial_fila where aluno_id = p_aluno_id and status in ('pendente','processando')) then
    raise exception 'Já existe um pedido em andamento';
  end if;

  if p_acao in ('cadastrar','atualizar_face') then
    if nullif(btrim(coalesce(p_foto_path,'')),'') is null then raise exception 'Foto obrigatória'; end if;
    if position('..' in p_foto_path) > 0 then
      raise exception 'Foto inválida para este aluno';
    end if;
    if not public.is_staff(auth.uid()) and split_part(p_foto_path,'/',1) <> p_aluno_id::text then
      raise exception 'Foto inválida para este aluno';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'faciais' and name = p_foto_path) then
      raise exception 'Foto inválida para este aluno';
    end if;
    if not exists (select 1 from public.alunos where id = p_aluno_id) then raise exception 'Aluno não encontrado'; end if;
    insert into public.credenciais_facial (aluno_id, status, foto_path, foto_origem)
    values (p_aluno_id, 'pendente', p_foto_path, 'upload')
    on conflict (aluno_id) do update
      set foto_origem = case when public.credenciais_facial.foto_origem = 'porta'
                              and public.credenciais_facial.foto_path = excluded.foto_path
                             then 'porta' else 'upload' end,
          foto_path = excluded.foto_path, status = 'pendente', ultimo_erro = null, updated_at = now()
    returning * into v_cred;
    insert into public.facial_fila (aluno_id, device_user_id, acao, payload)
    values (p_aluno_id, v_cred.device_user_id, p_acao, '{}'::jsonb) returning id into v_id;
  else
    select * into v_cred from public.credenciais_facial where aluno_id = p_aluno_id for update;
    if not found then raise exception 'Aluno não tem facial cadastrada'; end if;
    update public.credenciais_facial set status = 'remocao_pendente', updated_at = now() where id = v_cred.id;
    insert into public.facial_fila (aluno_id, device_user_id, acao, payload)
    values (p_aluno_id, v_cred.device_user_id, 'remover', jsonb_build_object('apagar_foto', coalesce(p_apagar_foto,false)))
    returning id into v_id;
  end if;
  return v_id;
end $function$;

-- fn_facial_fila_reservar: dispensa consentimento só quando foto_origem = 'porta'
create or replace function public.fn_facial_fila_reservar(p_max integer default 5)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_max integer := least(greatest(coalesce(p_max, 1), 1), 10);
  v_job public.facial_fila%rowtype;
  v_cred public.credenciais_facial%rowtype;
  v_aluno record;
  v_menor boolean;
  v_consent_ok boolean;
  v_out jsonb := '[]'::jsonb;
begin
  update public.facial_fila
     set status = 'pendente', proxima_tentativa_em = now(),
         ultimo_erro = 'agente não concluiu o pedido; reprocessando'
   where status = 'processando' and iniciado_em < now() - interval '10 minutes' and tentativas < 5;

  update public.facial_fila
     set status = 'erro', processado_em = now(),
         ultimo_erro = 'agente não concluiu o pedido após várias tentativas'
   where status = 'processando' and iniciado_em < now() - interval '10 minutes' and tentativas >= 5;

  for v_job in
    select f.*
      from public.facial_fila f
     where f.status = 'pendente'
       and f.tentativas < 5
       and f.proxima_tentativa_em <= now()
       and not exists (
         select 1 from public.facial_fila o
          where o.aluno_id = f.aluno_id and o.id <> f.id
            and o.created_at < f.created_at
            and o.status in ('pendente', 'processando'))
     order by f.created_at
     limit v_max
     for update of f skip locked
  loop
    select * into v_cred from public.credenciais_facial where aluno_id = v_job.aluno_id;

    if not found or v_cred.device_user_id <> v_job.device_user_id then
      update public.facial_fila set status = 'erro', processado_em = now(),
             ultimo_erro = 'pedido não confere com a credencial do aluno'
       where id = v_job.id;
      continue;
    end if;

    select nome, data_nascimento into v_aluno from public.alunos where id = v_job.aluno_id;

    if v_job.acao in ('cadastrar', 'atualizar_face') then
      if v_cred.foto_path is null then
        update public.facial_fila set status = 'erro', processado_em = now(), ultimo_erro = 'aluno sem foto enviada'
         where id = v_job.id;
        update public.credenciais_facial set status = 'erro', ultimo_erro = 'aluno sem foto enviada'
         where aluno_id = v_job.aluno_id;
        continue;
      end if;

      v_menor := v_aluno.data_nascimento is null
                 or v_aluno.data_nascimento > (current_date - interval '18 years')::date;

      select exists (
        select 1 from public.facial_consentimentos c
         where c.aluno_id = v_job.aluno_id
           and c.aceito and c.revogado_em is null
           and (not v_menor or c.tipo = 'responsavel')
      ) into v_consent_ok;

      -- Rosto já cadastrado na porta antes do sistema (foto copiada dela): dispensado.
      if not v_consent_ok and coalesce(v_cred.foto_origem, '') <> 'porta' then
        update public.facial_fila set status = 'erro', processado_em = now(), ultimo_erro = 'sem consentimento válido'
         where id = v_job.id;
        update public.credenciais_facial set status = 'erro', ultimo_erro = 'sem consentimento válido'
         where aluno_id = v_job.aluno_id;
        continue;
      end if;
    end if;

    update public.facial_fila
       set status = 'processando', tentativas = tentativas + 1, iniciado_em = now()
     where id = v_job.id;

    v_out := v_out || jsonb_build_object(
      'id', v_job.id, 'acao', v_job.acao, 'device_user_id', v_job.device_user_id,
      'nome', v_aluno.nome,
      'foto_path', case when v_job.acao = 'remover' then null else v_cred.foto_path end
    );
  end loop;

  return jsonb_build_object('jobs', v_out);
end;
$function$;

revoke all on function public.fn_facial_solicitar(uuid, text, text, boolean) from public, anon;
grant execute on function public.fn_facial_solicitar(uuid, text, text, boolean) to authenticated, service_role;
revoke all on function public.fn_facial_fila_reservar(integer) from public, anon, authenticated;
grant execute on function public.fn_facial_fila_reservar(integer) to service_role;