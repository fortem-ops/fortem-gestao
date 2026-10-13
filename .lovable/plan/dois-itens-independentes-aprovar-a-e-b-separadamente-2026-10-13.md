# Dois itens independentes (aprovar A e B separadamente)

## ITEM A — Fechar as funções que devolvem iniciais

**Quem chama hoje (verificado):**
- `fn_planos_identificar(p jsonb)` e `fn_planos_identificar_telefone(text)`: nenhuma chamada no site, no app de gestão, nas edge functions ou em outras funções do banco. Aparecem só nas migrações antigas (0093, 0097) e no arquivo de tipos gerado.
- As duas hoje: SECURITY DEFINER, EXECUTE liberado para anon e authenticated.

**Proposta:** migração `0107_planos_fechar_identificar`:
```sql
REVOKE EXECUTE ON FUNCTION public.fn_planos_identificar(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_planos_identificar_telefone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_planos_identificar(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_planos_identificar_telefone(text) TO service_role;
COMMENT ON FUNCTION ... IS 'DEPRECATED: substituída pelo cadastro único (planos-codigo)';
```
Não apaga as funções. **Quebra algo?** Não: nenhum chamador. **Reversão:** `GRANT EXECUTE ... TO anon, authenticated` nas duas.

**Outras funções fn_planos_* abertas a anon/authenticated:**

| Função | Aberta? | De propósito? |
|---|---|---|
| fn_planos_publico_2027 | sim (definer) | Sim: catálogo público do /planos (PlanosRota) |
| fn_proposta_plano_2027_criar | sim (definer) | Sim: o site cria a proposta; o servidor recalcula valores e exige CPF/consentimento |
| fn_planos_normalizar_telefone | sim (não definer) | Inofensiva (só formata texto); pode ficar |
| fn_planos_agregadora_mes, fn_planos_autorenew_defaults, fn_planos_catalogo_protege_versao | sim (não definer, padrão do Postgres) | Não intencional, mas rodam com permissão de quem chama (RLS vale). Fora do escopo; sugerir revisão à parte |
| fn_planos_divergencia_contrato | só authenticated | Sim: relatório interno de planos |
| resolver, limite, codigo_validar, dados_verificados, verificacao_admin, validar_tipo, divergencia_alertar | fechadas (service_role) | Correto |

Teste: anon e authenticated chamando as duas recebem "permission denied"; service_role continua.

---

## ITEM B — P3: baixa do Pix do /planos pelo webhook (4D)

### Situação atual (verificada)
- `planos-checkout` (pagar_pix real) já grava `pix_cobrancas` com `proposta_id`, sem `pedido_id`/`corrida_venda_id`, e põe a tentativa em `pendente` com `ref = txid`.
- `status_pagamento` hoje só consulta o Inter (GET) quando a tentativa está pendente.
- No pix-webhook, uma cobrança com `proposta_id` cai hoje em `if (!cob.pedido_id) continue;` (fica sem baixa) e, no caminho genérico, seria tratada como mensalidade (criaria `pagamentos`) — risco que o desvio elimina.
- Nenhuma função atual preenche `pago_em` da proposta.

### Desvio mínimo no pix-webhook (diff conceitual)
```text
 for (const ev of pixRecebidos) {
   const { data: cob } = select id, pedido_id, corrida_venda_id, proposta_id ...
   if (!cob) continue;
+  if (!cob.pedido_id && !cob.corrida_venda_id && cob.proposta_id) {
+    await baixarPixProposta(sup, cob, ev);   // planos-baixa.ts
+    pixTratados.add(txid); continue;
+  }
   // Corrida ... (idêntico)
   if (!cob.pedido_id) continue;            // mensalidade (idêntico)
   // Loja ... (idêntico)
 }
 ...laço de Pix Automático: idêntico; txids já tratados não entram nele.
```
Só muda o `select` (acrescenta `proposta_id`) e o bloco `+`. Loja, Corrida e Pix Automático seguem pelo mesmo caminho.

### Novo arquivo `supabase/functions/pix-webhook/planos-baixa.ts`
- Chama uma RPC nova `fn_checkout_2027_pix_liquidado(p_txid, p_valor_centavos, p_e2e)` (service_role).
- Erros: `system_logs` (modulo pix-webhook, acao `planos_baixa_erro`), payload passado por `mascararCpf`, sem nome/CPF.

### RPC `fn_checkout_2027_pix_liquidado` (migração `0108_checkout_2027_pix_webhook`)
Em uma transação, com `FOR UPDATE` na tentativa:
1. Acha `pix_cobrancas` pelo txid com `proposta_id`; se não houver, devolve `nao_encontrado`.
2. **Idempotente:** se a cobrança já está LIQUIDADA e a tentativa já está aprovada, devolve `ja_processado` sem mudar nada.
3. Confere o valor: o valor recebido tem de ser igual a `pix_cobrancas.valor`; se diferente, registra divergência e não dá baixa.
4. `pix_cobrancas`: status LIQUIDADA, liquidado_em, raw_response.
5. Tentativa (tipo pix, ref = txid): passa a `aprovado` pelo mesmo caminho de `fn_checkout_2027_tentativa_atualizar` (mantém a trava que volta o modo para simulação após um uso real).
6. Proposta: `etapa_checkout='pago'`, `pago_em=now()`, `pagamento_tipo='pix'`, `pagamento_ref=txid`, `etapa_atualizada_em=now()`; só se ainda não estiver paga.
7. **Não cria** venda, pagamento, parcela, contrato nem aluno (decisão do dono: isso só na ativação).
Proposta de teste admin segue a mesma regra (não vira aluno real).

### Como a tela detecta o pagamento
- `status_pagamento` passa a ler primeiro o banco: se a tentativa já está aprovada (pelo webhook), responde direto, sem chamar o Inter.
- O GET no Inter fica só como reserva, quando ainda está pendente, e com intervalo maior (ex.: a cada 30 s em vez de 5 s), aliviando o limite `ckf:i`.
- Se a consulta reserva encontrar CONCLUIDA, usa a mesma RPC (mesma baixa, idempotente com o webhook).
- Telas dos passos 8/9 não mudam; só reagem à etapa `pago` já existente.

### CPF do pagador (devedor)
- O Pix do /planos é criado **sem devedor** (verificado). A Loja envia devedor; o /planos não.
- Inter não exige devedor em cobrança imediata (`/cob`); é campo opcional do padrão Bacen. Não há risco de rejeição por isso.
- O webhook e a baixa dependem só do **txid** (e do valor), nunca do devedor.
- Conciliação: `conciliar-extrato-diario` não usa devedor (verificado). O extrato traz o nome do pagador real e o txid; a conciliação deve casar por txid/e2e. Efeito colateral: quem paga pode ser outra pessoa (ex.: parente), e não há como bloquear isso sem devedor — aceitável, pois a proposta já tem o contratante identificado.
- Recomendação: manter sem devedor (evita mandar CPF ao Inter e evita recusa por CPF digitado errado).

### Testes (sem cobrança real, sem chamada ao Inter/Rede)
- Unitários (`planos-baixa_test.ts`): detecção do desvio só com proposta_id; Loja/Corrida/mensalidade não entram; valor divergente não baixa; segundo aviso igual vira `ja_processado`; log sem CPF.
- Testes existentes de `eventos_test.ts` continuam passando.
- Aviso fictício **com token** e txid inexistente: 200, nenhuma linha muda em pix_cobrancas, propostas, tentativas, pagamentos, vendas (contagens antes/depois).
- Aviso fictício com txid de uma cobrança de teste criada só no banco (proposta teste admin): baixa uma vez; reenviado, nada muda.
- **Sem token**: 401, nada processado.
- O webhook não chama Inter nem Rede (só lê/grava banco); conferido no código e nos logs da função.

### Riscos
- Desvio no lugar errado afetar Loja/Corrida: mitigado pela condição tripla e pelos testes de "não entram".
- Corrida entre webhook e consulta reserva: resolvido com `FOR UPDATE` e idempotência.
- Valor divergente: não dá baixa e registra para a equipe.

### Reversão
- Remover o bloco `+` do pix-webhook e republicar (volta ao comportamento atual).
- RPC nova pode ficar sem uso ou ter EXECUTE revogado; nenhuma tabela nova, nenhuma coluna alterada.

### Arquivos e migrações
- Migração `0108_checkout_2027_pix_webhook` (RPC nova, EXECUTE só service_role, search_path fixo).
- `supabase/functions/pix-webhook/index.ts` (desvio mínimo), `pix-webhook/planos-baixa.ts` e teste novos.
- `supabase/functions/planos-checkout/index.ts` só a ação `status_pagamento` (ler banco antes, intervalo da reserva).
- `supabase/functions/pix-webhook/AGENTS.md` e `planos-checkout/AGENTS.md`: uma regra cada.

### Não muda
P4 (aviso/e-mail), cartão real, Loja, Corrida, Pix Automático, catálogo, cron, dados de alunos, telas 8/9. `planos_checkout_ativo=false` e modo `simulacao` mantidos; nenhuma cobrança.
