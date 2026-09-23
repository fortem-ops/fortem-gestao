# Fiscal de Contratos — nova categoria "contratos" na Auditoria

## Como funciona hoje (levantado no banco)

- **Aceite**: não fica na tabela de contratos. Cada contrato gera um **documento** (`contratos_documentos`) com o texto gerado, `aceite` (sim/não), `data_aceite`, `formato_aceite`, IP e assinatura. O "Copiar link de aceite" cria um registro em `links_contrato` (token, validade, usado), ligado ao documento.
- **Anexos Jurídicos** (`legal_annexes`): NÃO têm vínculo com contrato — só com o aluno. São fichas de saúde/uso de imagem/termo experimental (34 "anexo", 2 "experimental", de 11 alunos). Não servem como "anexo do contrato".
- Portanto o "documento do contrato" real é o `contratos_documentos`. Não existe PDF assinado guardado; o aceite é eletrônico (texto + data + IP + assinatura).

Números atuais (contratos ativos/suspensos, sem TotalPass/Gympass = 144):
- 85 sem nenhum documento gerado (60 antigos, com mais de 90 dias; 25 recentes)
- 46 com documento mas sem aceite
- 13 com aceite registrado
- TotalPass/Gympass ativos: 62, quase todos sem documento (fluxo da agregadora).

## Checagens propostas

1. **contrato_sem_documento** — contrato ativo/suspenso sem nenhum documento gerado.
2. **aceite_pendente** — contrato ativo/suspenso com documento, sem aceite, criado há mais de N dias.
3. (opcional) **anexo_saude_ausente** — aluno com contrato ativo sem ficha de Anexo Jurídico válida. Só se você quiser; hoje quase nenhum aluno tem, então nasceria com ~150 alertas.

Regras comuns: ignora contratos cancelados/encerrados, ignora TotalPass/Gympass, não altera nenhum contrato, documento ou aceite — só registra o alerta. Resolve sozinho quando o documento/aceite aparecer (mesmo padrão dos outros fiscais).

## Decisões que preciso de você

1. **Carência do aceite pendente**: sugiro **7 dias** após a criação do documento.
2. **Severidade**: sugiro aceite pendente = **atenção** até 30 dias e **crítico** acima de 30 dias com contrato ativo (peso jurídico); sem documento = **atenção**.
3. **Contratos antigos sem documento (60, anteriores ao sistema de aceite)**: (a) alertar todos, (b) só contratos criados a partir de uma data de corte (sugiro a data do primeiro documento gerado no sistema), ou (c) alertar antigos como informativo.
4. **Corrida** (12 com documento, 8 sem aceite): entra normalmente? Sugiro sim.
5. **Checagem 3 (ficha de saúde/Anexo Jurídico)**: incluir ou deixar de fora? Sugiro deixar de fora nesta versão.

## O que será feito (após aprovação)

- Função nova `fn_auditoria_fiscal_contratos()` com as checagens decididas; antes de gravar, rodo a lógica só como consulta e mostro a lista de casos.
- Incluída no job diário (cron 33), junto dos quatro fiscais atuais, e na função que o job chama.
- Tela Auditoria, widget do Dashboard e contador do menu ganham a categoria "Contratos".

## Detalhes técnicos

- Migração nomeada `fiscal_contratos`: função SECURITY DEFINER, search_path=public, EXECUTE só service_role (revogada de PUBLIC/anon); grava em `auditoria_inconsistencias` com categoria `contratos`, subtipos acima, `registros_afetados` com contrato_id, documento_id, aluno, data de criação, dias pendentes, link de aceite (existe/expirado).
- Documento considerado = o mais recente por contrato (`contratos_documentos` order by created_at desc).
- Exclusão por `coalesce(plano_tipo,'') not in ('totalpass','gympass')`.
- Alteração do cron 33 via `cron.alter_job` só no comando, mantendo horário; edge `auditoria-fiscal-pagamentos` passa a devolver `resultado_contratos` e é redeployada.
- Frontend: `src/pages/Auditoria.tsx`, `src/components/dashboard/AuditoriaWidget.tsx` (filtro/painel/rótulos). Nada de Rede, cobranças, recorrência ou grants de outras funções.
