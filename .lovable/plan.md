# Ativação das vendas 2027 do /planos no fluxo normal do aluno

## O que existe hoje (verificado)

**Venda normal (balcão, perfil do aluno)**
- Tela: `VendaDialog.tsx`. Grava em `vendas`; o gatilho `fn_processar_venda` cria `planos` + `creditos_aluno`; contratos saem de `fn_criar_contrato_tradicional` / `fn_criar_contrato_recorrencia` (cobranças em `cobrancas`, parcelas em `pagamentos`/`pagamento_parcelas`).
- Gatilhos em cadeia: `fn_sync_venda_to_cobranca`, `fn_sync_cobranca_to_venda`, `fn_notificar_venda_paga`, comissão (`trg_comissao_venda_paga`), Clube, pipeline, renovação (`fn_auto_criar_contrato_ciclo`).
- Receitas/relatórios não têm gatilho que grava em `receitas`: leem `vendas`/`cobrancas` (nenhuma função faz insert em `receitas`).
- Cartão aprovado no balcão: `_shared/venda-pos-aprovacao.ts`.

**Venda 2027 de balcão já existe**: `fn_venda_2027_criar(p)` (admin/coord/professor) cria venda, plano, contrato, créditos e cobranças dos planos 2027 com idempotência (`idempotency_key`) e marca de teste (`origem='teste_2027'` para alunos da lista de teste). `fn_processar_venda` já pula itens 2027 para não duplicar. Start: `fn_renovar_start_2027` e `fn_creditos_mensais_2027` (no cron `renovar-planos-mensais`).

**/planos hoje**: proposta em `propostas_planos_2027`, aceite em `propostas_2027_aceites`, tentativas em `checkout_2027_tentativas`, mensalidades em `planos_2027_mensalidades`, espelho em `pagamentos_rede`. `aluno_id` da proposta só existe quando o cadastro foi identificado; nada é criado em `vendas`/`planos`/`contratos`/`creditos_aluno`. Não há função de ativação.

**Estorno**: `estornar-cobranca` exige `cobranca_id` (saldo por `fn_cobranca_saldo_estornavel`, reserva `fn_estorno_reservar`, Rede). `rede-cancelar` exige `venda_id`+`tid`. Pix devolução só existe em `loja-estornar-pedido` (Inter). Linhas do /planos não têm cobrança nem venda, por isso nada as estorna hoje.

**Propostas**: aba dentro de Leads (`Leads.tsx`, `PropostasSite2027.tsx`). Menu Financeiro em `AppSidebar.tsx` (coord/admin).

**E-mail**: `decidirEnvio` só bloqueia proposta de teste (`teste_admin=true`) para e-mails fora do NICOLAS TESTE. Proposta real já envia ao comprador quando `planos_email_confirmacao_ativo=true`. O que falta é o envio do **contrato** (PDF/link) ao aluno — hoje só sai o comprovante.

**Dados atuais**: 48 propostas; 29 não-teste, todas `nova`, nenhuma paga. Zero mensalidades pendentes.

## Ideia central

Uma única função de ativação no banco, `fn_checkout_2027_ativar(proposta_id)`, chamada uma vez após a baixa (Pix ou cartão 1ª cobrança aprovada), que **reaproveita o miolo de `fn_venda_2027_criar`** (mesmo cálculo e mesmas tabelas da venda de balcão) com `idempotency_key = 'planos:'||proposta_id`. Assim a venda do site fica igual à de balcão: perfil, Planos/Serviços, Pagamentos, relatórios, comissão, Clube.

```text
baixa (Pix webhook / cartão aprovado / recorrência 1ª)
  -> fn_checkout_2027_pos_pagamento (já existe)
  -> fn_checkout_2027_ativar  (novo, idempotente)
       vincular/criar aluno -> venda 2027 -> plano + contrato + créditos
       -> cobranças pagas/futuras -> documento do contrato
       -> liga proposta.venda_id / contrato_id / mensalidades.cobranca_id
```

## Fases

**A — Vínculo do aluno + contrato + créditos**
- Vínculo: aluno já ligado na proposta (código de e-mail validado) usa esse; senão busca por `cpf_hash`; senão cria aluno novo com os dados do contrato. Ex-aluno reativa o mesmo cadastro (status volta a ativo pelo fluxo existente). Nunca casar por nome/telefone sozinho.
- Extrair o miolo de `fn_venda_2027_criar` para função interna `fn_venda_2027_gravar(p, origem)` sem checagem de papel; a versão de balcão passa a chamá-la (comportamento idêntico, coberto por teste).
- Origem `site_2027` (real) ou `teste_2027` (proposta `teste_admin` ou aluno de teste).
- Documento do contrato: gravar em `contratos_documentos` a partir do aceite (`propostas_2027_aceites`: hash, IP, versão) — sem pedir novo aceite.
- Datas: início = data da venda; fim e renovação pelas regras 2027 já usadas no balcão. Créditos liberados na ativação (Power/Pro); Start segue `fn_creditos_mensais_2027`.

**B — Pagamentos, mensalidades e receitas**
- Pix/cartão à vista ou parcelado: cobranças/parcelas marcadas como pagas com o meio (`inter_pix` ou `rede` + tid).
- Recorrência: cada linha de `planos_2027_mensalidades` ganha uma cobrança espelho em `cobrancas` (paga ou futura) ligada por `cobranca_id`. A cobrança mensal automática continua só em `planos-recorrencia-diario`; o espelho apenas reflete o resultado (paga/atrasada/cancelada). O cron antigo segue desligado e não enxerga essas cobranças (marcadas como origem site).
- Relatórios e Receitas passam a ver as vendas pelo caminho atual; vendas `teste_2027` ficam fora dos totais (conferir filtros existentes e acrescentar onde faltar).

**C — Estorno reaproveitando o atual**
- Com a cobrança espelho, `estornar-cobranca` e `EstornarCobrancaDialog` passam a funcionar para cartão (localiza tid via `pagamentos_rede` ligado à cobrança). Ajuste mínimo: `fn_cobranca_saldo_estornavel` aceitar o tid pela ligação `pagamentos_rede.mensalidade/proposta`.
- Pix: acrescentar ramo de devolução Pix (copiado de `loja-estornar-pedido`, mesma API Inter de cobrança) dentro de `estornar-cobranca`, só para cobranças de origem site. Estorno de mensalidade não cancela as demais; cancelamento continua separado.

**D — Menu Financeiro > Propostas de contratos**
- Nova página com o mesmo `PropostasSite2027` (cancelar assinatura, cobrar mensalidade de teste, status das mensalidades), item em `financeiroItems`. Aba em Leads removida (ou vira atalho — ver pergunta). Inclui link para o perfil do aluno após ativação.

**E — E-mails ao aluno**
- Comprovante já sai para propostas reais; manter a trava só em teste.
- Acrescentar envio do contrato assinado (link/arquivo do documento gerado na fase A) no mesmo e-mail de confirmação ou em e-mail próprio, uma vez por proposta.

## Duplicidade e segurança
- Ativação idempotente por proposta (`venda_id` na proposta + `idempotency_key` única em `vendas`); webhook e consulta reserva podem chamar à vontade.
- Uma cobrança espelho por mensalidade (índice único).
- Créditos: reaproveitam as chaves já idempotentes (origem_id, atividade, competência).
- Testes: origem `teste_2027`, nunca entram em receitas/comissão/Clube real.
- Falha na ativação nunca desfaz a baixa: registra em `system_logs` e gera aviso interno "ativação pendente" com botão "Ativar agora" na tela de Propostas.

## Quando ativar
Na confirmação do pagamento (Pix liquidado ou 1ª cobrança de cartão aprovada) — é o momento da "venda". Créditos liberados nesse instante. Proposta não paga não cria nada.

## Propostas existentes
Nenhuma real foi paga: nada a migrar. As de teste pagas (ex.: 21511e24, canceladas) ficam como estão; opcionalmente ativar uma em modo teste para validar a fase A.

## O que muda em produção
- Checkout público (Pix/cartão) ganha um passo após a baixa; falha não afeta o pagamento.
- Venda 2027 de balcão passa a usar a função extraída (mesmo resultado; teste de regressão antes).
- Nada muda na Loja, Corrida, rede-*, cron antigo, chaves de sistema.

## Riscos
- Gatilhos em `vendas`/`cobrancas` (comissão, notificar venda paga, sync venda↔cobrança) disparam também para vendas do site: conferir cada um em ensaio desfeito.
- Cobrança espelho não pode ser cobrada pelo fluxo antigo nem reagir a inadimplência legada sem querer.
- Vínculo errado de aluno: só por CPF verificado/ligação já validada.

## Perguntas ao dono
1. Comissão: vendas do site geram comissão para alguém? Recomendo: não (sem consultor), salvo se a proposta tiver consultor indicado.
2. Notificação "venda paga" interna: manter também para o site (além do aviso já existente)? Recomendo: um só aviso, o atual.
3. Aba Propostas em Leads: remover ou deixar atalho? Recomendo remover.
4. Contrato ao aluno: anexo PDF ou link para o portal? Recomendo link do portal + PDF em anexo se couber no Resend.
5. Estorno Pix do site: liberar já para coordenação ou só admin? Recomendo só admin (igual estorno atual).
6. Ativação automática ou com conferência manual nas primeiras semanas? Recomendo automática com aviso interno.

## Detalhes técnicos
- Novas funções: `fn_venda_2027_gravar` (interna), `fn_checkout_2027_ativar` (service_role), colunas `propostas_planos_2027.venda_id/contrato_id/ativada_em`, `planos_2027_mensalidades.cobranca_id`, índices únicos.
- Chamadas: `planos-checkout` (pós-pagamento) e `planos-recorrencia-diario` (atualizar espelho).
- Ensaios SQL em transação desfeita para cada fase; testes Vitest/Deno do cálculo e da idempotência.
- Ordem de execução: A → B → C → D → E, cada uma aprovada separadamente.
