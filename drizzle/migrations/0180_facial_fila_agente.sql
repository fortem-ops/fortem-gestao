alter table public.facial_fila
  add column if not exists proxima_tentativa_em timestamptz not null default now(),
  add column if not exists iniciado_em timestamptz;

create index if not exists idx_facial_fila_pendentes
  on public.facial_fila (status, proxima_tentativa_em, created_at);

create or replace function public.fn_facial_fila_reservar(p_max integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

      if not v_consent_ok then
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
$$;

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

revoke all on function public.fn_facial_fila_reservar(integer) from public, anon, authenticated;
grant execute on function public.fn_facial_fila_reservar(integer) to service_role;
revoke all on function public.fn_facial_fila_concluir(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.fn_facial_fila_concluir(uuid, boolean, text) to service_role;