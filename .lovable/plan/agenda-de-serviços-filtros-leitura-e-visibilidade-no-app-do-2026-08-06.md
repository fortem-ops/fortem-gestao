# Agenda de Serviços: filtros, leitura e visibilidade no app do aluno

## 1. Filtros no topo da grade

Barra de filtros acima do calendário semanal, no mesmo estilo já usado na Agenda de Treinos:

- **Atividade** (multi-seleção: Nutrição, Reabilitação, Avaliação Funcional, Treino Experimental e demais cadastradas)
- **Profissional** (lista de profissionais com horários na agenda)
- **Aluno** (lista de alunos vinculados a horários)
- Botão "Limpar filtros" quando houver algum ativo.

Os filtros são aplicados na montagem das células da semana, sem recarregar dados do servidor.

## 2. Legibilidade dos cards

Hoje texto e fundo usam a mesma cor em tonalidades próximas, o que dificulta a leitura. Mudanças:

- Card com fundo neutro (superfície do tema) e **barra colorida à esquerda** identificando a atividade — mesmo padrão visual da Agenda de Treinos.
- Texto principal em cor de alto contraste (foreground) e informações secundárias em muted.
- Nome da atividade em destaque, horário logo abaixo, aluno e profissional em linhas menores.
- Cada serviço mantém sua cor distinta (nutrição, reabilitação, avaliação, experimental etc.), aplicada apenas na barra lateral e num ponto/etiqueta — não no texto.
- Legenda de cores discreta abaixo da barra de filtros.

## 3. Escolher o que aparece no app do aluno

- Novo controle **"Visível no app do aluno"** no diálogo de criação/edição de horário (Agenda de Serviços).
- Padrão: desligado para não expor horários por engano; ao ligar, aquele horário passa a ser ofertado no portal em Agenda > Serviços.
- Na grade, horários ocultos do app recebem um ícone de "olho cortado" para identificação rápida.
- No portal do aluno, a listagem de horários de serviço passa a mostrar somente os horários marcados como visíveis. Exemplo: Reabilitação visível, Treino Experimental oculto.

## Detalhes técnicos

- Banco: adicionar `visivel_portal boolean not null default false` em `agenda_servicos` (migração simples, sem alterar políticas de acesso existentes).
- `src/pages/Agenda.tsx`: estados de filtro (arrays de atividade/profissional/aluno) usando o componente existente `MultiSelectFilter`; filtragem aplicada em `getEventsForCell`; refatoração visual dos cards com tokens semânticos (sem cores hardcoded), mapa `ATIVIDADE_COLORS` passa a definir apenas a cor de destaque/borda.
- `src/components/agenda/AddAgendaDialog.tsx`: campo `visivel_portal` (Switch) incluído no payload de criação (inclusive no modo lote) e na edição.
- `src/pages/portal/PortalAgenda.tsx`: query `portal-agenda-horarios-servico` ganha `.eq("visivel_portal", true)`.
- Sem mudanças na lógica de créditos, notificações ou disparos de WhatsApp.
