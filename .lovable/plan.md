# Congelar a cobrança automática no cartão + ação "Estornar"

## O que a investigação confirmou

- A rotina automática é a função `cobrar-recorrencias-diario`, chamada pelo agendamento `cobrar-recorrencias-diario` (jobid 28, 04:00 UTC). Confirmei no banco: **o agendamento está desativado** (`active = false`). Nada mais o reativa sozinho.
- Hoje a função aceita ser chamada por três caminhos: segredo do agendamento (`x-webhook-secret`), chave de serviço e admin logado. Nenhum deles tem trava — se qualquer um chamar, ela cobra.
- Já existe um fluxo de estorno na Rede pronto e em uso: a função **`rede-cancelar`** (`POST /transactions/{tid}/refunds`, códigos de sucesso 00/359/360, só admin). O registro de R$ 10,00 marcado como `refunded` em 12/08 veio desse caminho. **Vamos reaproveitá-la**, sem criar outra integração. Existe também `loja-estornar-pedido`, mas é específica de pedidos da Loja (cartão e PIX) — serve de modelo de resposta de erro, não de destino.
- Ambiente da Rede: o valor de `REDE_AMBIENTE` está guardado como segredo e não pode ser lido por aqui. As cobranças do Rafaela/Leonardo foram aprovadas com dinheiro real, o que indica **produção**. Confirmação do valor exato é parte da Fase 0 (checagem que só imprime "sandbox"/"producao", nunca credenciais).

## Todos os caminhos que podem cobrar cartão automaticamente

| Caminho | Dispara sozinho? | Situação |
|---|---|---|
| `cobrar-recorrencias-diario` (agendamento 04:00 UTC) | Sim | Agendamento desativado; ganha a trava |
| `cobrar-recorrencias-diario` chamada manual (admin / chave de serviço) | Sim | Sem trava hoje — **este é o furo** |
| Retentativas internas dela (`proxima_tentativa_em`, até 3) | Sim, dentro da própria execução | Some junto com a trava |
| `renovar-planos-mensais` (agendamento 03:00 UTC) | Não cobra cartão | Só gera plano/venda/cobrança |
| `processar-cobrancas-diario` (07:00 UTC) | Não cobra | Marca atraso e cria inadimplência |
| `rede-cobrar-token` | Não | Só se alguém chamar, com `venda_id` |
| `cobrar-link-pagamento` | Não | Só com link de pagamento aberto pelo aluno |
| `rede-cobrar-cartao` (botão "Cobrar no cartão") | Não | Ação manual com dados digitados |
| `loja-cobrar-pedido` / `corrida-cobrar-pedido` | Não | Compra iniciada pelo cliente |

A trava cobre a recorrência (pedido 1). As cobranças manuais e de loja/corrida continuam funcionando.

---

## Fase 1 — Trava global da recorrência

**Nova tabela `sistema_config`** (chave/valor), já que não existe tabela de configuração genérica:

```sql
CREATE TABLE public.sistema_config (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.sistema_config TO authenticated;
GRANT ALL ON public.sistema_config TO service_role;
ALTER TABLE public.sistema_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff lê config" ON public.sistema_config FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin altera config" ON public.sistema_config FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.sistema_config (chave, valor, descricao)
VALUES ('cobranca_recorrente_ativa', 'false'::jsonb, 'Trava global da cobrança automática no cartão. Padrão: pausada.');
```

Gatilho de auditoria `fn_audit_log` na tabela, para registrar quem ligou/desligou.

**Alteração em `supabase/functions/cobrar-recorrencias-diario/index.ts`:** logo após autorizar e **antes** de buscar cobranças, ler `sistema_config.cobranca_recorrente_ativa`. Se for diferente de `true` — ou se a leitura falhar, ou a linha não existir — registrar em `system_logs` e responder `{ ok: true, pausado: true, elegiveis: 0 }` sem tocar na Rede. Falha fechada: na dúvida, não cobra. Vale para qualquer chamador, inclusive chave de serviço.

**Frontend:**
- `src/hooks/useSistemaConfig.ts` — leitura + mutação da chave.
- Faixa de aviso em Admin > Integrações e no topo da tela de Auditoria quando estiver pausada: "Cobrança automática no cartão PAUSADA — nenhuma mensalidade é cobrada automaticamente."
- Cartão "Cobrança automática no cartão" em Admin > Integrações, visível para staff, com interruptor só para admin. Ao ligar: diálogo com texto do impacto + campo onde o admin digita **LIGAR COBRANÇA** para confirmar. Desligar é imediato.
- Mesmo ligando a trava, o agendamento continua desativado no banco — religar o agendamento é ato separado e manual, feito por você.

## Como evitar cobrança retroativa ao religar (descrição, não implementação)

Quando chegar a hora, a regra a implementar antes de reativar: a função só considera cobranças com vencimento dentro de uma janela curta (ex.: `data_vencimento >= data_de_religamento` ou até N dias de atraso, N definido por você), gravada como uma segunda chave em `sistema_config` (`cobranca_recorrente_vencimento_minimo`). Tudo mais antigo fica como pendência para tratamento manual. Recomendo ainda um modo "simulação" (lista o que cobraria, sem cobrar) para a primeira execução após religar.

---

## Fase 2 — Ação "Estornar cobrança" (aprovada em desenho, NÃO implementada)

Decisões já fechadas por você:
1. A venda vinculada vira `estornado` junto com a cobrança. A cobrança `estornado` continua mostrando "Dar baixa" (registro manual de recebimento), nunca é reprocessada pela cobrança automática e nunca gera inadimplência.
2. Comissionamento: fora do escopo — nada de comissão é tocado.
3. Créditos do contrato: não são retirados nem alterados no estorno.
4. Estorno **total ou parcial**.
5. Comprovante de estorno obrigatório.

**Onde:** `src/components/financeiro/TimelineCobrancas.tsx`, aba Contrato & Pagamentos. Botão "Estornar" só para admin, quando `status = 'pago'` (ou já parcialmente estornada), `gateway = 'rede'` e existe `tid`.

**Backend:** nova função `estornar-cobranca`, reaproveitando o miolo de refund que já existe em `rede-cancelar` (extraído para `_shared/rede-refund.ts`, comportamento idêntico: `POST /transactions/{tid}/refunds` com `amount` em centavos, sucesso em `00`/`359`/`360`).

### Estorno parcial — como fica

A API da Rede recebe o valor no corpo do refund, o que permite devolver menos que o total; vários refunds parciais sobre o mesmo TID são aceitos até somar o valor capturado. Antes de implementar, confirmo esse comportamento no ambiente de homologação (ou com um refund mínimo, se você autorizar), e o código trata recusa por "valor acima do disponível" como erro legível.

Controle do saldo:
- `saldo_estornavel = valor_pago − soma dos refunds já confirmados para o TID`.
- Validação no servidor, dentro de transação com `SELECT ... FOR UPDATE` na cobrança: valor > 0 e ≤ saldo. Nunca é possível estornar mais que o valor pago.
- Em vez do índice único por TID (que bloquearia parciais legítimos), a proteção passa a ser: trava de linha + chave de idempotência por requisição (`idempotency_key` uuid gerado no diálogo, com índice único em `pagamentos_rede`), impedindo que o duplo clique gere dois refunds.

Status da cobrança:
- Soma dos estornos < valor pago → status continua `pago`, com marcação "Estorno parcial R$ X de R$ Y" na linha (badge âmbar) a partir dos registros de `pagamentos_rede`; nenhum status novo é inventado.
- Soma = valor pago → cobrança vira `estornado` e a venda vinculada também.

**Migração de status:** ampliar o `CHECK` de `cobrancas.status` para incluir `'estornado'`.

### Comprovante de estorno

Cada refund confirmado gera um comprovante com: aluno, ciclo, valor estornado, valor original da cobrança, TID, NSU, código e mensagem de retorno da Rede, data/hora, motivo e nome do admin que executou. Abre em diálogo logo após o estorno, com botões "Baixar PDF" e "Imprimir", e pode ser reaberto pela linha da cobrança e pelo histórico de pagamentos. Visual Fortem (mesma base de PDF já usada nos relatórios). Os dados vêm de `pagamentos_rede` + `audit_log`, sem tabela nova.

### Efeitos colaterais mapeados

| Área | Tratamento |
|---|---|
| Inadimplência (`processar-cobrancas-diario`) | Só age sobre `pendente`; `estornado` fica de fora |
| Inadimplência já fechada | Permanece regularizada; o estorno não reabre |
| Nova tentativa automática | A recorrência filtra `pendente`/`atrasado` — `estornado` nunca volta |
| Venda vinculada | Marcada como `estornado` no mesmo fluxo |
| "Dar baixa" manual | Habilitada também no status `estornado` |
| Créditos | Intocados |
| Relatórios / dashboards | Rótulo "Estornado" e exclusão do faturamento |
| Fiscal de pagamentos | Ajustar checagens para ignorar `estornado` |

### Mockup do diálogo

```text
┌── Estornar cobrança ───────────────────────────────┐
│ Atenção: devolve dinheiro real ao aluno.           │
│                                                    │
│ Aluno .......... Leonardo Zimmer Saldanha          │
│ Ciclo .......... 11                                │
│ Pago ........... R$ 559,00 em 19/09/2026           │
│ Já estornado ... R$ 0,00                           │
│ Disponível ..... R$ 559,00                         │
│ TID ............ 10012345678901234567              │
│                                                    │
│ Tipo: ( • ) Total     (   ) Parcial                │
│ Valor a estornar: [ R$ 559,00 ]  (trava no saldo)  │
│                                                    │
│ Motivo (obrigatório, mín. 10 caracteres)           │
│ ┌────────────────────────────────────────────────┐ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│              [ Cancelar ]  [ Confirmar estorno ]   │
└────────────────────────────────────────────────────┘
```

Após a confirmação da Rede, abre o comprovante. Se a Rede recusar: nada muda no banco e o motivo aparece na tela.

---

## Arquivos e objetos da Fase 2

Código: nova `supabase/functions/estornar-cobranca/index.ts`; novo `supabase/functions/_shared/rede-refund.ts`; `src/components/financeiro/TimelineCobrancas.tsx`; novos `EstornarCobrancaDialog.tsx` e `ComprovanteEstorno.tsx` (+ export PDF); `src/hooks/useContratos.ts`; `src/types/financeiro.ts`; rótulos nos relatórios financeiros.

Banco: `CHECK` de `cobrancas.status` com `estornado`; coluna `idempotency_key` + índice único em `pagamentos_rede`; revisão de `fn_auditoria_fiscal_pagamentos`.

## Riscos e pontos em aberto

1. Confirmar com a Rede (homologação) o suporte a refunds parciais múltiplos sobre o mesmo TID.
2. Ampliar o `CHECK` de status é migração aditiva em tabela financeira viva — nenhuma linha é alterada.
3. Ambiente é **produção**: o único teste com dinheiro real seria o estorno que você já quer fazer.
4. Os casos já cobrados (Rafaela, Leonardo x2) só serão estornados quando você mandar, um a um.

## Ordem de execução

- **Fase 0 — concluída.** Ambiente da Rede: **produção**.
- **Fase 1 — concluída.** Trava global + aviso e interruptor.
- **Fase 2 — aguardando sua confirmação.** Estorno total/parcial + comprovante.
- **Fase 3** — auditoria fiscal e relatórios com o novo status.
- **Fase 4 (futuro)** — janela de vencimento e modo simulação antes de religar o agendamento.

## Como testar sem gastar dinheiro real

- Fase 1 (trava): testada sem nenhuma cobrança — chamada manual da rotina retornou "pausado" e ficou registrada em `system_logs`. Zero contato com a Rede.
- Fase 2 (estorno): em produção, o único teste com dinheiro real seria o próprio estorno que você já quer fazer. Caminhos de erro (sem TID, cobrança não paga, duplo clique, valor acima do saldo) testo sem chamar a Rede.
