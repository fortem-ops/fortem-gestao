# Fiscal de Pipeline (categoria `pipeline`)

## Como o funil funciona hoje (lido no banco)

- Não há tabela de "leads" separada: o lead é um cadastro de aluno, e a etapa atual é `alunos.current_pipeline_stage_id`.
- Funil **Prospects** (em aberto): Novo lead (4), Informações encaminhadas (17), Prospect (2), Treino experimental agendado (3), Follow Up (1) = **27 leads em aberto**. "Aluno perdido" (57) encerra o lead.
- "Ganho" = o aluno passou para a etapa **Aluno ativo** (funil Aluno), não existe um status "ganho" separado.
- Sinais de atividade: `pipeline_metadata.last_contact_at` (atualizado automaticamente quando há contato), `pipeline_metadata.updated_at`, data da última mudança de etapa (`pipeline_movements.moved_at`) e `next_followup_at` (próximo retorno combinado). A tela do funil já calcula a "temperatura" com os três primeiros, e o fiscal vai usar a mesma regra.
- Contrato **não tem coluna de lead de origem**. O vínculo possível é pelo aluno: a origem fica em `pipeline_metadata.origem_lead` e o histórico de etapas em `pipeline_movements`.
- 1.498 cadastros antigos estão sem etapa e ficam fora de todas as checagens.

## Checagem 1 — Lead sem retorno (atenção)

- Alvo: lead em etapa aberta do funil Prospects (não entra "Aluno perdido" nem etapas desativadas).
- Última atividade = a mais recente entre último contato, atualização do lead e mudança de etapa.
- Alerta se a última atividade for mais antiga que **N dias úteis** (seg–sex; feriados de `ponto_feriados` descontados), ou se não houver nenhuma atividade.
- Também gera alerta se o `next_followup_at` combinado já venceu há mais de 1 dia útil sem novo contato (hoje há 0 casos em leads abertos).
- Subtipos: `lead_sem_followup` e `followup_vencido`. A chave inclui a data da última atividade: quando houver contato novo e o lead parar de novo, surge um alerta novo, sem repetir o antigo.
- Estimativa com 7 dias corridos: 4 dos 27 leads (com 14 dias: 5).

## Checagem 2 — "Ganho" sem contrato (proposta: crítico)

- Alvo: aluno na etapa **Aluno ativo** ou **Renovação de plano** sem nenhum contrato não cancelado.
- Proposta de severidade **crítico**: pode ser venda sem contrato formal (sem cobrança e sem aceite).
- Carência: só alerta se entrou na etapa há mais de 3 dias (tempo de formalizar).
- Hoje: **2 casos**, os dois com plano ativo e sem contrato.

## Checagem 3 — Contrato sem lead de origem

- Se aplicada a tudo, gera ruído: 114 dos 144 primeiros contratos dos últimos 90 dias não têm origem preenchida, e cerca de 200 contratos no total não têm histórico no funil (clientes antigos, importados).
- Proposta: **versão restrita, severidade informativo**. Pega só o **primeiro contrato do aluno criado nos últimos 30 dias** quando o aluno **nunca passou pelo funil Prospects** (nenhum registro de etapa antes do contrato) **e** não tem origem preenchida. Pega venda feita "por fora" do CRM, sem acusar clientes antigos nem renovações.
- Estimativa: cerca de 6 casos nos últimos 90 dias.
- Alternativa: deixar de fora.

## Tela e rotina

- `/auditoria`: opção "Pipeline" no filtro e rótulo no painel inicial. O contador do menu já soma todas as categorias.
- "Verificar agora" passa a rodar também este fiscal.
- Rotina diária (06:00 de Brasília): entra no mesmo agendamento dos outros três fiscais.
- A função não altera leads, etapas nem contratos: só registra alertas. Antes de gravar, a lista de casos vai ser mostrada como consulta.

## Detalhes técnicos

- Migração: `fn_auditoria_fiscal_pipeline()` SECURITY DEFINER, `search_path=public`, EXECUTE só `service_role` (mesmo padrão do fiscal de agenda). Deduplicação pelo índice `uniq_auditoria_achado`.
- Edge function `auditoria-fiscal-pagamentos`: chamar a nova função e devolver `resultado_pipeline`, depois deploy.
- Cron 33: acrescentar `SELECT public.fn_auditoria_fiscal_pipeline();`.
- Arquivos: `src/pages/Auditoria.tsx`, `src/components/dashboard/AuditoriaWidget.tsx`.
- Link do item: abre o aluno/lead (`/alunos/:id`), como já acontece hoje.

## Decisões suas

1. Dias sem retorno: proposta **5 dias úteis** (≈ 7 corridos). Outro valor?
2. Checagem 2 como **crítico** com carência de 3 dias?
3. Checagem 3: versão restrita (informativo) ou deixar de fora?
4. Incluir o subtipo "retorno combinado vencido" (`followup_vencido`)?
