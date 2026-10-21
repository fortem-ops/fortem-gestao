begin;
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  d uuid := gen_random_uuid(); e uuid := gen_random_uuid();
  staff_id uuid; job_porta uuid; job_upload uuid; result jsonb; expected jsonb;
  n_cred bigint; n_consent bigint; n_fila bigint;
begin
  lock table public.facial_fila in share row exclusive mode;
  if exists (select 1 from public.facial_fila where status in ('pendente','processando')) then
    raise exception 'Teste interrompido: fila real em andamento';
  end if;
  select count(*) into n_cred from public.credenciais_facial;
  select count(*) into n_consent from public.facial_consentimentos;
  select count(*) into n_fila from public.facial_fila;
  select user_id into staff_id from public.user_roles
   where role in ('admin','coordenador','professor','nutricionista','fisioterapeuta') limit 1;
  if staff_id is null then raise exception 'Teste precisa de identidade de equipe existente'; end if;

  begin
    insert into public.alunos(id,nome,data_nascimento) values
      (a,'TESTE TRANSACIONAL IMPORTAR A','2000-01-01'),
      (b,'TESTE TRANSACIONAL IMPORTAR B','2000-01-01'),
      (c,'TESTE TRANSACIONAL IMPORTAR C','2000-01-01'),
      (d,'TESTE TRANSACIONAL IMPORTAR D','2000-01-01'),
      (e,'TESTE TRANSACIONAL IMPORTAR E','2000-01-01');
    insert into public.credenciais_facial(aluno_id,device_user_id,status,foto_path,foto_origem) values
      (a,2147483601,'ativa',null,null),
      (b,2147483602,'ativa',null,null),
      (c,2147483603,'pendente',null,null),
      (d,2147483604,'ativa',d::text || '/porta.jpg','porta'),
      (e,2147483605,'ativa',e::text || '/upload.jpg','upload');

    select jsonb_build_object('ids',coalesce(jsonb_agg(device_user_id order by device_user_id),'[]'::jsonb))
      into expected from (select device_user_id from public.credenciais_facial
       where status='ativa' and foto_path is null and foto_origem is null order by device_user_id limit 5) t;
    result := public.fn_facial_importar_listar(5);
    if result <> expected then raise exception '(a) listagem incorreta: %',result; end if;
    if public.fn_facial_importar_aluno(2147483601) is distinct from a then raise exception '(a) aluno incorreto'; end if;
    if public.fn_facial_importar_aluno(2147483603) is not null then raise exception '(a) pendente elegível'; end if;

    result := public.fn_facial_importar_gravar(2147483601,b::text || '/porta.jpg',false);
    if result->>'erro' is distinct from 'caminho inválido' then raise exception '(b) caminho alheio aceito'; end if;
    result := public.fn_facial_importar_gravar(2147483601,a::text || '/porta.jpg',false);
    if result->>'resultado' is distinct from 'importada' then raise exception '(b) importação falhou'; end if;
    if not exists(select 1 from public.credenciais_facial where aluno_id=a and foto_origem='porta' and foto_path=a::text || '/porta.jpg') then raise exception '(b) foto/origem incorreta'; end if;
    result := public.fn_facial_importar_gravar(2147483601,a::text || '/porta.jpg',false);
    if result->>'erro' is distinct from 'credencial não elegível' then raise exception '(b) repetição aceita'; end if;
    result := public.fn_facial_importar_gravar(2147483602,null,true);
    if result->>'resultado' is distinct from 'ausente' or not exists(select 1 from public.credenciais_facial where aluno_id=b and foto_origem='ausente' and foto_path is null) then raise exception '(b) ausência falhou'; end if;
    result := public.fn_facial_importar_gravar(2147483602,null,true);
    if result->>'erro' is distinct from 'credencial não elegível' then raise exception '(b) ausência repetida aceita'; end if;

    insert into public.facial_fila(aluno_id,device_user_id,acao) values(d,2147483604,'atualizar_face') returning id into job_porta;
    insert into public.facial_fila(aluno_id,device_user_id,acao) values(e,2147483605,'atualizar_face') returning id into job_upload;
    result := public.fn_facial_fila_reservar(5);
    if not exists(select 1 from jsonb_array_elements(result->'jobs') j where j->>'id'=job_porta::text) then raise exception '(c) porta barrada'; end if;
    if exists(select 1 from jsonb_array_elements(result->'jobs') j where j->>'id'=job_upload::text) then raise exception '(c) upload sem consentimento aceito'; end if;
    if not exists(select 1 from public.facial_fila where id=job_upload and status='erro' and ultimo_erro='sem consentimento válido') then raise exception '(c) erro esperado ausente'; end if;
    if (select count(*) from public.facial_consentimentos) <> n_consent then raise exception 'Consentimento criado indevidamente'; end if;

    insert into storage.objects(bucket_id,name) values('faciais',a::text || '/nova.jpg');
    perform set_config('request.jwt.claim.sub',staff_id::text,true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',staff_id,'role','authenticated')::text,true);
    perform public.fn_facial_solicitar(a,'atualizar_face',a::text || '/nova.jpg',false);
    if not exists(select 1 from public.credenciais_facial where aluno_id=a and foto_origem='upload' and foto_path=a::text || '/nova.jpg') then raise exception '(d) nova foto não virou upload'; end if;

    raise exception using errcode='ZX001', message='rollback intencional de todos os dados simulados';
  exception when sqlstate 'ZX001' then null;
  end;
  if (select count(*) from public.credenciais_facial) <> n_cred or
     (select count(*) from public.facial_consentimentos) <> n_consent or
     (select count(*) from public.facial_fila) <> n_fila then raise exception 'Contagens alteradas após rollback'; end if;
  raise notice 'PASSOU: (a), (b), (c), (d); simulações desfeitas; contagens preservadas';
end;
$test$;
rollback;