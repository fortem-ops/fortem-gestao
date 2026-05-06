# Plano — Módulo "Notificar"

Sistema interno de comunicação técnica/operacional entre profissionais (Professores, Coordenadores, Administradores, Nutricionistas, Fisioterapeutas), acessível em **Principal > Notificar**.

A entrega será feita em **3 fases incrementais** para evitar um PR gigante e permitir validação por etapas.

---

## Fase 1 — Núcleo (MVP funcional)

### Banco de dados (migration)

Novos enums:
- `notif_categoria`: pauta_tecnica, reuniao, manutencao, administrativo, aluno, financeiro, comercial, marketing, estrutura, equipamentos, emergencial, outro
- `notif_prioridade`: baixa, media, alta, urgente
- `notif_tipo`: simples, solicitacao, reuniao, manutencao
- `notif_status`: nao_visualizada, visualizada, em_andamento, respondida, concluida, arquivada
- `notif_destinatario_status`: nao_visualizada, visualizada, em_andamento, respondida, concluida, arquivada
- `notif_acao_historico`: criada, editada, visualizada, respondida, status_alterado, arquivada, comentario, anexo

Novas tabelas:
- **notificacoes**: id, titulo, descricao, categoria, prioridade, tipo, status, criado_por (uuid), prazo (timestamptz), aluno_id (nullable, FK lógica para alunos — cobre aluno/prospect/lead pois usam a mesma tabela), reuniao_data, reuniao_local, agenda_id (nullable), created_at, updated_at
- **notificacao_destinatarios**: id, notificacao_id, usuario_id (uuid → auth.users), visualizado_em, status, created_at — UNIQUE(notificacao_id, usuario_id)
- **notificacao_comentarios**: id, notificacao_id, usuario_id, comentario, anexo_url (nullable), created_at
- **notificacao_historico**: id, notificacao_id, usuario_id, acao, payload jsonb, created_at
- **notificacao_categorias_custom** (preparada para Fase 2): id, nome, cor, criado_por, ativo

Função SECURITY DEFINER `fn_user_can_see_notificacao(_notif_id uuid)`:
- retorna true se: admin, coordenador, criador, ou destinatário direto

Triggers:
- `trg_notif_after_insert`: registra histórico "criada"
- `trg_notif_destinatario_visualizado`: ao setar `visualizado_em`, registra histórico
- `trg_notif_status_change`: registra histórico "status_alterado"

RLS:
- **notificacoes**: SELECT via `fn_user_can_see_notificacao`; INSERT pelo criador (`criado_por = auth.uid()`); UPDATE pelo criador ou coord/admin; DELETE somente admin
- **notificacao_destinatarios**: SELECT pelo destinatário, criador ou coord/admin; INSERT/UPDATE pelo criador da notificação ou coord/admin; UPDATE do próprio status pelo destinatário
- **notificacao_comentarios**: SELECT por quem pode ver a notificação; INSERT por participantes (criador/destinatário/coord-admin)
- **notificacao_historico**: SELECT por quem pode ver a notificação; INSERT apenas via triggers (sem policy de insert direto)

Storage bucket: **notificacao-anexos** (privado), policies de upload para autenticados, leitura para quem pode ver a notificação relacionada (path: `{notificacao_id}/{filename}`).

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes, notificacao_destinatarios, notificacao_comentarios;`

### Frontend

- **Rota** `/notificar` em `src/App.tsx` (lazy)
- **Sidebar** (`AppSidebar.tsx`): adicionar item "Notificar" no grupo **Principal**, com badge vermelho indicando contagem de não-visualizadas (query realtime)
- **Página** `src/pages/Notificar.tsx`: layout split (lista à esquerda, detalhe à direita estilo Slack/Linear). Tabs: Recebidas / Enviadas / Arquivadas
- Componentes em `src/components/notificar/`:
  - `NewNotificacaoDialog.tsx` — formulário com seleção de tipo, categoria, prioridade, destinatários (multiselect: indivíduos, "Todos coordenadores", "Todos professores", "Todos administradores", "Todos profissionais", por setor), prazo, aluno vinculado (StudentPicker), campos extras p/ Reunião
  - `NotificacaoList.tsx` — cards com badges de prioridade, indicador de leitura, filtros (categoria, prioridade, status, remetente, data, setor)
  - `NotificacaoDetail.tsx` — header, descrição, anexos, botões de status, timeline de comentários estilo chat, histórico
  - `NotificacaoComments.tsx` — input + upload de anexos
  - `NotificacaoBadge.tsx` — badge prioridade/status com cores
  - `RecipientPicker.tsx` — picker que carrega de `profiles` + `user_roles` (sem duplicar cadastro)
- **Hook** `src/hooks/useNotificacoes.ts`: queries + canal realtime; expõe `unreadCount` para sidebar
- **Lib** `src/lib/notificar.ts`: helpers (criar, marcar como visualizada, mudar status, expandir grupos de destinatários)
- **Toast realtime**: ao chegar nova notificação para o usuário, dispara `sonner` toast clicável

### Cores (semantic tokens em `index.css`)
Adicionar tokens (HSL):
- `--prio-baixa` (cinza), `--prio-media` (azul), `--prio-alta` (laranja), `--prio-urgente` (vermelho)
Utilities `.prio-baixa/.prio-media/.prio-alta/.prio-urgente`

---

## Fase 2 — Integrações e Dashboard

- **Dashboard widget** `src/components/dashboard/NotificacoesWidget.tsx`: cards (Pendentes, Urgentes, Não visualizadas, Em andamento, Concluídas no mês)
- **Integração Agenda**: ao criar notificação tipo `reuniao`, opção "Criar evento na agenda" → insere em `agenda_servicos` (data_especifica, horario_inicio, horario_fim, local) e grava `agenda_id` na notificação
- **Integração Aluno**: aba/seção "Notificações" em `StudentProfile.tsx` listando notificações com `aluno_id` vinculado
- **Integração Tarefas**: botão "Gerar tarefa" no detalhe da notificação cria registro em `tarefas` referenciando o título
- **Categorias customizadas**: tela admin para CRUD em `notificacao_categorias_custom` (somente admin)
- **Filtros avançados** + busca textual

---

## Fase 3 — Preparação para futuro (apenas estrutura)

Sem implementação visível ainda, apenas garantir que o schema/arquitetura suporta:
- coluna `requer_confirmacao_leitura boolean` em `notificacoes`
- coluna `assinatura_digital text` em `notificacao_destinatarios`
- tabela `notificacao_eventos_automaticos` (trigger de eventos do sistema → notificação)
- coluna `enviar_whatsapp boolean`, `enviar_email boolean` (sem worker ainda)
- edge function stub `notificacoes-dispatch` para futuras integrações externas

---

## Permissões (resumo)

| Papel | Acesso |
|---|---|
| Professor | Vê apenas notificações onde é destinatário ou criador |
| Nutri/Fisio | Idem professor (mesmo modelo via destinatários) |
| Coordenador | Vê todas da equipe |
| Administrador | Acesso total + categorias customizadas |

Tudo aplicado via RLS + `fn_user_can_see_notificacao` + checagens nos componentes (esconder botões de admin).

---

## Detalhes técnicos relevantes

- Destinatários "em massa" (ex.: "Todos professores") são **expandidos no momento da criação** para linhas em `notificacao_destinatarios`, garantindo que filtros, contagem e RLS funcionem por usuário.
- "Setor" = baseado em `profiles.specialty` + `user_roles.role`.
- Realtime usa um único canal `notificacoes:user:{auth.uid()}` filtrado por `notificacao_destinatarios.usuario_id`.
- Anexos: até 20MB por arquivo, upload direto para Storage; preview inline para imagens/PDF.
- Mobile-first: lista vira tela cheia, detalhe abre como `Sheet`.

---

## Arquivos principais a criar/editar

**Novos**
- `supabase/migrations/<ts>_notificar_module.sql`
- `src/pages/Notificar.tsx`
- `src/components/notificar/*` (7 componentes)
- `src/hooks/useNotificacoes.ts`
- `src/lib/notificar.ts`
- `src/components/dashboard/NotificacoesWidget.tsx` (Fase 2)

**Editados**
- `src/App.tsx` (rota lazy)
- `src/components/AppSidebar.tsx` (item + badge)
- `src/index.css` (tokens de prioridade)
- `src/pages/Dashboard.tsx` (widget — Fase 2)
- `src/pages/StudentProfile.tsx` (aba notificações — Fase 2)

Posso começar pela **Fase 1** assim que aprovado.
