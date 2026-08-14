with c as (select id from public.contratos where aluno_id in ('00000000-0000-4000-8000-00000000ee01','00000000-0000-4000-8000-00000000ee02'))
delete from public.ciclos_credito where contrato_id in (select id from c);
delete from public.cobrancas where aluno_id in ('00000000-0000-4000-8000-00000000ee01','00000000-0000-4000-8000-00000000ee02');
delete from public.contratos where aluno_id in ('00000000-0000-4000-8000-00000000ee01','00000000-0000-4000-8000-00000000ee02');
delete from public.planos where aluno_id in ('00000000-0000-4000-8000-00000000ee01','00000000-0000-4000-8000-00000000ee02');
delete from public.alunos where id in ('00000000-0000-4000-8000-00000000ee01','00000000-0000-4000-8000-00000000ee02');