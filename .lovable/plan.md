# Releitura arquitetural — Fortem Gestão Técnica (21/08/2026)

Levantamento somente de leitura. Nenhum arquivo de código ou dado foi alterado.

## 1. Rotas registradas (`src/App.tsx`, 623 linhas)

### Públicas (sem autenticação)
| Rota | Componente |
|---|---|
| `/login` | Login (eager, único não-lazy) |
| `/recuperar-senha` | RecoverPassword |
| `/redefinir-senha` | ResetPassword |
| `/corrida` | Corrida (landing da campanha) |
| `/privacidade` | Privacidade |
| `/termos/aptidao-fisica-uso-imagem` | TermoAptidaoUsoImagem |
| `/.lovable/oauth/consent` | OAuthConsent (servidor OAuth do MCP) |
| `/treino/:id` | PublicWorkout (QR do PDF de treino) |
| `/assinar` | LegalAnnexFlow (`documentType="anexo"`) |
| `/assinar-experimental` | LegalAnnexFlow (`documentType="experimental"`) |
| `/cartao/:token` | CadastrarCartao (link tokenizado) |
| `/cadastrar-cartao` | CadastrarCartao (entrada genérica) |
| `/contrato/:token` | AceitarContratoToken |
| `/parceiro/login` | PartnerLogin |
| `/parceiro` | PartnerPortal |
| `*` | NotFound |

### Portal do Aluno
Auth próprio (`/portal/login`, `/portal/cadastro`, `/portal/recuperar-senha`, `/portal/redefinir-senha` ficam fora do guard). O restante roda sob `RequireStudent` + `StudentPortalProvider` + `PortalLayout`:
`/portal` (redirect → home), `/portal/home`, `/perfil`, `/treinos`, `/avaliacoes`, `/clube`, `/agenda`, `/plano`, `/notificacoes`, `/carteirinha`, `/assistente`, `/contratos`, `/pagamentos`.

### Parceiro autenticado (sem AppLayout, UX kiosk)
`/parceiros/scanner` → PartnerScannerPage, dentro de `ProtectedRoute`.

### Interno / staff (`ProtectedRoute requireStaff` + `AppLayout`)
- **Núcleo:** `/` Dashboard · `/tarefas` TaskCenter · `/notificar` Notificar · `/comissionamentos` Comissionamentos
- **Cadastros:** `/alunos` StudentList(ativos) · `/alunos-inativos` StudentList(inativos) · `/clientes-avulsos` · `/alunos/:id` StudentProfile · `/leads` · `/prospects` · `/anexos` AnexosJuridicos
- **Técnico:** `/exercicios` · `/banco-treinos` · `/meus-treinos` · `/carteira` · `/arquivos-metodologicos` · `/avaliacoes` · `/avaliacoes-premium` e `/avaliacoes-premium/:alunoId` · `/bodymap-config`
- **Agendas:** `/agenda` · `/agenda-treinos` · `/presencas` · `/knowledge-base`
- **Clube e parceiros:** `/clube` · `/clube-fortem` · `/admin-parceiros`
- **Comercial:** `/pipeline` · `/corrida/inscricoes`
- **Ponto:** `/ponto` · `/ponto/equipe` · `/ponto/fechamento` · `/ponto/relatorio` · `/admin/ponto` · `/admin/diagnostico-banco-horas`
- **Financeiro:** `/financeiro/cartoes` · `/financeiro/contratos` · `/financeiro/templates-contratos` · `/financeiro/adquirente`
- **Sistema:** `/admin` · `/admin/notificacoes-email` · `/whatsapp` (+ redirect legado `/configuracoes/whatsapp`)
- **Relatórios** (`RelatoriosLayout`, rotas filhas relativas): index, `vendas`, `financeiro`, `planos`, `cancelamentos`, `servicos`, `crm`, `equipe`, `tecnicos` (placeholder EmBreve)

Rotas sem item de menu: `/clube`, `/admin/diagnostico-banco-horas`, `/relatorios/tecnicos`.

## 2. Menu lateral (`AppSidebar.tsx`), na ordem

1. **Principal** — Ponto (item especial com dot de status de jornada) · Dashboard · Tarefas · Notificar (badge de não lidas) · Comissionamentos · *[coord/admin]* Equipe Ponto, Relatório Ponto, Fechamento Ponto
2. **Agendas** — Agenda de Serviços · Agenda de Treinos · Presenças · *[coord/admin]* Base de Conhecimento, Clube FORTEM, Parceiros
3. **Técnico** — Banco de Treinos · Banco de Exercícios · Avaliações · Avaliações Premium · Config. Mapa Corporal · Carteira de Alunos · Arquivos Metodológicos · Meus Treinos
4. **Cadastros** — *[admin]* Leads · Prospects · Alunos Ativos · Alunos Inativos · Clientes Avulsos · *[admin]* Anexos Jurídicos
5. **Comercial** *[coord/admin]* — Inscrições Corrida · *[admin]* Pipeline
6. **Financeiro** *[coord/admin]* — Contratos · Templates de Contratos · Cartões de Crédito · Adquirente
7. **Análise** *[coord/admin]* — Relatórios
8. **Sistema** — *[coord/admin]* Administração, Notificações por Email, WhatsApp (badge verde de não lidas), Admin Ponto · *[parceiro ou admin]* Painel Parceiro

Rodapé: e-mail do usuário + Sair. Gate de papéis via `useUserRoles` (`isAdmin`, `isCoordAdmin`, `isParceiro`).

## 3. Edge functions (55 + `_shared`)

**Pagamentos — e-Rede:** `rede-cobrar-cartao` (cobrança com PAN), `rede-cobrar-token` (cobrança com cartão salvo), `rede-cancelar` (cancelamento/estorno), `rede-webhook` (retorno de transação), `rede-salvar-cartao` (Zero Dollar via link público), `rede-tokenizacao-webhook` (confirmação de tokenização).

**Pagamentos — PIX / Banco Inter:** `inter-auth` (OAuth mTLS, restrito a admin/coord), `pix-criar-cobranca`, `pix-criar-recorrencia`, `pix-cancelar-recorrencia`, `pix-solicitar-confirmacao`, `pix-webhook`.

**Financeiro/recorrência:** `renovar-planos-mensais` (renovação diária, protegida por webhook secret), `comissionar-carteira-mensal` (comissão de carteira ativa no dia 1º).

**Campanha Corrida:** `corrida-lookup-cpf` (dedupe por `cpf_hash`), `corrida-registrar-inscricao`, `corrida-atualizar-inscricao-prova`, `corrida-criar-pedido`, `corrida-aceitar-contrato`, `corrida-cobrar-pedido`, `corrida-status-tokenizacao` (polling), `corrida-enviar-confirmacao-email`.

**WhatsApp:** `send-whatsapp` (envio unitário), `whatsapp-webhook` (recebimento Meta), `subscribe-waba` (assina a WABA — WABA_ID fixo no código), `whatsapp-disparo-agenda` (avisos de agendamento), `whatsapp-resumo-agenda-amanha` (resumo 20:40 para profissional e consultor), `whatsapp-disparo-ponto`, `whatsapp-resumo-ponto`.

**Ponto:** `ponto-alertas-diarios`, `ponto-notificar-pendencias` (jornadas sem saída), `ponto-banco-expirar` (expiração mensal de saldo positivo), `ponto-fix-divergencias` (reprocessamento retroativo de fuso/divergências).

**Agenda e notificações:** `notify-agenda-diaria`, `notify-agenda-proximos` (cron 5 min, janela 25–35 min antes de avaliações/experimentais), `notify-agenda-evento`, `notify-notificacao-evento`, `notify-tarefa-evento`, `agenda-ics` (feed de calendário público), `send-push-notification`, `check-push-triggers`, `generate-vapid-keys`, `processar-horarios-fixos` (materializa vagas fixas semanalmente).

**Avaliações:** `parse-kinology-pdf` (extrai laudo Kinology, incluindo o histórico multi-data de evolução de assimetria).

**Contratos e jurídico:** `aceitar-contrato-documento`, `aceitar-contrato-token`, `submit-legal-annex`, `migrate-from-consent-care` (importação de `legal_annexes` do projeto Consent & Care via token compartilhado).

**Clube/CRM/infra:** `check-clube-clima` (cache de clima para desafios), `lookup-by-cpf`, `admin-users` (CRUD de usuários e papéis com service role + Zod), `assistant-chat` (IA do portal, v1.2), `pipedrive-status`, `pipedrive-list-leads`, `pipedrive-import-leads`, `mcp` (auto-gerada a partir de `src/lib/mcp/`).

**`_shared/` (662 linhas, usada por 18 functions):** `agenda-template.ts` (243) monta payloads de template Meta com fallback `'—'`; `inter.ts` (198); `whatsapp.ts` (106); `rede-auth.ts` (66); `corrida-rate-limit.ts` (49).

## 4. Banco (schema `public`)

- **146 tabelas**, 13 views, 71 rotinas, 172 triggers não internos, 350 migrations versionadas.
- Tabelas com mais de 15 colunas: `corrida_inscricoes_prova` (35), `alunos` (29), `ponto_jornadas` (28), `contratos` (28), `vendas` (27), `avaliacao_funcional` (22), `legal_annexes` (22), `parceiros` (21), `planos` (19), `notificacoes` (19), `clube_desafios` (19), `whatsapp_disparos_config` (17), `notificacao_email_config` (17), `ponto_fechamentos_mensais` (17), `ponto_substituicoes` (17), `agenda_servicos` (17), `comissionamentos` (16), `ponto_politica_retencao` (16), `clube_recompensas` (16), `rede_tokenizacoes` (16), `pipeline_metadata` (16), `corrida_campanha_itens` (16), `treino_agendamentos` (16).

## 5. Volume de código

| Área | Linhas |
|---|---|
| `src/` (483 arquivos .ts/.tsx) | 111.763 |
| ├ `src/components` | 62.255 |
| ├ `src/pages` | 29.144 |
| ├ `src/integrations` (types gerados) | 8.779 |
| ├ `src/lib` | 7.523 |
| ├ `src/hooks` (23 arquivos) | 2.249 |
| └ `src/contexts` | 307 |
| `supabase/functions` (61 arquivos .ts) | 10.583 |

Divisão: 370 `.tsx` e 113 `.ts` em `src/`. 27 subpastas de domínio em `src/components`.

## 6. Cron jobs ativos (23, todos `active=true`)

| Schedule | Job |
|---|---|
| `*/5 * * * *` | notify-agenda-proximos-5min · whatsapp-disparo-ponto-5min · whatsapp-resumo-agenda-amanha-5min |
| `*/30 * * * *` | rate-limit-cleanup · rate-limit-rede-cleanup |
| `0 * * * *` | fortem-desafios-progresso |
| `0 1 * * 2-6` | ponto-pendencias-diario |
| `0 3 * * *` | clube-fortem-resync-diario · pipeline-detect-evasao-daily · renovar-planos-mensais-daily |
| `0 7 * * *` | processar-cobrancas-diario |
| `0 8 * * *` | fortem-clube-clima-daily |
| `0 10 * * *` | agenda-diaria-email · agendar-reavaliacoes-funcionais-diario |
| `0 12 * * *` | fortem-push-triggers-daily |
| `40 23 * * 0-5` | whatsapp-resumo-ponto-diario (20:40 BRT) |
| `50 23 * * *` | ponto-alertas-diarios |
| `55 23 * * *` | fortem-finalizar-treinos-dia |
| `0 9 * * 1` | fortem-horarios-fixos-semanal |
| `0 2 1 * *` | ponto-fechamento-mensal · ponto-banco-expirar-mensal |
| `0 3 1 * *` | comissionar-carteira-mensal · audit-log-cleanup-5anos |

Observação: `agendar-reavaliacoes-funcionais-diario` segue agendado, mas a criação de tarefas/comissões de Avaliação Funcional está pausada em nível de banco (`fn_comissao_af_ativa()` retorna falso), então ele roda sem efeito prático.

## 7. Mudanças arquiteturais desde ~30/07/2026

86 migrations e 544 arquivos de código tocados no período. O que mudou de forma estrutural:

1. **Camada `supabase/functions/_shared/`** — antes cada function duplicava auth da Rede, cliente Inter, montagem de template Meta e rate limit. Hoje são 5 módulos consumidos por 18 functions. Efeito prático: a correção do erro Meta 131008 (parâmetro vazio → fallback `'—'`) foi feita em um só lugar e valeu para todos os disparos.
2. **Módulo Campanha Corrida completo** — landing pública, wizard de inscrição, checkout com tokenização/parcelamento, contrato por token e e-mail de confirmação; 8 edge functions dedicadas, tabelas `corrida_*`, rate limits próprios e `verify_jwt=false` explícito no `config.toml`. É hoje o maior domínio novo e a tabela mais larga do schema.
3. **Avaliações Premium reescritas para base percentil Fortem** — saiu a faixa fixa em graus, entrou severidade por percentil sobre `mobilidade_amostras_fortem` / `forca_*`, com curvas de Gauss, análise de assimetria e "Pontos de Atenção" por métrica (Mobilidade) ou por exercício (Força).
4. **Mapa corporal virou dado, não código** — as formas musculares deixaram de ser constantes no bundle e passaram a viver em `bodymap_shapes` / `bodymap_region_overrides`, editáveis pela página `/bodymap-config` (pontos Bézier, espelhamento, lado oposto tracejado). Nova rota interna sem menu equivalente até então.
5. **PDF/protocolos de treino** — família de exportadores (5-3-1, M102, Plan Strong 50) com auto-fit de página e QR para a rota pública `/treino/:id`.
6. **Financeiro endurecido** — `src/lib/baixaVenda.ts` e `src/lib/formasRecebimento.ts` centralizaram propagação de baixa e forma de recebimento real (antes espalhados em 3 fluxos); trigger + `fn_cancelar_inadimplencias_contratos_anteriores` limpam inadimplências de contratos renovados; suporte a multi-contratos ativos (Plano Corrida) e edição de datas de renovação antecipada.
7. **CPF criptografado ponta a ponta** — `cpf_ultimos3` + RPCs `fn_reveal_cpf`/`fn_update_cpf` + busca por `cpf_hash`; nenhuma tela lê CPF em claro do banco.
8. **Ponto maduro** — jornada partida, banco de horas com expiração, fechamento mensal com espelho em PDF, reprocessamento retroativo de fuso via RPC segura, resumos e alertas por WhatsApp; 6 rotas e 3 itens de menu só para o domínio.
9. **Endurecimento de segurança contínuo** — RLS/GRANT revisados por tabela, `security_invoker` em views, trigger de imutabilidade em `cartoes_salvos`, funções `SECURITY DEFINER` com `search_path` fixo e sem `execute` para `anon`.
10. **Superfícies novas de integração** — servidor MCP (`src/lib/mcp/` → function `mcp` + rota de consentimento OAuth), Clube FORTEM gamificado com portal do parceiro/scanner, Arquivos Metodológicos e fichas de treino para a própria equipe.
