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

## Fase 2 — Ação "Estornar cobrança"

**Onde:** `src/components/financeiro/TimelineCobrancas.tsx`, na aba Contrato & Pagamentos do aluno. Botão "Estornar" aparece só quando: usuário é admin, `status = 'pago'`, `gateway = 'rede'` e existe `tid`.

**Backend:** nova função `estornar-cobranca`, que valida, chama internamente a lógica de refund já existente em `rede-cancelar` (o miolo vira `_shared/rede-refund.ts`, sem mudar o comportamento atual dela) e só grava no banco depois do "ok" da Rede.

Sequência:
1. Exige admin (`is_admin`). Valida `cobranca_id` e `motivo` (mínimo 10 caracteres).
2. Trava de idempotência: `SELECT ... FOR UPDATE` na cobrança + recusa se já existir `pagamentos_rede` com status `refunded` para o mesmo `tid`; índice único parcial garante isso mesmo com clique duplo:
   `CREATE UNIQUE INDEX uniq_refund_por_tid ON public.pagamentos_rede (tid) WHERE status = 'refunded';`
3. Estorno **total** do valor da cobrança na Rede. Se recusar ou der erro de rede: **nada muda no banco**, retorna erro legível ("A operadora recusou o estorno: ...").
4. Confirmado: insere linha em `pagamentos_rede` (`status='refunded'`, `tid`, `amount`, `cobranca_id`, `created_by`, resposta bruta), atualiza a cobrança para `estornado` e grava no `audit_log` (quem, quando, motivo, TID, valor).

**Migração de status:** ampliar o `CHECK` de `cobrancas.status` para incluir `'estornado'` (hoje aceita pendente/pago/atrasado/cancelado/isento). Escolhi um status novo em vez de voltar para `pendente` justamente para não gerar cobrança nova nem inadimplência.

### Efeitos colaterais mapeados (e como ficam)

| Área | Efeito | Tratamento |
|---|---|---|
| Inadimplência (`processar-cobrancas-diario`) | Só transforma `pendente` em `atrasado` | `estornado` fica de fora — nenhuma inadimplência nova |
| Inadimplência existente da cobrança | `fn_close_inadimplencia_on_pagamento` fechou ao pagar | Continua fechada; o estorno não reabre |
| Nova tentativa automática | A recorrência filtra `pendente`/`atrasado` | `estornado` nunca é reprocessado, mesmo com a trava ligada |
| Venda vinculada (`fn_sync_cobranca_to_venda`) | Só age quando vira `pago` | Proponho marcar a venda como `estornado` no mesmo fluxo — **decisão sua** |
| Créditos do contrato | Nenhum gatilho liga crédito a `cobrancas` | Sem efeito automático; ajuste de crédito, se necessário, fica manual |
| Comissionamento | Calculado sobre vendas pagas | Se a venda virar `estornado`, a comissão do ciclo precisa de revisão manual — **decisão sua** |
| Relatórios / dashboards financeiros | Somam por status | Preciso incluir `estornado` nos rótulos e excluir do faturamento |
| Fiscal de pagamentos (`fn_auditoria_fiscal_pagamentos`) | Pode ler cobrança paga sem pagamento correspondente | Revisar as checagens para ignorar `estornado` e não gerar achado falso |
| Frontend | `STATUS_META` e tipos `CobrancaStatus` | Novo rótulo "Estornado" (cinza/vermelho) |

### Mockup do diálogo

```text
┌── Estornar cobrança ───────────────────────────────┐
│ Atenção: esta ação devolve o dinheiro ao aluno e   │
│ não pode ser desfeita.                             │
│                                                    │
│ Aluno .......... Leonardo Zimmer Saldanha          │
│ Ciclo .......... 11                                │
│ Valor .......... R$ 559,00  (estorno total)        │
│ Pago em ........ 19/09/2026                        │
│ TID ............ 10012345678901234567              │
│                                                    │
│ Motivo do estorno (obrigatório)                    │
│ ┌────────────────────────────────────────────────┐ │
│ │                                                │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│              [ Cancelar ]  [ Confirmar estorno ]   │
└────────────────────────────────────────────────────┘
```
Botão desabilitado enquanto o motivo tiver menos de 10 caracteres e durante o processamento. Resultado em aviso na tela: sucesso com o código da Rede, ou o motivo exato da recusa.

---

## Arquivos e objetos tocados

Código: `supabase/functions/cobrar-recorrencias-diario/index.ts`; nova `supabase/functions/estornar-cobranca/index.ts`; novo `supabase/functions/_shared/rede-refund.ts` (miolo extraído de `rede-cancelar`); `src/components/financeiro/TimelineCobrancas.tsx`; `src/hooks/useContratos.ts`; `src/types/financeiro.ts`; `src/components/admin/AdminIntegracoes.tsx`; novos `src/hooks/useSistemaConfig.ts` e `src/components/financeiro/EstornarCobrancaDialog.tsx`; rótulos de status nos relatórios financeiros.

Banco: nova tabela `sistema_config`; `CHECK` de `cobrancas.status` com `estornado`; índice único de refund em `pagamentos_rede`; revisão de `fn_auditoria_fiscal_pagamentos`.

## Riscos e decisões que dependem de você

1. **Venda vinculada:** marcar como `estornado` junto, ou deixar como está? (afeta relatórios e comissão)
2. **Comissionamento:** reverter automaticamente ou tratar manualmente caso a caso?
3. **Crédito do aluno:** estornar a mensalidade deve retirar os créditos daquele ciclo? Minha recomendação é **não** mexer automaticamente.
4. **Estorno parcial:** fora do escopo, só total — confirma?
5. Ampliar o `CHECK` de status é migração em tabela financeira viva; é aditiva e não altera linha nenhuma.
6. Os quatro casos já cobrados (Rafaela, Leonardo x2) só serão estornados quando você mandar, um a um.

## Como testar sem gastar dinheiro real

- Fase 1 (trava): testável sem nenhuma cobrança — chamo a função manualmente como admin e confirmo a resposta "pausado" e o registro em `system_logs`. Zero contato com a Rede.
- Fase 2 (estorno): confirmar primeiro o ambiente configurado. Em produção, o único teste com dinheiro real seria o próprio estorno que você já quer fazer (Rafaela ou um dos ciclos do Leonardo) — ou seja, nenhum gasto extra. Caminhos de erro (sem TID, cobrança não paga, clique duplo, recusa simulada) testo sem chamar a Rede. Se houver credenciais de homologação, faço um ciclo completo lá antes.

## Ordem de execução

- **Fase 0** — confirmar o ambiente da Rede configurado (só imprime "sandbox"/"producao").
- **Fase 1** — trava global + aviso e interruptor no software. Entrega isolada, sem risco financeiro.
- **Fase 2** — estorno: extração do miolo da `rede-cancelar`, função nova, migrações, diálogo e rótulos.
- **Fase 3** — ajustes de auditoria fiscal e relatórios para o novo status, e verificação em tela.
- **Fase 4 (futuro, só quando você pedir)** — regra da janela de vencimento e modo simulação antes de religar o agendamento.
