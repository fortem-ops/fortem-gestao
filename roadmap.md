# Roadmap
- [x] Primeiro acesso: migração 0250 aplicada, vínculo restrito e erro_vinculo com log; 20 ensaios revertidos aprovados, três alunos manuais intactos; primeiro cadastro real ainda não confirmado.

- [x] /10anos: prazo único em festa-prazo.ts até 12/11/2026 às 23:59:59 Brasília; festa-confirmar atualizada no servidor e teste sem dados confirmou remoção do bloqueio. 26 testes passaram e formulário conferido, 103 pessoas preservadas. Site não publicado; nenhuma confirmação ou PIX de teste gerado.

- [x] Lote 5 — Feed da Comunidade (0219): consentimento, publicação só por fn_comunidade_compartilhar (treino, conquista, sequência), limite 3/dia, foto pendente de análise, reação "Força", apagar/denunciar, sair do feed, aba Feed no gestor (fotos, denúncias, remover, suspender). Bucket privado comunidade-feed (3 MB). Limpeza diária 06:30 UTC (função comunidade-feed-limpeza). Ensaio revertido aprovado. Telas não vistas com aluno logado.
- [x] Ajustes Comunidade (0220): foto entra publicada na hora (foto_pendente sem uso, mantido no CHECK), moderação posterior; gestor com "Fotos recentes" (30 dias) e contador só de denúncias; pergunta "Compartilhar treino?" ao concluir o treino (só quando o agendamento já está realizado); capas dos cards alinhadas ao topo; espaço no rodapé do detalhe do clube.
- [ ] Feed: tipo "recorde" (carga recorde do 5-3-1) não implementado — o sistema não guarda recorde de carga; depende de criar esse registro.

- [x] Lote 3 portal: Clube sem níveis (migrações 0214/0215), multiplicador por plano em clube_config, custo de resgate único (+30% agregador), conquista 8 Semanas Seguidas (fn_clube_semanas_seguidas), menu lateral, "Benefícios", SeloPlano, Perfil com progresso (/portal/meu-perfil). Ensaio revertido: Start 10, Power 13, Pro 15, agregador 5, Pro+clima 23. Telas não vistas com aluno logado.
- [x] Portal — menu lateral: "Perfil" volta a abrir /portal/perfil (dados pessoais, plano, contratos, pagamentos) e novo item "Progresso" (ícone TrendingUp) abre /portal/meu-perfil. Ordem: Perfil, Progresso, Benefícios, Conquistas, Sair. Só front-end, sem migração.
- [ ] Colunas sem uso desde o lote 3 (apagar só depois, com aprovação): planos_catalogo.nivel_clube, clube_fortem_membros.nivel_membro, clube_pontos.nivel; beneficios.niveis_permitidos e clube_recompensas.custo_power/custo_pro/custo_max/custo_start_plus também ficam sem uso. Enum clube_nivel_membro mantido.
- [x] 0216: fn_clube_resgatar sem checagem de planos_elegiveis (bloqueava planos 2027). Coluna clube_recompensas.planos_elegiveis mantida, sem uso, marcada DEPRECATED; editor do gestor não a mostra nem grava mais.

- [x] Site público — Etapa 7b: 15 fotos reais integradas via CDN, cantos preservados e seis páginas conferidas em 390px/1280px; 11 testes passaram, sem erros de execução; não publicado. Prévia local conferida com os arquivos do armazenamento hospedado (localhost não serve o CDN diretamente).

- [x] Disparo de Mensagens — etapa 1: menu, rota, abas, modelos.
- [x] Disparo de Mensagens — etapa 2: público + opt-out.
- [x] Disparo de Mensagens — etapa 3: tabelas de campanha (0206), passo Mensagem (só WhatsApp), envio de TESTE para telefone digitado.
- [x] Disparo de Mensagens — etapa 4: revisão e envio (preparar, dedupe por telefone, confirmação do total), histórico, envio real TRAVADO (msg_config.real_liberado=false, 0207).
- [ ] Disparo de Mensagens — etapa 5: liberar real_liberado por migração e enviar o 1º lote de 50 — aguarda aprovação do dono.
- [ ] Etapa 4: Revisar e enviar, preparar destinatários (dedupe por telefone), confirmação do total, link de descadastro, Histórico — envio real travado por flag (aguarda aprovação).
- [ ] Etapa 5: liberar a flag e enviar o primeiro lote de 50 (aguarda aprovação).

- [x] Facial no balcão: termos completos compartilhados do app/responsável, equipe preservada; 12 testes locais passaram, diálogos adulto/menor simulados em computador/celular conferidos sem salvar; contagens 227/1/1 e modo log preservados.

- [x] /10anos: preço único, servidor/migration 0187, telas e 23 testes; inserções simuladas revertidas; formulário e inclusão manual conferidos; zero pendentes, quatro registros preservados e PIX teste R$70 intacto; site não publicado.

- [x] Correções A1–A3 e Etapa 3 facial: migration 0186, função facial-responsavel publicada; links exclusivos da equipe; testes SQL revertidos e telas simuladas sem erros; contagens 227/1/1, links 0, modo log e flag true preservados; domínio não publicado.

- [x] Importação facial da porta: migração 0183 literal, facial-agente-importar publicada; testes SQL (a–d) desfeitos; listagem autenticada 200/token inválido 401; contagens 227/1/1 e modo log preservados; nenhuma foto real importada.

- [x] Fila facial: SQL literal aplicado na migração 0180, somente facial-agente-fila publicada; fila vazia e modo log confirmados, RPCs restritas a service_role; sem enfileirar pedidos.

- [x] Pagamento manual recorrente: cobrança de Larissa regularizada com travas/auditoria e reversão; migração 0177 e quatro funções publicadas; 108 testes e ensaio NICOLAS TESTE com rollback passaram; checkout público, créditos, contrato/cartão, flags e crons preservados. Nenhuma nova captura real nem pagamento pela tela foi testado.

- [x] Portal Evolução: resumo, mapa intacto, pontos por nível, comparativo completo, reavaliação e detalhes recolhidos; consultas/cálculos preservados, 13 testes e build OK; móvel/desktop conferidos em simulação. Percentis exatos indisponíveis no resumo já consultado (sem consulta nova).

- [x] Portal: horários futuros de São Paulo reavaliados por minuto; desafio compacto no Início e detalhado no Clube com consulta/cache existentes; 43 testes e build OK, visual e navegação conferidos em simulação móvel/desktop (sessão disponível sem vínculo de aluno).

- [x] Portal Pagamentos: próxima cobrança global, cartões recolhíveis e histórico; consultas e cadastro preservados, 5 testes passaram, visual conferido com simulação (conta disponível sem vínculo de aluno).

- [x] ANEXO I: migração 0142 aplicada e conferida; função, tela e ficha prontas; ensaio desfeito e testes OK.
- [ ] ANEXO I: publicar `planos-checkout` no momento do Publish do dono (aguarda o dono).
- [x] Expirar e2538616 (lixo de teste autorizado).
- [ ] Limpeza das propostas de teste (só DEPOIS do ANEXO I): listar; backup + rollback; apagar só sem pagamento/ativação/Rede/cobrança, com dependentes; preservar e listar as pagas (07289404, Pix R$1 de 13/10…); sem tocar sistema_config, tokenizações, cron, balcão.

- [x] Expirar somente a proposta pública 8f9441a2 e invalidar sua sessão; outra proposta real aberta com aceite: e2538616 (preservada).
- [x] Atualizar confirmação do Passo 9 com ativação automática e WhatsApp; 915 Vitest + 30 Deno passaram.

- [x] Checkout /planos — 2D-2: Pagamento reservado e Confirmação; 48 testes, prévia móvel/desktop, retomada e recusa anônima verificadas; contagens preservadas.
- [x] Pagamentos P0+P1+P2 em simulação (Pix à vista, cartão 12x)
- [ ] P3 webhook do Pix (aguarda aprovação)
- [ ] P4 marcar paga, notificação e e-mail (aguarda aprovação; rascunho do e-mail antes)
- [ ] Cartão real: tokenização ligada à proposta (aguarda aprovação)

- [x] Checkout /planos — Fase 0: contagens de referência (só leitura)
- [x] Checkout /planos — Fase 1: identificação por celular ou CPF + código por e-mail + Turnstile desligado por chave
- [ ] Fase 1: envio real do código ao NICOLAS TESTE (bloqueio: CPF e telefone dele são compartilhados com outros cadastros)
- [ ] Turnstile: aguarda site key e secret do dono
- [ ] Checkout /planos — Fases 2–8 (aguardam OK do dono; CPF obrigatório no contrato, reposição para aprovação da equipe, Pix 30 min, compra real só com pedido)

- [x] Contratos 2027: Pix Automático restaurado pelo backup; ativação recusa só boleto (não executada); reposição contratual de 30 dias; cinco exemplos renderizados; 76 testes; catálogo, legado e registros financeiros preservados. Transferência de créditos ainda não implementada, sem criação nesta rodada.

- [x] Rodada 2 /planos: identificação segura por telefone, cartões selecionáveis, parcelas e interruptor de recorrência; 75 testes e fluxo visual 390px/1280px sem ativação
- [ ] Rodada 2: envio real vinculado ao NICOLAS TESTE (bloqueadores: telefone compartilhado por 6 cadastros e ausência de sessão admin autorizada)

- [x] Correção Fase 4: cinco passos, detalhes, resumo desktop e corrida por período; testes de cálculo e fluxo visual em 390px/1280px sem ativação
- [ ] Correção Fase 4: validar envio e leitura da proposta real de prévia (aguarda sessão de administrador; email do solicitante sem conta de acesso)

- [x] Aceites Tecnofit: simulação do cruzamento por nome
- [x] Aceites Tecnofit: gravados em contratos_documentos com origem Tecnofit
- [x] Fiscal de Contratos (carência de 7 dias; atenção até 30 dias / crítico acima; sem documento = atenção; Corrida entra; ficha de saúde fica de fora)
- [x] Corrigir lembrete do Dashboard para reconhecer Mobilidade/Flexibilidade e Força em avaliações `funcional_v2`
- [x] Encaminhar lembretes para Avaliações e descrever somente as partes realmente pendentes
- [x] Tela inicial do Lançar Folha: upload primeiro, formulário manual como opção secundária
- [x] Planos 2027 — Fase 1: catálogo versionado, serviços, créditos mensais/reposição, brindes, Clube (itens inativos)
- [x] Planos 2027 — Fase 2 contratos: 5 templates 2027 (inativos) + escolha por catálogo
- [x] Planos 2027 — Fase 4G preparação: backup, contratos sem Pix Automático, venda 2027 para admin/coordenador/professor, /planos-atual removida
- [ ] Planos 2027 — ativação (`fn_golive_2027_ativar`) após revisão jurídica (aguarda OK do dono); legado segue à venda
- [x] Planos 2027 — Fase 3A: cálculo de valores 2027 + testes
- [ ] Planos 2027 — Fase 3B–3F (aguarda pedido): venda 2027 na tela, rotina mensal de créditos, baixa em lote, relatórios/repasse, teste Pix Automático
- [x] Planos 2027 — Fase 4: /planos público em 5 passos (prévia admin), propostas do site em Leads

- [x] 3B.1 Start 2027 mensal com renovação + 3C rotina mensal de créditos (tolerância 3 dias)
- [ ] 3F QR (Jornada 2): cancelar rec 14/10, criar nova hoje com loc, entregar QR; aguardar autorização do dono

- [x] Ativação 2027 — Fase A: vínculo do aluno, plano, contrato, créditos e documento a partir da proposta paga
- [x] Ativação 2027 — Fase B: pagamentos, mensalidades espelho, Start do site, filtros de teste (limpeza da ativação de teste 5e8fb850 aguarda autorização)
- [x] Ativação 2027 — Fase C: estorno pelo fluxo atual (cartão, mensalidade, Pix do site)
- [x] Ativação 2027 — Fase D: Financeiro > Propostas de contratos; aba de Leads removida, favoritos redirecionados, coord/admin consulta e ações sensíveis só admin; navegação autenticada desktop/móvel verificada, sem ações financeiras.
- [x] Ativação 2027 — Fase E: e-mail único com comprovante/contrato aceito, reenvio admin, 9 testes de e-mail e 892 testes gerais; ensaios Power Pix/Start recorrência e envio seguro único, sem ativação/baixa.
- [ ] Fase E — comprovar recebimento na caixa de teste (aguarda confirmação do dono) e e-mail após compra real ativada (aguarda compra real autorizada).
- [x] Consultas + recorrência — F1: obrigação/snapshot, finalidade, aceite, reservas/estados, liberação pós-pagamento e cancelamento somente admin; ensaios SQL desfeitos, 892 Vitest + 42 Deno; contagens/chaves/crons preservados; bloqueio público mantido e permissões conferidas após restrição explícita.
- [x] Consultas + recorrência — F2: blocos PLANO/CONSULTAS, aceite F1 e simulação admin-only publicada; recusa, retomada após recarregar, bloqueio desconhecido e desktop/móvel verificados com NICOLAS TESTE; 904 testes passaram. Criada uma obrigação de teste, sem venda/crédito/cobrança/mensalidade/tentativa financeira/e-mail; controles preservados. Estado hipotético em logs exclusivos de prévia, não destinado à conciliação real (F3–F5).
- [x] Consultas + recorrência — F3 (cartão das consultas) em simulação na prévia admin + ajustes F2.
- [ ] Consultas + recorrência — teste real do cartão das consultas (máx. R$ 1,00) aguarda pedido do dono; F4–F5 aguardam aprovação.
- [x] Prévia /planos: escolha Continuar/Começar nova simulação, Alterar após aceite sem beco (volta ao Passo 6), simulação das consultas reiniciada a cada novo aceite. Conferência visual aguarda sessão admin.
- [x] Go-live venda de planos: site vende só plano, consultas via equipe (WhatsApp 555135199451), servidor recusa consultas (migração 0140, rollback em scripts/proposta-sem-consultas.rollback.sql), simulação F2/F3 dormente; F3–F5 pausadas
- [ ] Compra real de teste de baixo valor (Pix, cartão 3x, Start recorrência) aguarda autorização do dono

## /planos visual claro + parcelas no pagamento
- [x] Visual claro só no /planos (marca #E73C3E, Cool Grey #B1B3B3, Archivo), portais incluídos, capturas antes/depois
- [ ] Parcelas escolhidas no pagamento: migração + script de volta mostrados (aguarda aprovação para aplicar/publicar planos-checkout)

- [x] Festa 10 anos (/10anos): página, formulário, contador, tela da equipe e PIX Inter.
- [ ] Festa 10 anos: primeiro PIX real (aguarda teste do dono) e fotos da linha do tempo.
- [ ] Plano 1 (encargos por atraso) e Plano 2 (Pix Automático no /planos): aguardam aprovação do dono.
- [x] Portal: barra inferior Início/Treinos/Agenda/Clube/Evolução (item ativo com filete vermelho), avatar do topo com título "Perfil", cabeçalho SUA CONTA/PERFIL no Perfil e título "Evolução" nas avaliações; visual conferido em 393px.
- [x] Portal 5-3-1: treino selecionado organizado em Blocos 1 (Levantamentos básicos), 2 (Acessórios) e 3 (Auxiliares), cada um com cabeçalho de rótulo e filete; Aquecimento segue antes e sem número; Bloco 2 some na semana 4.

- [x] Vendas manuais 2027 recorrentes no cron novo: Power/Pro 2..12, Start mês a mês (só o próximo ciclo); ensaio NICOLAS TESTE desfeito; Larissa com mensalidade 2 em 20/11 (R$ 403).
- [ ] Rótulo "Cancelamento agendado" no histórico de vendas para Start com renovação automática: propor troca por "Renova em" (aguarda aprovação).

- [x] Pressão de disco: índices duplicados do audit_log removidos; limpeza 7 dias às 05:00 UTC criada. Item 4 NÃO aprovado.
- [x] Plano 2 P1 (Pix Automático): meio pix_automatico no cronograma (migração 0189, volta em scripts/pix-automatico-p1.rollback.sql) e 3 liberações desligadas/pausadas; ensaio desfeito.
- [x] Segurança: aviso do banco (pix-webhook) agora grava o aviso bruto mascarado; republicado.
- [x] Plano 2 P2a aplicada (migração 0190; volta em scripts/pix-automatico-p2.rollback.sql); ensaio desfeito ok.
- [x] P2a: desempate da tela de estado pelo número do código (migração 0191). Código P2, P3–P8 não autorizados. Mudança no gatilho da mensalidade e nas funções do cartão movida para a P4.
- [ ] Plano 2 P2–P8: não autorizados (aguardam o dono). Decisões já tomadas para elas:
  - Cancelar a autorização do Pix Automático = multa de cancelamento do contrato, como no cartão; admins recebem notificação para contatar o cliente (P5).
  - Suspensão, multa 2%/juros 1% a.m. e multa 25/20/15%: iguais ao cartão, sem mudança.
  - Checkout exige caixa de consentimento do débito automático (texto revisado pelo advogado no fim; sem prazo extra no contrato para "sem autorização").
  - P2/P4: funções de cobrança do cartão e o gatilho fn_mensalidade_2027_validar (hoje exige token do aluno) devem ignorar meio pix_automatico antes da 1ª linha Pix.

## Consultoria Online (venda interna 2027)
- [x] Portal: botão "Entrar com Microsoft" removido e login Microsoft desligado.
- [x] E1 banco aditivo (migração 0195; volta em scripts/consultoria-online-e1.rollback.sql): família consultoria_2027, atividade consultoria_online, modalidade pacote, 3 itens desligados (Mensal 189, 4 meses 676, 6 meses 894; duração/máx. parcelas em periodo_meses), fn_aluno_somente_online. Ensaio desfeito ok.
- [ ] E2–E6 não autorizadas. Decisões do dono: desconto permitido (Mensal igual ao Start); Mensal = regra do Start (sem taxa/fidelidade, cancelamento do Start); 4/6 meses até 4x/6x ou Pix, sem renovação, plano encerra na data final sem aviso; sem contrato, sem multa, sem comissão; Clube Bronze sem pontos de presença; app esconde só a Agenda; equipe pode agendar avaliação; Pix Automático fora.
- [ ] Para E3: planos_atividade_check (planos) e contratos_plano_tipo_check não aceitam consultoria; fn_planos_validar_tipo exige nome do catálogo na mesma atividade.
- [x] E2 cálculo: calcularVenda2027 com modalidade "pacote" (1..periodo_meses parcelas ou Pix, sobra na última) e Mensal da Consultoria no caminho do Start; testes em src/test/consultoria2027.test.ts; testes antigos sem alteração. E3–E6 não autorizadas.
- [x] E3a regras de tabela (migração 0196; volta em scripts/consultoria-online-e3a.rollback.sql): planos aceita atividade consultoria_online; contratos aceita plano_tipo consultoria_2027 e vigência quadrimestral. Ensaio desfeito ok. Decisões: 4 meses = quadrimestral; Clube resgata com custo padrão; carteira ativa conta pelo presencial (E3d); Mensal aceita serviços à parte como o Start.
- [x] E3b venda no servidor (migração 0197; volta em scripts/consultoria-online-e3b.rollback.sql, recusa se houver venda de Consultoria). Start/Power/Pro com impressão digital idêntica antes/depois; Consultoria: mensal/quadrimestral/semestral, sem crédito de Treino, não encerra presencial. Itens seguem desligados.
- [x] E3c renovação do Mensal da Consultoria (migração 0198 + renovar-planos-mensais lista start_2027 e consultoria_2027; volta em scripts/consultoria-online-e3c.rollback.sql e voltando a linha 282 para .eq start_2027). Start/Power/Pro idênticos; aviso da Consultoria sem frase de créditos.
- [x] E4a (conferências só leitura, 23/10/2026): NICOLAS TESTE na lista de teste; servidor libera item inativo só para aluno de teste; rescisão do Mensal sem multa, do pacote com retenção de 25% e base fixa de 12 meses (corrigir no banco antes da E6); Pix à vista = cobrança pendente com baixa manual; varredura de telas feita.
- Decisões do dono para E4: chip Consultoria só para aluno de teste até a E6; pacote no cartão com padrão N parcelas; "livre" do aviso: ajuste na tela agora, banco junto com a E3d.
- [x] E4b (rótulos/mapas de vigência nas telas, 23/10/2026): "Consultoria Online" e "4 meses"; planos antigos com texto idêntico.
- [x] E4c (formulário de venda da Consultoria + venda sem contrato, 23/10/2026): chip só para aluno de teste/item liberado, Duração, formas por duração, serviços bloqueados no pacote, resumo, sem documento, selo "Sem documento de contrato".
- [x] E4d parcial (23/10/2026, sem rescisão): Alterar tipo de cobrança bloqueado para Consultoria; "Consultoria Online livre" exibido como "Consultoria Online" nas notificações (só exibição); campo de encerrar plano da Consultoria com texto próprio e padrão desmarcado.
- [x] E5a (23/10/2026, só tela): app esconde Agenda (menu, /portal/agenda → Treinos, botões da Home e de avaliação) só quando fn_aluno_somente_online = true confirmado; carregando/erro = comportamento atual.
- [x] E5b-prep (23/10/2026, nada aplicado): scripts/consultoria-online-e5b.{antes,proposta,proposta-corpo,rollback,ensaio}.sql e .diff. Proposta A = recusa 'somente_online' em fn_agendar_treino e fn_agendar_servico(uuid,date). Propostas separadas: B (INSERT direto do aluno em treino_agendamentos via RLS) e C (fn_agendar_servico de 5 argumentos sem checagem de quem chama, executável por anon).
- [ ] E5c (só descrita): app traduz erro 'somente_online' em mensagem "Seu plano é Consultoria Online; agendamentos são feitos pela equipe" e esconde a ação; sem código ainda.
- [x] E5b-A aplicada (migração 0199, 23/10/2026): fn_agendar_treino e fn_agendar_servico(uuid,date) recusam 'somente_online'; ensaio em scripts/consultoria-online-e5b.ensaio-resultado.txt; volta em scripts/consultoria-online-e5b.rollback.sql.
- [x] E5b-B e E5b-C preparadas, não aplicadas: scripts/consultoria-online-e5b-B.* e -C.* (antes/proposta/rollback/diff/ensaio).
- [x] E4f (23/10/2026, só tela + testes): rescisão da Consultoria vira aviso ao admin. DialogRescisao, RescisaoDialog e PortalPlano não chamam fn_calcular_rescisao nem executam cancelamento para consultoria_2027; mostram "Rescisão da Consultoria Online é tratada pelo administrador" + botão "Avisar o administrador", que usa o fluxo de Notificar existente (createNotificacao → fn_notificar_criar_notificacao, liberada para autenticados, destino all_admins/all_coordenadores) com aluno, plano, vigência, valor, forma, motivo e quem pediu. Helper em src/lib/rescisaoConsultoria.ts; testes em src/test/e4fRescisaoConsultoria.test.tsx (6 testes: Consultoria sem cálculo nem execução + aviso com dados certos; Start/Power/Pro inalterados). Sem mudança de banco/edge.
- [ ] Correção de fn_calcular_rescisao no banco NÃO feita, por decisão do dono: a Consultoria nunca usa essa função (rescisão é manual pelo admin). Risco registrado: se alguém chamar fn_calcular_rescisao para um contrato consultoria_2027 por outro caminho (SQL direto, relatório futuro), a função ainda retém 25% e usa base de 12 meses — valores que NÃO valem para a Consultoria.
- [ ] Não autorizadas: aplicar B e C (e rodar seus ensaios), E5c, E4e, E3d e E6.

## E6 — Consultoria Online ligada (2026-10-23) — FEITA
- 3 itens consultoria_2027 (Mensal 189; 4m 676; 6m 894) com ativo=true; legado "Consultoria Online - 6 meses" (774) e demais 68 itens intactos (md5 igual).
- Venda liberada para alunos reais na equipe (Nova Venda); /planos não mostra Consultoria.
- Rollback: scripts/consultoria-online-e6.rollback.sql
- Seguem não autorizadas: E5b-B, E5b-C, E5c, E3d, E4e.
- [x] Disparos etapa 5: trava real_liberado liberada (0209); envio depende do clique do dono, máx. 50 por clique; presos >10 min viram falhou.

## Cliente desde (alunos.aluno_desde)
- [x] Coluna nullable (migração 0210), rollback `scripts/alunos-aluno-desde.rollback.sql`
- [x] Resumo do aluno + Trajetória com fallback; lápis edita `aluno_desde` sempre (com ou sem plano); data efetiva = a mais antiga entre plano e manual
- [x] Filtro "Cliente desde (de/até)" na lista de alunos
- [ ] Carga dos valores da planilha (aguardando dono; fora desta tarefa)

- [x] Site público — Etapa 1: base em /site (layout isolado, cabeçalho, rodapé, WhatsApp, páginas esqueleto).
- [x] Site público — Etapa 2: home completa em /site.
- [ ] Site público — Etapas 3–9 (serviços, experimental, troca da raiz com painel em /equipe, moldura planos/store/corrida, rastreamento+LGPD, SEO, redirecionamentos) — cada uma aguarda aprovação.

## Lote 4 — Comunidade (clubes de alunos)
- [x] Tabelas `comunidade_clubes`/`comunidade_clube_membros` (0217), RLS, limites (1 pendente, 2 ativos, nomes Fortem/Oficial só equipe), ranking por dias de treino no mês, entrar/sair/criar/moderar.
- [x] 3 clubes oficiais: Ratinhas da Fortem, Frangos da Fortem (funcional), Corredores Fortem (corrida).
- [x] Portal `/portal/comunidade` (no lugar de Benefícios na barra inferior), aba Clubes no Progresso, aba Clubes no gestor com aviso push ao aluno.
- [ ] Feed e Ranking da Comunidade (próximo lote).
- [x] Comunidade: capa dos clubes (migração 0218, bucket privado comunidade-clubes com links temporários porque o workspace bloqueia buckets públicos; descrição até 120; capa enviada pelo aluno em {aluno_id}/, pela equipe em equipe/).
- [x] Comunidade: capas cobrindo o card inteiro (object-cover, object-position center, altura mínima 140px) em Meus clubes, Explorar e cabeçalho do detalhe; degradê reforçado (#0e0e0e 0,92 na base → 0,35 no topo + lateral 0,75 até 70%) e sombra leve no texto. Só front-end, sem migração.
- [x] Ajuste fino das fotos do site (Fotos do site, /equipe/site/fotos)
- [x] Portal: pergunta "Compartilhar treino?" ligada às conclusões de todos os métodos (componente único PerguntaCompartilharTreino).
- [x] Clube Parte 0: fontes conferidas (treinos = treino_agendamentos realizado; nutrição/reabilitação = agenda_presencas comparecimento; avaliações = avaliacoes funcional/funcional_v2). Recovery sem registro de sessões realizadas: conquistas de Recovery não criadas.
- [x] Clube Parte 1: "Evolução Real" desativada (quem já ganhou mantém).
- [x] Clube Parte 2: 15 conquistas novas com concessão automática e idempotente; carga inicial sem pontos (corte em clube_config.conquistas_bonus_desde).
- [x] Clube Parte 3: pontos_bonus por conquista (sem multiplicador; agregador x mult_agregador para cima), editável na aba Conquistas do gestor.
- [x] Clube Parte 4: limite_mensal por recompensa, bloqueio em fn_clube_resgatar (mês de Brasília) e botão "Disponível novamente em".
- [x] Clube Parte 5: cards "Como funcionam os pontos" e "Como ganhar conquistas" com valores do banco.
- [x] Clube Parte 6: ranking único por dias de treino no mês (fn_comunidade_ranking_geral), aba Ranking na Comunidade e resumo em Benefícios.
- [x] Clube: Mês Completo concedida automaticamente (todas as semanas ISO completas do mês com treino realizado; semanas parciais ignoradas; Consultoria fora), carga inicial sem pontos.
- [ ] Recovery (pendente até a equipe marcar presença realizada nas sessões de bota): criar Primeira Sessão de Recovery (1, bônus 10), Recovery Regular (10, bônus 30) e Recovery Frequente (25, bônus 60), e incluir Recovery em Fortem Completo (treino + nutrição + reabilitação ou Recovery no mesmo ano).
- [x] Indicação Parte 0: mapeamento de leads/prospects, vendas pagas/estornadas, plano FORTEM x agregador/Corrida e notificações do portal.
- [x] Indicação Parte 1: clube_indicacoes evoluída (origem, venda, validade 90 dias, status pendente/convertida/recusada/expirada), indicador único por prospect, código próprio por aluno e expiração diária.
- [x] Indicação Parte 2: conversão automática na 1ª venda FORTEM paga (100/50 pontos, agregador 0,5x, indicador inativo sem pontos, teto 10/ano, estorno em 30 dias, Embaixador e desafio só convertidas válidas, corte indicacoes_pontos_desde).
- [ ] Indicação Etapa 2: telas (equipe registra indicador, portal mostra código e indicações).
- [x] Indicação etapa 2 · Parte 0: convertem todos os planos pagos exceto agregador (Wellhub/Gympass/TotalPass); indicador ativo = qualquer plano vigente; só Corrida pontua como Start (Corrida - Power/Pro seguem o nome).
- [x] Indicação etapa 2 · Parte 1: campo "Indicado por" nos cadastros de lead/prospect/aluno/dados comerciais; "Indicado por" em cards, listas e perfil; seção Indicações no perfil do indicador.
- [x] Indicação etapa 2 · Parte 2: portal Benefícios com INDIQUE UM AMIGO, MINHAS INDICAÇÕES e regras vindas do banco; push ao indicador na conversão.
- [x] Indicação etapa 2 · Parte 3: /experimental guarda ?ind= por 90 dias e inclui o código na mensagem do WhatsApp; sem formulário público (não existe).
- [x] Indicação etapa 2 · Parte 4: aba Indicações no Clube (filtros, recusar/reverter/corrigir, sem indicador, KPIs, conversão por indicador).
- Portal Agenda P1: Avaliação Física removida dos serviços do portal (feito; sem agendamentos de alunos).
- Portal Agenda P2: Recovery mensal Pro/VIP/Corrida (4 por ciclo, rotina diária 07:15 UTC, liberação inicial feita para 22 alunos) (feito).
- Portal Agenda P3: aba Serviços no padrão dos treinos (cartões, dias, grade Manhã/Tarde/Noite, folha de confirmação) (feito; sem teste com aluno logado).
- Portal Agenda P4: compra avulsa "Recovery - 1 sessão" (R$ 50, catálogo) pelo portal com PIX e cartão em /pagamento/:token; crédito só após pago, uma vez por venda, retirado se não usado no estorno (feito; pagamento real ainda não testado).
- [x] Compra avulsa de Recovery: horário confirmado sozinho após o pagamento (guardado 2 h no navegador, via fn_agendar_servico) e e-mail sem contrato/menção à Corrida para origem portal_avulso.
- [x] Devolver PIX pela venda (compra avulsa de Recovery do portal) no Histórico de Vendas: só admin, mesma devolução Inter, crédito retirado só se não usado.

## Nova Venda sem "Planos atuais"
- [x] R0 (leitura) — reprovado em 09/11/2026: Gympass/Wellhub, Total Pass e VIP só existem no fluxo atual (71 vendas em 30 dias) e Start legado teve 12 vendas. Aguarda decisão do dono.
- [x] R0 aceito pelo dono (09/11/2026): Gympass/Wellhub, Total Pass e VIP ficam na aba Planos com o fluxo atual intacto.
- [x] R1 tela — abas Planos/Serviços sem seletor "Planos atuais/2027"; Planos = Start, Power, Pro, Consultoria Online (fluxo 2027 sem serviços/pacotes) + Corrida, Gympass/Wellhub, Total Pass, VIP (fluxo atual intacto); itens legados restantes escondidos só na tela (`NOVA_VENDA_R1` em `src/lib/novaVendaAbas.ts` reverte). Testes em `src/test/novaVendaAbas.test.ts`.
- [ ] R2 catálogo (encerrar pacotes 2027) — não autorizado.
- [ ] R3 — não autorizado.
- [ ] Remover o código do fluxo antigo — não autorizado.
- [x] `src/test/portalAgendaE5a.test.tsx`: listas esperadas atualizadas (Benefícios → Comunidade, mudança do LOTE 4); app inalterado.
- [ ] R2 catálogo (encerrar pacotes 2027) — não autorizado.

## Parcelamento no link /pagamento/<token>
Decisões: admin define máximo, cliente escolhe 1x..máximo (opção fixas trava); sem juros; sem parcela mínima; serviços avulsos só 1x; venda recorrente sem parcelamento; mostrar valor de cada parcela.
- [x] P0 leitura — contrato Corrida parcelado cita "em até %PARCELAS% parcelas"; parcelas legadas = `contratos.parcelas` + N `cobrancas` em `fn_criar_contrato_tradicional`; Rede tem sandbox via `REDE_AMBIENTE`.
- [x] P1 banco — `links_pagamento.parcelas_max` (1–12, nulo) e `parcelas_fixas` (nulo); scripts `scripts/pagamento-link-parcelas-p1.*`; links existentes idênticos.
- [ ] P2 funções criar/validar/cobrar-link-pagamento — não autorizado.
- [ ] P3 telas — não autorizado.
- [ ] P4 teste real — não autorizado.
- [x] 2C-2: aplicar correções de lint 1–32 (src) + ignore mcp no eslint

## Pix Automático contratos atuais + 2027 — Etapa 1
- [x] Passo 1: regras do BCB conferidas (envio 2–10 dias antes, máximo do pagador, 3 retentativas em 7 dias, cancelamento) e Corrida adicional sem contrato investigada.
- [x] Passo 2: grupos e itens de Pix Automático com trava de item único, reserva na cobrança/venda e permissões (admin cria/cancela, coordenador lê, aluno vê o seu).
- [x] Passo 3: tela da equipe para escolher itens, soma, dia do débito, valor máximo +15%, código/QR (até 3) e mensagem para WhatsApp.
- [x] Passo 4: nenhuma cobrança Pix criada nesta etapa.
- [x] Etapa 2: cobrança mensal D-7 (tentativas até D-3), baixa dividida, reserva contra cartão/baixa manual, renovação 8 dias antes e troca de itens; real só Enio a partir de 05/12 (migrações 0254–0256).
- [ ] Etapa 3: voltar ao cartão.
- [ ] Etapa 4: app do aluno (alterar forma de pagamento, aviso na tela inicial, push).
