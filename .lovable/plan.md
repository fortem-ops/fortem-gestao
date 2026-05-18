## Objetivo

Tornar o formulário da aba **Experimental** totalmente editável por Coordenadores/Administradores: poder **renomear títulos de seções**, **adicionar/editar/remover perguntas** e suas **opções de resposta**, mantendo autosave e respostas já preenchidas.

## 1. Modelo de dados

Nova tabela `avaliacao_templates` para guardar o **schema** (estrutura) do formulário por tipo de avaliação.

```sql
create table public.avaliacao_templates (
  id uuid primary key default gen_random_uuid(),
  tipo text not null unique,           -- 'experimental' (futuramente outros)
  schema jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.avaliacao_templates enable row level security;
create policy "Authenticated read templates" on public.avaliacao_templates for select to authenticated using (true);
create policy "Coord/Admin write templates"  on public.avaliacao_templates for all   to authenticated using (is_coordinator_or_admin(auth.uid())) with check (is_coordinator_or_admin(auth.uid()));
```

Formato do `schema`:

```json
{
  "sections": [
    {
      "id": "anamnese",
      "title": "Anamnese",
      "questions": [
        { "id": "saude", "label": "Histórico de saúde...", "type": "sim_nao_detalhe", "detalheLabel": "Quais condições?" },
        { "id": "gestante", "label": "Está gestante?", "type": "sim_nao_numero", "detalheLabel": "Semanas" },
        { "id": "atividade", "label": "Pratica atividade...", "type": "sim_nao_dupla", "labelSim": "Qual?", "labelNao": "Há quanto tempo parado(a)?" },
        { "id": "motivo", "label": "...", "type": "texto" }
      ]
    },
    {
      "id": "mobilidade",
      "title": "Avaliação de Mobilidade",
      "questions": [
        { "id": "gatinho", "label": "Gatinho", "type": "opcoes",
          "options": [
            { "value": "movel", "label": "Móvel" },
            { "value": "restrito", "label": "Restrito" },
            { "value": "dificuldade", "label": "Dificuldade de compreensão e execução" }
          ]
        },
        { "id": "obs_mob", "label": "Observações...", "type": "texto" }
      ]
    }
  ]
}
```

Tipos suportados: `sim_nao`, `sim_nao_detalhe` (Sim → textarea), `sim_nao_numero` (Sim → input numérico), `sim_nao_dupla` (Sim → textarea, Não → input), `texto`, `numero`, `opcoes` (radio com N opções).

Seed inicial migra o template atual codificado em `ExperimentalAssessment.tsx`.

## 2. Armazenamento das respostas

Em `avaliacoes.dados` passa a ser:
```json
{
  "status": "rascunho|finalizado",
  "finalized_at": null,
  "answers": { "<questionId>": <valor variando por tipo> }
}
```
Migração leve no componente para ler formato antigo (compatibilidade): se vier `anamnese`/`mobilidade`, mapear para `answers` por id conhecido na primeira leitura.

## 3. Componentes

- **edit** `ExperimentalAssessment.tsx`:
  - Carrega `schema` via React Query (`["avaliacao-template","experimental"]`).
  - Renderiza dinamicamente as seções/perguntas com um dispatcher por `type`.
  - Mantém autosave e botões finalizar/reabrir.
  - Botão **"Editar formulário"** visível só para coord/admin → abre `TemplateEditorDialog`.

- **new** `ExperimentalTemplateEditor.tsx` (dialog):
  - Lista seções (editar título, adicionar/remover seção).
  - Em cada seção: lista de perguntas com editar label, tipo, e opções (quando `type='opcoes'`); ações adicionar/duplicar/remover/mover (↑↓).
  - Botão "Salvar" persiste `schema` na tabela e invalida a query.
  - Validações: ids únicos por seção; ao remover pergunta exibir aviso de que respostas já gravadas para aquele id ficarão órfãs.

- **edit** `AssessmentViewerDialog.tsx`:
  - Renderiza o histórico do experimental usando o schema atual: para cada `answers[id]`, busca a pergunta correspondente para mostrar o label correto; se a pergunta não existir mais no template, mostra "(pergunta removida)".

## 4. Permissões

- Banco já protegido por RLS.
- UI: botão "Editar formulário" e dialog só renderizam se `is_coordinator_or_admin` for true.

## 5. Arquivos

- **migration** — cria `avaliacao_templates` + policies + seed experimental.
- **edit** `src/components/student/assessment/ExperimentalAssessment.tsx`
- **new** `src/components/student/assessment/ExperimentalTemplateEditor.tsx`
- **edit** `src/components/student/assessment/AssessmentViewerDialog.tsx`

## 6. Observações

- Manter `useDebounce` 800ms para autosave.
- Os ids de pergunta são gerados (`crypto.randomUUID()` ao criar nova) e nunca renomeáveis (label sim, id não) para preservar histórico.
- Sem mudança no fluxo de finalização; permanece editável após finalizar.
