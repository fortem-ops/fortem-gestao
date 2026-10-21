create or replace function public.fn_facial_pode_agir(p_aluno_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.is_staff(auth.uid()) or public.fn_current_aluno_id() = p_aluno_id)
$$;
revoke all on function public.fn_facial_pode_agir(uuid) from public, anon;
grant execute on function public.fn_facial_pode_agir(uuid) to authenticated;

create or replace function public.fn_facial_registrar_consentimento(
  p_aluno_id uuid, p_tipo text, p_versao_termo text, p_texto_termo text, p_responsavel_nome text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_origem text;
begin
  if p_aluno_id is null or not public.fn_facial_pode_agir(p_aluno_id) then
    raise exception 'Sem permissão para este aluno' using errcode = '42501';
  end if;
  if p_tipo not in ('proprio','responsavel') then raise exception 'Tipo de consentimento inválido'; end if;
  if p_tipo = 'responsavel' and nullif(btrim(coalesce(p_responsavel_nome,'')),'') is null then
    raise exception 'Informe o nome do responsável';
  end if;
  if nullif(btrim(coalesce(p_versao_termo,'')),'') is null then raise exception 'Versão do termo obrigatória'; end if;
  if not exists (select 1 from public.alunos where id = p_aluno_id) then raise exception 'Aluno não encontrado'; end if;

  select id into v_id from public.facial_consentimentos
   where aluno_id = p_aluno_id and tipo = p_tipo and aceito and revogado_em is null
   order by aceito_em desc limit 1;
  if v_id is not null then return v_id; end if;

  v_origem := case when public.fn_current_aluno_id() = p_aluno_id and not public.is_staff(auth.uid())
                   then 'app_aluno' else 'perfil_equipe' end;
  insert into public.facial_consentimentos (aluno_id, tipo, origem, aceito_por, responsavel_nome, aceito, versao_termo, texto_termo)
  values (p_aluno_id, p_tipo, v_origem, auth.uid(), nullif(btrim(p_responsavel_nome),''), true, p_versao_termo, p_texto_termo)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.fn_facial_registrar_consentimento(uuid,text,text,text,text) from public, anon;
grant execute on function public.fn_facial_registrar_consentimento(uuid,text,text,text,text) to authenticated;

create or replace function public.fn_facial_solicitar(
  p_aluno_id uuid, p_acao text, p_foto_path text default null, p_apagar_foto boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
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
    if split_part(p_foto_path,'/',1) <> p_aluno_id::text
       and not exists (select 1 from storage.objects where bucket_id = 'faciais' and name = p_foto_path) then
      raise exception 'Foto inválida para este aluno';
    end if;
    if not exists (select 1 from public.alunos where id = p_aluno_id) then raise exception 'Aluno não encontrado'; end if;
    insert into public.credenciais_facial (aluno_id, status, foto_path)
    values (p_aluno_id, 'pendente', p_foto_path)
    on conflict (aluno_id) do update set foto_path = excluded.foto_path, status = 'pendente', ultimo_erro = null, updated_at = now()
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
end $$;
revoke all on function public.fn_facial_solicitar(uuid,text,text,boolean) from public, anon;
grant execute on function public.fn_facial_solicitar(uuid,text,text,boolean) to authenticated;

create or replace function public.fn_facial_revogar(p_aluno_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if p_aluno_id is null or not public.fn_facial_pode_agir(p_aluno_id) then
    raise exception 'Sem permissão para este aluno' using errcode = '42501';
  end if;
  update public.facial_consentimentos set revogado_em = now()
   where aluno_id = p_aluno_id and aceito and revogado_em is null;
  select status into v_status from public.credenciais_facial where aluno_id = p_aluno_id;
  if v_status in ('ativa','pendente','erro') then
    return public.fn_facial_solicitar(p_aluno_id, 'remover', null, true);
  end if;
  return null;
end $$;
revoke all on function public.fn_facial_revogar(uuid) from public, anon;
grant execute on function public.fn_facial_revogar(uuid) to authenticated;

create or replace function public.fn_facial_fila_concluir(
  p_id uuid, p_ok boolean, p_erro text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.facial_fila%rowtype;
  v_erro text := left(coalesce(p_erro, 'falha sem detalhe'), 300);
  v_foto text;
begin
  select * into v_job from public.facial_fila where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'pedido inexistente');
  end if;
  if v_job.status <> 'processando' then
    return jsonb_build_object('ok', false, 'erro', 'pedido não está em processamento', 'status', v_job.status);
  end if;

  if coalesce(p_ok, false) then
    update public.facial_fila set status = 'concluido', processado_em = now(), ultimo_erro = null where id = p_id;
    if v_job.acao = 'remover' and v_job.payload->>'apagar_foto' = 'true' then
      select foto_path into v_foto from public.credenciais_facial where aluno_id = v_job.aluno_id for update;
      update public.credenciais_facial
         set status = 'removida', sincronizado_em = now(), ultimo_erro = null, foto_path = null
       where aluno_id = v_job.aluno_id;
      return jsonb_build_object('ok', true, 'status', 'concluido', 'foto_apagar', v_foto);
    end if;
    update public.credenciais_facial
       set status = case v_job.acao when 'remover' then 'removida' else 'ativa' end,
           sincronizado_em = now(), ultimo_erro = null
     where aluno_id = v_job.aluno_id;
    return jsonb_build_object('ok', true, 'status', 'concluido');
  end if;

  if v_job.tentativas >= 5 then
    update public.facial_fila set status = 'erro', processado_em = now(), ultimo_erro = v_erro where id = p_id;
    update public.credenciais_facial set status = 'erro', ultimo_erro = v_erro where aluno_id = v_job.aluno_id;
    return jsonb_build_object('ok', true, 'status', 'erro');
  end if;

  update public.facial_fila
     set status = 'pendente', ultimo_erro = v_erro,
         proxima_tentativa_em = now() + make_interval(mins => v_job.tentativas * 2)
   where id = p_id;
  return jsonb_build_object('ok', true, 'status', 'pendente');
end;
$$;
revoke all on function public.fn_facial_fila_concluir(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.fn_facial_fila_concluir(uuid, boolean, text) to service_role;

grant select on public.facial_eventos, public.facial_fila, public.credenciais_facial, public.facial_consentimentos, public.facial_config to authenticated;
revoke insert, update, delete on public.facial_fila, public.credenciais_facial from authenticated;

drop policy if exists staff_all_credenciais_facial on public.credenciais_facial;
create policy staff_select_credenciais_facial on public.credenciais_facial for select to authenticated using (public.is_staff());
create policy aluno_own_facial_fila on public.facial_fila for select to authenticated using (aluno_id = public.fn_current_aluno_id());