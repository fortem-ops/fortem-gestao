insert into public.alunos (id, nome, status, cpf_hash) values
 ('00000000-0000-4000-8000-00000000ee01','TESTE TOTALPASS QA','ativo','f61dd64990af872c1ef58b8b077b126c3d144cc86cc6df85e151184a2ad692f6'),
 ('00000000-0000-4000-8000-00000000ee02','TESTE GYMPASS QA','ativo','f47e87f3e3ae336dce1a9d9cc3ad7348be1b755c2295e81292b8624cdfef998a')
on conflict (id) do nothing;
insert into public.planos (aluno_id, tipo, ativo, atividade, valor, data_inicio) values
 ('00000000-0000-4000-8000-00000000ee01','Total Pass',true,'treinamento_funcional',0, current_date),
 ('00000000-0000-4000-8000-00000000ee02','Gympass/Wellhub',true,'treinamento_funcional',0, current_date);