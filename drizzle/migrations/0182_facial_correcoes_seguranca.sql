create or replace function public.fn_facial_registrar_consentimento(
  p_aluno_id uuid, p_tipo text, p_versao_termo text, p_texto_termo text, p_responsavel_nome text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_origem text;
begin
  if p_aluno_id is null or not public.fn_facial_pode_agir(p_aluno_id) then
    raise exception 'Sem permissão para este aluno' using errcode = '42501';
  end if;
  if p_tipo not in ('proprio','responsavel') then raise exception 'Tipo de consentimento inválido'; end if;
  if p_tipo = 'responsavel' and not public.is_staff(auth.uid()) then
    raise exception 'Consentimento de responsável só pode ser registrado pela equipe ou pelo link do responsável' using errcode = '42501';
  end if;
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
declare v_cred public.credenciais_facial%rowtype; v_id uuid;
begin
  if p_aluno_id is null or not public.fn_facial_pode_agir(p_aluno_id) then
    raise exception 'Sem permissão para este aluno' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('facial_solicitar:' || p_aluno_id::text));
  update public.facial_consentimentos set revogado_em = now()
   where aluno_id = p_aluno_id and aceito and revogado_em is null;
  update public.facial_fila
     set status = 'erro', processado_em = now(), ultimo_erro = 'cancelado: consentimento revogado'
   where aluno_id = p_aluno_id and status = 'pendente';
  select * into v_cred from public.credenciais_facial where aluno_id = p_aluno_id for update;
  if found and v_cred.status in ('ativa','pendente','erro','remocao_pendente')
     and not exists (select 1 from public.facial_fila
                      where aluno_id = p_aluno_id and acao = 'remover' and status in ('pendente','processando')) then
    insert into public.facial_fila (aluno_id, device_user_id, acao, payload)
    values (p_aluno_id, v_cred.device_user_id, 'remover', '{"apagar_foto": true}'::jsonb)
    returning id into v_id;
    update public.credenciais_facial set status = 'remocao_pendente', updated_at = now() where id = v_cred.id;
  end if;
  return v_id;
end $$;
revoke all on function public.fn_facial_revogar(uuid) from public, anon;
grant execute on function public.fn_facial_revogar(uuid) to authenticated;