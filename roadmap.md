# Roadmap

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
