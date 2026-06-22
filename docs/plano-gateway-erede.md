# Plano Gateway — Integração Rede (e-Rede)

**Status:** planejado, não implementado. Salvo para execução futura.
**Escopo MVP:** cartão de crédito (à vista + parcelado) + recorrência automática via cartão tokenizado.

---

## Pré-requisitos (cliente fornece)

Conta comercial Rede ativa com:

- PV (filiação, 9 dígitos)
- Token integrador (gerado no portal e-Rede)
- Habilitar no portal: tokenização (cofre) + recorrência
- Credenciais de sandbox para homologação antes de produção

**Secrets:** `REDE_PV`, `REDE_TOKEN`, `REDE_AMBIENTE` (sandbox | producao).

> **Melhoria:** `REDE_PV` e `REDE_TOKEN` devem ser armazenados no
> `supabase_vault` (já instalado, v0.3.1) em vez de env vars simples.
> Credenciais no Vault ficam criptografadas em repouso e inacessíveis
> via dashboard para admins do projeto.
> ```sql
> SELECT vault.create_secret('rede_pv', '<valor>');
> SELECT vault.create_secret('rede_token', '<valor>');
> -- Edge function acessa via vault.decrypted_secrets
> ```

---

## Fluxo cartão à vista / parcelado

```
Venda criada (status=pendente)
   ▼
[Botão "Cobrar no cartão"] em HistoricoVendas
   ▼
Modal: nº cartão, CVV, validade, nome, parcelas
   ▼
Edge Function `rede-cobrar-cartao`
   ├─ Valida sessão + permissão (Coord/Admin)
   ├─ [NOVO] Validação Luhn na edge function (antes de chamar a Rede)
   ├─ [NOVO] Verificar idempotência: existe linha em pagamentos_rede
   │         com venda_id e status IN ('approved','pending')?
   │         Se sim → retornar TID existente sem nova cobrança.
   ├─ POST /erede/v1/transactions { capture:true, kind:"credit",
   │         reference:venda_id, amount, installments, ... }
   ├─ Se "salvar cartão" marcado: tokeniza
   ├─ Persiste em pagamentos_rede + atualiza vendas.status_pagamento
   └─ [NOVO] Atualiza pagamento_parcelas.status='pago' e
             data_pagamento=now() para manter v_financeiro_aberto
             e v_financeiro_recebimentos sincronizados
   ▼
UI: aprovado / negado (motivo) / 3DS pendente
```

---

## Fluxo recorrência (Start / Gympass / Wellhub / Totalpass)

1. Primeira venda: aluno paga e aceita salvar cartão (tokeniza)
2. Token salvo em `cartoes_salvos`; `planos.cartao_token_id` aponta pro default
3. Cron `renovar-planos-mensais`:
   - Gera venda
   - **Gate de cobrança automática:**
     `planos.renovacao_automatica = true`
     `AND planos.cartao_token_id IS NOT NULL`
     `AND cartoes_salvos.ativo = true`
     → chama `rede-cobrar-token`
   - Se não preencher o gate → status=pendente (cobrança manual, como hoje)
4. Resultado:
   - **Sucesso** → status=pago + notificação via `fn_notificar_criar_notificacao`
     + dispara `fn_gerar_comissao` para o vendedor do plano
   - **Falha** → status=falha + alerta coordenador via sistema de notificações
     + notificar aluno
   - **Código 54 (cartão expirado)** → marcar `cartoes_salvos.ativo=false`,
     setar `planos.cartao_token_id=NULL` (FK `ON DELETE SET NULL`),
     criar notificação para o aluno pedir atualização do cartão,
     próximo cron gera venda manual (status=pendente)

---

## Tabelas novas

### `cartoes_salvos`

| Coluna | Tipo | Obs |
|--------|------|-----|
| id | uuid PK | |
| aluno_id | uuid FK → alunos | |
| token_rede | text | substituto do PAN |
| brand | text | visa, master, elo... |
| last4 | text | últimos 4 dígitos |
| holder_name | text | nome impresso |
| expiration_month | smallint | |
| expiration_year | smallint | |
| ativo | boolean | false = expirado ou removido |
| default | boolean | cartão padrão para renovação |
| created_at | timestamptz | |

> **Trigger de auditoria:** criar `trg_audit_cartoes_salvos` chamando
> `fn_audit_log()` no padrão já estabelecido no projeto.

### `pagamentos_rede` (auditoria de cobranças)

| Coluna | Tipo | Obs |
|--------|------|-----|
| id | uuid PK | |
| venda_id | uuid FK → vendas | `reference` enviado à Rede |
| created_by | uuid FK → auth.users | uid do operador que disparou a cobrança |
| tid | text | ID da transação na Rede |
| nsu | text | |
| authorization_code | text | |
| return_code | text | 00=aprovado, 51=sem saldo... |
| return_message | text | |
| amount | integer | em centavos |
| installments | smallint | |
| kind | text | credit / token |
| status | text | approved / denied / refunded |
| raw_response | jsonb | **sanitizado** — sem PAN/CVV |
| created_at | timestamptz | |

> **Sanitização obrigatória:** criar função `fn_sanitize_rede_response(jsonb)`
> que remove `cardNumber`, `securityCode`, `pan`, `cvv`, `cvv2` do JSONB
> antes de gravar. Usar como trigger `BEFORE INSERT` em `pagamentos_rede`
> como segunda linha de defesa (além da sanitização na edge function).
>
> **Trigger de auditoria:** criar `trg_audit_pagamentos_rede` chamando
> `fn_audit_log()`.

### `webhook_events_rede` (deduplicação de webhooks)

| Coluna | Tipo | Obs |
|--------|------|-----|
| event_id | text PK | ID único enviado pela Rede no header |
| payload | jsonb | payload completo (sanitizado) |
| processed_at | timestamptz | quando foi processado |

> **Deduplicação:** a edge function `rede-webhook` faz
> `INSERT INTO webhook_events_rede ... ON CONFLICT (event_id) DO NOTHING`
> e só processa se o insert teve efeito. Garante exatamente-uma-vez mesmo
> com reentregas da Rede.

### `planos` — nova coluna

```sql
ALTER TABLE public.planos
  ADD COLUMN cartao_token_id uuid REFERENCES cartoes_salvos(id) ON DELETE SET NULL;
```

> O `ON DELETE SET NULL` garante que ao remover o cartão,
> o plano volta para cobrança manual automaticamente.

### `vendas.status_pagamento` — novo valor

```sql
-- Verificar todos os usos de status antes de adicionar:
-- views v_vendas_resumo, v_financeiro_aberto, v_financeiro_recebimentos
-- relatórios RelatoriosVendas, RelatoriosFinanceiro
-- KPIs calcStats() em src/lib/vendas-calc.ts
ALTER TYPE venda_status ADD VALUE IF NOT EXISTS 'falha';
```

> **Atenção:** esta é uma migração irreversível. Auditar todos os filtros
> por status antes de executar.

---

## RLS

### `pagamentos_rede`
- `coord_admin` → SELECT (somente leitura)
- `admin` → ALL
- Sem acesso para `professor`, `nutricionista`, `fisioterapeuta`, `aluno`

### `cartoes_salvos`
- Aluno → SELECT/DELETE apenas os próprios (`aluno_id` via `alunos.user_id`)
- Coord/admin → SELECT todos
- Professor/nutri/fisio → sem acesso
- Inserção: apenas via edge function com `service_role`

### `webhook_events_rede`
- Apenas `service_role` (edge function) escreve
- Admin → SELECT (auditoria)

---

## Edge Functions

| Função | Descrição |
|--------|-----------|
| `rede-cobrar-cartao` | Cobrança nova com dados de cartão + opção tokenizar |
| `rede-cobrar-token` | Cobrança usando token salvo (cron + retry manual) |
| `rede-cancelar` | Estorno (admin) |
| `rede-webhook` | Notificações assíncronas da Rede (`verify_jwt=false`, valida HMAC + deduplicação) |

**Atualizar** `renovar-planos-mensais` para chamar `rede-cobrar-token` quando
há cartão default ativo, respeitando o gate de cobrança automática.

---

## Segurança e rate limit

### Validação Luhn na edge function

```typescript
// Reimplementar na edge function — não confiar só no front
function luhn(n: string): boolean {
  const d = n.replace(/\D/g, "");
  let s = 0;
  let odd = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let digit = parseInt(d[i]);
    if (odd) { digit *= 2; if (digit > 9) digit -= 9; }
    s += digit;
    odd = !odd;
  }
  return s % 10 === 0;
}
// Rejeitar com 400 antes de qualquer chamada à Rede
```

### Rate limit

**5 tentativas/minuto/aluno.** Armazenamento via tabela no banco:

```sql
CREATE TABLE rate_limit_cobranças (
  aluno_id    uuid    NOT NULL,
  janela_min  bigint  NOT NULL,  -- EXTRACT(EPOCH FROM now())::bigint / 60
  contagem    integer NOT NULL DEFAULT 1,
  PRIMARY KEY (aluno_id, janela_min)
);
-- Na edge function:
-- INSERT ... ON CONFLICT DO UPDATE SET contagem = contagem + 1
-- Rejeitar se contagem > 5
```

### Sanitização de `raw_response`

```sql
CREATE OR REPLACE FUNCTION public.fn_sanitize_rede_response(p_raw jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT p_raw
    - 'cardNumber' - 'securityCode' - 'pan'
    - 'cvv' - 'cvv2' - 'track1' - 'track2';
$$;

CREATE TRIGGER trg_sanitize_pagamentos_rede
  BEFORE INSERT ON public.pagamentos_rede
  FOR EACH ROW
  EXECUTE FUNCTION /* wrapper que aplica fn_sanitize_rede_response em NEW.raw_response */;
```

---

## Frontend

| Componente | Descrição |
|------------|-----------|
| `PagarCartaoDialog.tsx` | Formulário com Luhn client-side, máscara, parcelas, "salvar para renovação" (checkbox NÃO pré-marcado) |
| Botão "Cobrar" | Em vendas pendentes no `HistoricoVendas` |
| Aba "Cartões salvos" | No `PortalProfile` (seguindo padrão visual do `StudentPortalContext`) |
| `StudentPlan` | Seletor "Cartão para renovação automática" |
| Badges | pendente / pago / falha / estornado |

---

## Endpoints Rede

| Método | Endpoint | Uso |
|--------|----------|-----|
| POST | `/erede/v1/transactions` | Autorizar + capturar |
| POST | `/erede/v1/transactions/{tid}/refunds` | Estorno |
| GET | `/erede/v1/transactions/{tid}` | Consultar |

**Auth:** `Basic base64(PV:TOKEN)`
**Recorrência:** `{ storageCard: { cardId }, subscription: true }`

---

## Códigos de retorno tratados

| Código | Significado | Ação |
|--------|------------|------|
| 00 | Aprovado | Atualizar status=pago, notificar, comissionar |
| 51 | Sem saldo | Notificar aluno |
| 54 | Cartão expirado | Marcar cartão inativo, NULL token no plano, notificar |
| 78 | Bloqueado | Notificar aluno |
| timeout / 5xx | Erro temporário | Retry com backoff exponencial |

---

## Fora do MVP

PIX, boleto, débito, antifraude Cybersource, split de pagamento,
IP/device fingerprint do pagador.

---

## Segurança PCI-DSS SAQ-A

### Regras invioláveis

| Dado | Onde pode trafegar | Onde pode ser armazenado |
|------|-------------------|--------------------------|
| PAN completo | Browser → Edge Function → Rede (HTTPS) | **Nunca** no nosso banco |
| CVV | Browser → Edge Function → Rede (HTTPS) | **Nunca** em lugar nenhum |
| Validade | Browser → Edge Function → Rede | OK (mês/ano junto ao token) |
| Nome impresso | Browser → Edge Function → Rede | OK |
| Last 4 dígitos | Resposta Rede | OK (não é PCI-sensível) |
| Brand | Resposta Rede | OK |
| Token Rede | Resposta Rede | OK — substituto seguro do PAN |

### Implementação obrigatória

- Edge function como único canal — frontend manda dados do cartão direto
  para `rede-cobrar-cartao` (HTTPS), que repassa para a Rede
- Sanitização em duas camadas: edge function + trigger `BEFORE INSERT`
  em `pagamentos_rede`
- TLS 1.2+ ponta a ponta
- HSTS + CSP no app (já presente)
- Sem CVV em lugar nenhum — recorrência usa `subscription:true`
- Rate limit: 5 tentativas/min/aluno
- RLS rígido em `cartoes_salvos`
- Auditoria em `pagamentos_rede` com `created_by`
- `REDE_PV` e `REDE_TOKEN` armazenados no `supabase_vault`

---

## LGPD — conformidade

Cartão de crédito é dado pessoal (Lei 13.709/18, Art. 5º, I).

### Bases legais

| Base | Aplicação |
|------|-----------|
| Execução de contrato (Art. 7º, V) | Cobrança pelo plano contratado |
| Consentimento (Art. 7º, I) | Salvar cartão para renovação automática — checkbox explícito, NÃO pré-marcado |
| Cumprimento de obrigação legal (Art. 7º, II) | Manter `pagamentos_rede` por 5 anos (Código Tributário) |

### Direitos do titular (Art. 18)

| Direito | Como atender |
|---------|-------------|
| Confirmação e acesso | Aba "Cartões salvos" no portal: brand + last4 + validade |
| Correção | Substituir cartão = adicionar novo + remover antigo |
| Eliminação | Botão "Remover" → revoga token na Rede via API + soft delete |
| Portabilidade | Não aplicável (token é específico da Rede) |
| Revogação do consentimento | Botão "Remover cartão" + "desativar renovação automática" |
| Informação sobre compartilhamento | Política de Privacidade declara Rede como operadora PCI Level 1 |

### Documentos a atualizar antes do go-live

- **Política de Privacidade:** declarar Rede como operador, finalidade,
  retenção (5 anos), direitos do titular
- **Termos de Uso:** cláusula de cobrança recorrente com revogação
- **Aviso no checkout:** "Seus dados de cartão são enviados diretamente para
  a operadora Rede (PCI-DSS Level 1) via conexão criptografada. A Fortem não
  armazena o número completo do cartão nem o código de segurança."

---

## Matriz de testes de homologação (sandbox)

Antes do go-live, executar obrigatoriamente:

| Cenário | Cartão de teste | Resultado esperado |
|---------|----------------|-------------------|
| Aprovação à vista | Número sandbox Rede (retorno 00) | status=pago, comissão gerada |
| Parcelamento 3x | Número sandbox Rede | status=pago, parcelas corretas |
| Negação sem saldo | Número sandbox (retorno 51) | status=falha, aluno notificado |
| Cartão expirado | Número sandbox (retorno 54) | cartão inativo, plano sem token |
| Timeout Rede | Simular via sandbox | retry sem cobrança dupla |
| Webhook duplicado | Enviar mesmo event_id 2x | processado apenas 1 vez |
| Estorno (admin) | Após aprovação | status=estornado |
| Recorrência com token | Cartão salvo sandbox | status=pago automático |
| Rate limit | 6 tentativas/min | 6ª bloqueada com 429 |
| Idempotência | Chamar cobrar 2x mesma venda | retorna TID existente |

---

## Riscos residuais aceitos

- **Vazamento de last4 + brand + nome:** impacto baixo (não permite transação
  fraudulenta), mas obriga notificação à ANPD em até 2 dias úteis (Art. 48)
- **Vazamento de token Rede:** token só funciona com nosso PV+Token integrador
  (armazenados no Vault server-side). Sozinho é inútil.

## O que NÃO fazemos (intencional)

- Não criptografamos `cartoes_salvos` em camada extra: já está sob RLS +
  sem PAN/CVV; criptografia adicional seria security theater
- Não logamos IP/device fingerprint do pagador — fica para v2 com base
  em legítimo interesse + DPIA

---

*Documento atualizado em 2026-06-21. Incorpora análise técnica cruzada com
o schema real do projeto (vendas, pagamentos, planos, comissionamentos,
notificações) e melhorias de segurança identificadas em revisão.*
