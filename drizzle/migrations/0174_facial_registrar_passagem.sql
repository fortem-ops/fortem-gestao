create or replace function public.fn_facial_registrar_passagem(
  p_device_user_id integer,
  p_evento_em timestamptz,
  p_sucesso boolean,
  p_bruto jsonb default '{}'::jsonb,
  p_simular boolean default false   -- true: só classifica, não grava nada
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_modo text;
  v_janela integer;
  v_aluno uuid;
  v_local timestamp;
  v_data date;
  v_hora time;
  v_treino_id uuid;
  v_treino_status text;
  v_resultado text;
  v_aplicado boolean := false;
  v_evento_id uuid;
begin
  if p_evento_em is null then
    raise exception 'evento_em é obrigatório';
  end if;

  select modo_checkin, janela_antes_min
    into v_modo, v_janela
    from public.facial_config
   where id = 1;
  v_modo := coalesce(v_modo, 'log');
  v_janela := coalesce(v_janela, 30);

  -- Reenvio do agente: mesma pessoa, mesmo instante = mesmo evento.
  -- A trava serializa passagens do mesmo usuário; a constraint
  -- unique (device_user_id, evento_em) é a rede de segurança final.
  if p_device_user_id is not null then
    perform pg_advisory_xact_lock(hashtext('facial_passagem:' || p_device_user_id::text));
    if exists (
      select 1 from public.facial_eventos
       where device_user_id = p_device_user_id
         and evento_em = p_evento_em
    ) then
      return jsonb_build_object('duplicado', true);
    end if;
  end if;

  if not coalesce(p_sucesso, false) or p_device_user_id is null then
    v_resultado := 'nao_reconhecido';
  else
    select aluno_id into v_aluno
      from public.credenciais_facial
     where device_user_id = p_device_user_id;

    if v_aluno is null then
      v_resultado := 'aluno_nao_vinculado';
    else
      v_local := p_evento_em at time zone 'America/Sao_Paulo';
      v_data := v_local::date;
      v_hora := v_local::time;

      -- Treinos pendentes têm prioridade sobre os já realizados
      -- (aluno com duas sessões seguidas confirma uma de cada vez).
      select t.id, t.status
        into v_treino_id, v_treino_status
        from public.treino_agendamentos t
       where t.aluno_id = v_aluno
         and t.data = v_data
         and t.status in ('agendado', 'confirmado', 'realizado')
         and v_hora - t.horario_inicio >= make_interval(mins => -v_janela)
         and v_hora <= t.horario_fim
       order by (t.status = 'realizado'), t.horario_inicio
       limit 1
       for update of t;

      if not found then
        v_resultado := 'sem_treino_agendado';
      elsif v_treino_status = 'realizado' then
        v_resultado := 'ja_realizado';
      else
        v_resultado := 'presenca_confirmada';
        if v_modo = 'ativo' and not p_simular then
          update public.treino_agendamentos
             set status = 'realizado',
                 checkin_em = coalesce(checkin_em, p_evento_em),
                 checkin_origem = coalesce(checkin_origem, 'facial')
           where id = v_treino_id
             and status in ('agendado', 'confirmado');
          v_aplicado := found;
        end if;
      end if;
    end if;
  end if;

  if not p_simular then
    insert into public.facial_eventos (
      device_user_id, aluno_id, evento_em, resultado, aplicado,
      treino_agendamento_id, bruto
    ) values (
      p_device_user_id, v_aluno, p_evento_em, v_resultado, v_aplicado,
      v_treino_id, coalesce(p_bruto, '{}'::jsonb)
    )
    returning id into v_evento_id;
  end if;

  return jsonb_build_object(
    'duplicado', false,
    'resultado', v_resultado,
    'aplicado', v_aplicado,
    'modo', v_modo,
    'simulado', p_simular,
    'evento_id', v_evento_id,
    'treino_agendamento_id', v_treino_id
  );

exception
  when unique_violation then
    -- Corrida rara de reenvio: desfaz o que esta chamada fez e avisa.
    return jsonb_build_object('duplicado', true);
end;
$$;

-- Só o servidor (service role, usado pela Edge Function) executa.
revoke all on function public.fn_facial_registrar_passagem(integer, timestamptz, boolean, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.fn_facial_registrar_passagem(integer, timestamptz, boolean, jsonb, boolean)
  to service_role;