# Roadmap

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
- [ ] E3b, E3c, E3d, E4–E6 não autorizadas. Para E4: telas que traduzem vigência (ContratoFinanceiro, CardContrato, RescisaoDialog, contratoValores, AlterarTipoCobrancaDialog, contratos-calc) e tipos PlanoTipo/PLANOS_ORDEM não conhecem quadrimestral/consultoria_2027.
