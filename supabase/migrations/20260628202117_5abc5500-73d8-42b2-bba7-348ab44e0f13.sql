alter table public.ponto_consentimento_geo
  add column if not exists texto_termo text default null;

comment on column public.ponto_consentimento_geo.texto_termo is
  'Texto integral do termo de consentimento exibido ao colaborador no momento da aceitação/recusa. Permite rastrear qual versão do termo foi apresentada.';

insert into public.ponto_politica_retencao (versao, contato_dpo)
select '1.1', null
where not exists (select 1 from public.ponto_politica_retencao where versao = '1.1');