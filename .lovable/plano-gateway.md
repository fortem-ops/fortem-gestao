# Plano Gateway — Integração Rede (e-Rede)

**Status:** planejado, não implementado. Salvo para execução futura.
**Escopo MVP:** cartão de crédito (à vista + parcelado) + recorrência automática via cartão tokenizado.

---

## Pré-requisitos (cliente fornece)

1. Conta comercial Rede ativa com:
   - **PV** (filiação, 9 dígitos)
   - **Token integrador** (gerado no portal e-Rede)
2. Habilitar no portal: tokenização (cofre) + recorrência
3. Credenciais de **sandbox** para homologação antes de produção

Secrets: `REDE_PV`, `REDE_TOKEN`, `REDE_AMBIENTE` (`sandbox` | `producao`).

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
   ├─ POST /erede/v1/transactions { capture:true, kind:"credit", reference:venda_id, amount, installments, ... }
   ├─ Se "salvar cartão" marcado: tokeniza
   └─ Persiste em pagamentos_rede + atualiza vendas.status_pagamento
   ▼
UI: aprovado / negado (motivo) / 3DS pendente
```

## Fluxo recorrência (Start/Gympass/Wellhub/Totalpass)

```
1. Primeira venda: aluno paga e aceita salvar cartão (tokeniza)
2. Token salvo em cartoes_salvos; planos.cartao_token_id aponta pro default
3. Cron `renovar-planos-mensais`:
   - Gera venda
   - SE plano tem cartao_token_id → chama `rede-cobrar-token`
   - SE não → status=pendente (cobrança manual)
4. Resultado:
   - Sucesso → status=pago + notificação
   - Falha → status=falha + alerta coordenador + notificar aluno
```

## Tabelas novas

**`cartoes_salvos`**
- aluno_id, token_rede, brand, last4, holder_name, expiration_month, expiration_year, ativo, default

**`pagamentos_rede`** (auditoria)
- venda_id, tid, nsu, authorization_code, return_code, return_message, amount, installments, kind, status, raw_response (jsonb sem PAN/CVV), created_at

**`planos`** — nova coluna:
- `cartao_token_id` (uuid → cartoes_salvos)

**RLS:**
- `pagamentos_rede`: somente coord/admin (SELECT)
- `cartoes_salvos`: aluno vê só os próprios via portal; coord/admin vê todos; professor/nutri/fisio sem acesso
- Nenhum role pode ler colunas com PAN (não devem existir)

## Edge Functions

1. `rede-cobrar-cartao` — cobrança nova com dados de cartão (opção tokenizar)
2. `rede-cobrar-token` — cobrança usando token salvo (cron + retry manual)
3. `rede-cancelar` — estorno (admin)
4. `rede-webhook` — notificações assíncronas da Rede (verify_jwt=false, valida HMAC)

Atualizar `renovar-planos-mensais` para chamar `rede-cobrar-token` quando há cartão default.

## Frontend

- `PagarCartaoDialog.tsx` — formulário com Luhn, máscara, parcelas, "salvar para renovação"
- Botão "Cobrar" em vendas pendentes do `HistoricoVendas`
- Aba "Cartões salvos" no perfil do aluno (listar/default/remover)
- Em `StudentPlan`: seletor "Cartão para renovação automática"
- Badges: pendente / pago / falha / estornado

## Endpoints Rede

- `POST /erede/v1/transactions` — autorizar+capturar
- `POST /erede/v1/transactions/{tid}/refunds` — estorno
- `GET  /erede/v1/transactions/{tid}` — consultar
- Auth: Basic `base64(PV:TOKEN)`
- Recorrência: `{ storageCard: { cardId }, subscription: true }`

## Códigos de retorno tratados

- `00` aprovado
- `51` sem saldo → notifica aluno
- `54` cartão expirado → marca cartão_salvo expirado, pede atualização
- `78` bloqueado
- timeout/5xx → retry com backoff

## Fora do MVP

PIX, boleto, débito, antifraude Cybersource, split de pagamento.

---

# Segurança e LGPD

## Padrão PCI-DSS aplicado

A Rede exige conformidade PCI-DSS pra processar cartão. Como **nunca armazenamos** PAN (número completo), CVV ou trilha magnética no nosso banco, nos qualificamos como **PCI-DSS SAQ-A** (o nível mais leve), pois apenas tokenizamos via API.

### Regras invioláveis

| Dado | Onde pode trafegar | Onde pode ser armazenado |
|---|---|---|
| **PAN completo** (nº cartão) | Browser → Edge Function → Rede (HTTPS) | **Nunca** no nosso banco. **Nunca** em logs. |
| **CVV** | Browser → Edge Function → Rede (HTTPS) | **Nunca** em lugar nenhum (proibido por PCI). Pedido a cada cobrança nova. |
| **Validade** | Browser → Edge Function → Rede | OK armazenar (mês/ano) junto ao token |
| **Nome impresso** | Browser → Edge Function → Rede | OK armazenar |
| **Last 4 dígitos** | Resposta Rede | OK (não é PCI-sensível) |
| **Brand** (visa/master) | Resposta Rede | OK |
| **Token Rede** | Resposta Rede | OK — é o substituto seguro do PAN |

### Implementação obrigatória

1. **Edge Function como único canal**: o frontend manda os dados do cartão direto pra `rede-cobrar-cartao` (HTTPS), que repassa pra Rede. Nunca passa por outro serviço nosso, nunca persiste em `vendas`/`alunos`.
2. **Sanitização de logs**: antes de gravar `raw_response` em `pagamentos_rede`, remover qualquer eco de `cardNumber`/`securityCode`. `console.log` proibido com payload de cartão.
3. **TLS 1.2+** ponta a ponta (Lovable Cloud + Rede já garantem).
4. **HSTS + CSP** no app (já está).
5. **Sem CVV em qualquer lugar nosso** — recorrência usa flag `subscription:true` que dispensa CVV.
6. **Rate limit** em `rede-cobrar-cartao` (ex: 5 tentativas/min/aluno) pra mitigar fraude por força bruta.
7. **RLS rígido**: aluno só vê os próprios cartões; PAN nunca exposto (nem existe na tabela).
8. **Auditoria**: toda cobrança gera linha em `pagamentos_rede` com `created_by` (uid do operador).

## LGPD — conformidade

Cartão de crédito é **dado pessoal** (Lei 13.709/18, Art. 5º, I) e last4+brand+nome+token são tratados sob as bases legais:

### Bases legais aplicáveis

- **Execução de contrato** (Art. 7º, V): cobrar pelo plano que o aluno contratou — base principal pra cobrança pontual.
- **Consentimento** (Art. 7º, I): para **salvar o cartão** pra renovação automática. Precisa ser **específico, informado e destacado** — checkbox "Salvar este cartão para renovações automáticas mensais" **não pode vir pré-marcado**.
- **Cumprimento de obrigação legal** (Art. 7º, II): manter `pagamentos_rede` por 5 anos (Código Tributário + obrigações fiscais).

### Direitos do titular (Art. 18) — implementar

| Direito | Como atender |
|---|---|
| Confirmação e acesso | Aba "Cartões salvos" no portal mostra brand + last4 + validade |
| Correção | Substituir cartão = adicionar novo + remover antigo |
| Anonimização/eliminação | Botão "Remover cartão" → revoga token na Rede via API + soft delete em `cartoes_salvos` |
| Portabilidade | Não aplicável (token é específico da Rede) |
| Revogação do consentimento | Mesmo botão "Remover cartão" + opção "desativar renovação automática" no plano |
| Informação sobre uso compartilhado | Política de privacidade declara: "Dados de cartão são processados pela Rede (Itaú Unibanco S.A.), operadora qualificada PCI-DSS Level 1" |

### Documentos a atualizar

- **Política de Privacidade**: declarar Rede como operador, finalidade (cobrança), retenção (5 anos), direitos.
- **Termos de Uso**: cláusula de cobrança recorrente com possibilidade de revogação.
- **Aviso no checkout**: "Seus dados de cartão são enviados diretamente para a operadora Rede (PCI-DSS Level 1) via conexão criptografada. A Fortem não armazena o número completo do cartão nem o código de segurança."

### Princípios LGPD garantidos

- **Finalidade** (Art. 6º, I): cartão usado só pra cobrar planos/serviços contratados
- **Adequação** (II): coleta compatível com a finalidade
- **Necessidade** (III): coletamos só o mínimo (nem armazenamos CVV/PAN)
- **Livre acesso** (IV): aba portal mostra cartões salvos
- **Qualidade** (V): aluno mantém cartões atualizados
- **Transparência** (VI): política + aviso explícitos
- **Segurança** (VII): tokenização + TLS + RLS + sem PAN/CVV no nosso banco
- **Prevenção** (VIII): rate limit + auditoria
- **Não discriminação** (IX): N/A
- **Responsabilização** (X): logs em `pagamentos_rede` com operador

### Riscos residuais aceitos

- **Vazamento de last4 + brand + nome**: impacto baixo (não permite transação fraudulenta sozinho), mas obriga notificação à ANPD em até 2 dias úteis se ocorrer (Art. 48).
- **Vazamento de token Rede**: token só funciona com nosso PV+Token integrador (que ficam em secrets server-side). Sozinho é inútil.

### O que NÃO fazemos (intencional)

- Não criptografamos `cartoes_salvos` em camada extra: já está sob RLS + sem PAN/CVV; criptografia adicional seria security theater.
- Não logamos IP/device fingerprint do pagador (poderia agregar valor antifraude, mas amplia escopo LGPD — fica pra v2 com base em legítimo interesse + DPIA).

---

## Conclusão sobre LGPD

**Sim, a integração proposta é LGPD-compliant**, desde que sejam executadas em conjunto:

1. Política de Privacidade + Termos atualizados antes do go-live
2. Checkbox de consentimento explícito pra salvar cartão (não pré-marcado)
3. Aba "Cartões salvos" no portal do aluno com botão de remoção
4. Sanitização de logs aplicada em todas as edge functions
5. RLS implementado conforme tabela acima
6. PAN/CVV nunca armazenados (somente trafegam pra Rede)

A maior parte da segurança "pesada" é delegada pra Rede (PCI Level 1). Nossa responsabilidade é não tocar em PAN/CVV, garantir consentimento pra recorrência e respeitar direitos do titular.
