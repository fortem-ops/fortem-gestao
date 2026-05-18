create table public.avaliacao_templates (
  id uuid primary key default gen_random_uuid(),
  tipo text not null unique,
  schema jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.avaliacao_templates enable row level security;

create policy "Authenticated read avaliacao_templates"
  on public.avaliacao_templates for select
  to authenticated using (true);

create policy "Coord/Admin manage avaliacao_templates"
  on public.avaliacao_templates for all
  to authenticated
  using (public.is_coordinator_or_admin(auth.uid()))
  with check (public.is_coordinator_or_admin(auth.uid()));

create trigger trg_avaliacao_templates_updated
  before update on public.avaliacao_templates
  for each row execute function public.update_updated_at_column();

insert into public.avaliacao_templates (tipo, schema) values (
  'experimental',
  '{
    "sections": [
      {
        "id": "anamnese",
        "title": "Anamnese",
        "questions": [
          { "id": "saude", "label": "Histórico de saúde: você possui alguma condição de saúde diagnosticada (cardíaca, respiratória, metabólica, ortopédica, etc.)?", "type": "sim_nao_detalhe", "detalheLabel": "Quais condições?" },
          { "id": "medicacao", "label": "Você faz uso de alguma medicação?", "type": "sim_nao_detalhe", "detalheLabel": "Qual(is) medicação(ões)?" },
          { "id": "gestante", "label": "Está gestante?", "type": "sim_nao_numero", "detalheLabel": "Semanas" },
          { "id": "limitacoes", "label": "Possui limitações de movimentos, dores ou lesões (antigas ou recentes)?", "type": "sim_nao_detalhe", "detalheLabel": "Quais limitações, dores ou lesões?" },
          { "id": "atividade", "label": "Você pratica alguma atividade física com regularidade?", "type": "sim_nao_dupla", "labelSim": "Qual atividade?", "labelNao": "Há quanto tempo está parado(a)?" },
          { "id": "motivo_objetivo", "label": "O que te trouxe até a Fortem (na procura deste tipo de serviço) e qual é o seu principal objetivo?", "type": "texto" }
        ]
      },
      {
        "id": "mobilidade",
        "title": "Avaliação de Mobilidade",
        "questions": [
          { "id": "gatinho", "label": "Gatinho", "type": "opcoes", "options": [
            {"value":"movel","label":"Móvel"},{"value":"restrito","label":"Restrito"},{"value":"dificuldade","label":"Dificuldade de compreensão e execução"}
          ]},
          { "id": "rocking", "label": "Rocking", "type": "opcoes", "options": [
            {"value":"movel","label":"Móvel"},{"value":"restrito","label":"Restrito"},{"value":"dificuldade","label":"Dificuldade de compreensão e execução"}
          ]},
          { "id": "rotacao_ombro", "label": "Rotação Interna e Externa de Ombro na Parede", "type": "opcoes", "options": [
            {"value":"movel","label":"Móvel"},{"value":"restrito","label":"Restrito"},{"value":"dificuldade","label":"Dificuldade de compreensão e execução"}
          ]},
          { "id": "hip_hinge", "label": "Hip Hinge com bastão nas costas", "type": "opcoes", "options": [
            {"value":"movel","label":"Móvel"},{"value":"restrito","label":"Restrito"},{"value":"dificuldade","label":"Dificuldade de compreensão e execução"}
          ]},
          { "id": "observacoes", "label": "Observações sobre os padrões de mobilidade", "type": "texto" }
        ]
      }
    ]
  }'::jsonb
);