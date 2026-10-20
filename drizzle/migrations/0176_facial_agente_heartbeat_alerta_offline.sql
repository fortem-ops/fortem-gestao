-- lovable-cron-fallback-reviewed: verificacao a cada 5 min e requisito aprovado pelo dono para detectar agente offline em ate 5 min; nao ha evento externo que substitua a checagem periodica
alter table public.facial_config
  add column if not exists alerta_offline_min integer not null default 15
    check (alerta_offline_min between 5 and 240),
  add column if not exists expediente_inicio time not null default '06:10',
  add column if not exists expediente_fim time not null default '20:40',
  add column if not exists expediente_fim_sexta time not null default '19:40',
  add column if not exists expediente_dias smallint[] not null default '{1,2,3,4,5}';

create or replace function public.fn_facial_agente_heartbeat(
  p_versao text,
  p_porta_ok boolean,
  p_detalhe jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.facial_agente_status (id, ultimo_contato, dispositivo_online, versao_agente, detalhe)
  values (1, now(), p_porta_ok, left(coalesce(p_versao, ''), 40), coalesce(p_detalhe, '{}'::jsonb))
  on conflict (id) do update
    set ultimo_contato     = excluded.ultimo_contato,
        dispositivo_online = excluded.dispositivo_online,
        versao_agente      = excluded.versao_agente,
        detalhe            = excluded.detalhe;

  update public.auditoria_inconsistencias
     set status = 'resolvido',
         resolvido_em = now(),
         nota_resolucao = 'Resolvido automaticamente: o agente voltou a se comunicar.'
   where categoria = 'facial' and subtipo = 'agente_offline' and status = 'aberto';

  if p_porta_ok then
    update public.auditoria_inconsistencias
       set status = 'resolvido',
           resolvido_em = now(),
           nota_resolucao = 'Resolvido automaticamente: a porta voltou a responder ao agente.'
     where categoria = 'facial' and subtipo = 'porta_inacessivel' and status = 'aberto';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.fn_facial_verificar_agente()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.facial_config%rowtype;
  v_st public.facial_agente_status%rowtype;
  v_local timestamp := now() at time zone 'America/Sao_Paulo';
  v_fim time;
  v_min numeric;
  v_abertos integer := 0;
begin
  select * into v_cfg from public.facial_config where id = 1;
  if not found then
    return jsonb_build_object('pulou', 'sem_config');
  end if;

  v_fim := case when extract(dow from v_local) = 5 then v_cfg.expediente_fim_sexta else v_cfg.expediente_fim end;

  if not (extract(dow from v_local)::smallint = any (v_cfg.expediente_dias))
     or v_local::time < v_cfg.expediente_inicio
     or v_local::time > v_fim then
    return jsonb_build_object('pulou', 'fora_do_expediente');
  end if;

  select * into v_st from public.facial_agente_status where id = 1;
  if not found or v_st.ultimo_contato is null then
    return jsonb_build_object('pulou', 'agente_ainda_nao_conectou');
  end if;

  v_min := extract(epoch from (now() - v_st.ultimo_contato)) / 60;

  if v_min > v_cfg.alerta_offline_min then
    insert into public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, registros_afetados)
    values (
      'facial', 'agente_offline', 'atencao',
      'O agente da porta facial está sem contato há ' || round(v_min)::text || ' min (último sinal em '
        || to_char(v_st.ultimo_contato at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
        || '). As passagens ficam guardadas na porta e são recuperadas quando ele voltar; '
        || 'confira se o computador da recepção está ligado.',
      jsonb_build_object('tipo', 'agente_offline', 'ultimo_contato_epoch', extract(epoch from v_st.ultimo_contato)::bigint)
    )
    on conflict do nothing;
    get diagnostics v_abertos = row_count;
    return jsonb_build_object('alerta', 'agente_offline', 'minutos', round(v_min), 'novos', v_abertos);
  end if;

  if v_st.dispositivo_online is false then
    insert into public.auditoria_inconsistencias (categoria, subtipo, severidade, descricao, registros_afetados)
    values (
      'facial', 'porta_inacessivel', 'atencao',
      'O agente está ativo, mas a porta facial (192.168.0.71) não está respondendo a ele. '
        || 'Confira energia e rede da porta. Passagens feitas nesse período serão recuperadas quando ela voltar.',
      jsonb_build_object('tipo', 'porta_inacessivel', 'ultimo_contato_epoch', null,
                         'dia', v_local::date, 'hora', to_char(v_local, 'HH24'))
    )
    on conflict do nothing;
    get diagnostics v_abertos = row_count;
    return jsonb_build_object('alerta', 'porta_inacessivel', 'novos', v_abertos);
  end if;

  return jsonb_build_object('ok', true, 'minutos_desde_contato', round(v_min));
end;
$$;

revoke all on function public.fn_facial_agente_heartbeat(text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.fn_facial_agente_heartbeat(text, boolean, jsonb) to service_role;
revoke all on function public.fn_facial_verificar_agente() from public, anon, authenticated;
grant execute on function public.fn_facial_verificar_agente() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'facial-verificar-agente') then
    perform cron.unschedule('facial-verificar-agente');
  end if;
  perform cron.schedule('facial-verificar-agente', '*/5 * * * *', 'SELECT public.fn_facial_verificar_agente();');
end;
$$;