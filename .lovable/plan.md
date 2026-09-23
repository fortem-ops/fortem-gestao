# Cobrar em um clique com cartão já salvo

Objetivo: quando o aluno já tem cartão salvo ativo, cobrar a venda com um clique, sem digitar dados do cartão. Sem cartão salvo, a tela continua exatamente como é hoje.

## 1. Diagnóstico do que já existe

**O diálogo** é `src/components/pagamentos/PagarCartaoDialog.tsx` (aberto pelo ícone de cartão em `src/components/student/venda/HistoricoVendas.tsx` e também por `VendaDialog.tsx`). Hoje ele sempre monta o formulário completo e chama a função `rede-cobrar-cartao`.

**`rede-cobrar-cartao`** (fluxo manual atual) faz, nesta ordem: limite de tentativas (`fn_check_rate_limit`, 5/min por aluno), exige login, exige coordenador ou admin (`is_coordinator_or_admin`), bloqueia repetição se já existe pagamento aprovado/pendente para a venda, calcula o valor no servidor a partir da venda (tratando recorrência), cobra na operadora, grava em `pagamentos_rede` com `created_by`, marca a venda como paga/falha, quita parcelas e — se aprovado — cria contrato e cobranças (`fn_criar_contrato_recorrencia` ou `fn_criar_contrato_tradicional`), além de salvar o cartão quando pedido.

**`rede-cobrar-token`** já cobra com cartão salvo: recebe `venda_id`, `cartao_id`, `amount`, `installments`; busca token do cartão e a tokenização ativa; usa `cobrarComToken` de `_shared/rede-recorrencia-core.ts`; grava `pagamentos_rede` e atualiza a venda. **Falta nele**, comparado ao fluxo manual: não exige login nem permissão (hoje só é chamada internamente pela recorrência), recebe o valor do cliente em vez de calcular no servidor, não aplica limite de tentativas, não grava `created_by`, não valida que o cartão é do mesmo aluno da venda, não usa `idempotency_key`, e **não cria contrato/cobranças** quando a venda é de plano.

Conclusão: dá para reaproveitar `cobrarComToken` sem duplicar a chamada à operadora, mas o caminho de um clique deve reaproveitar também o pós-aprovação do fluxo manual (contrato, parcelas, venda). A proposta abaixo é uma nova função dedicada que junta as duas partes, deixando `rede-cobrar-token` intacta (a recorrência depende dela).

Dados confirmados no banco: Rafaela tem 1 cartão Mastercard final 7452, validade 10/2029, padrão, ativo, com 1 tokenização ativa. Nada foi cobrado.

## 2. Tela (mockup textual)

Com cartão salvo ativo e tokenização válida:

```text
┌ Cobrar no cartão ─────────────────────────────┐
│ Valor                             R$ 100,00   │
│                                               │
│ ● Mastercard ••••7452 · vence 10/2029  Padrão │
│ ○ Visa ••••1234 · vence 05/2028               │   (só se houver 2+)
│                                               │
│ Parcelas   [ 1x de R$ 100,00 à vista   ▼ ]    │
│                                               │
│ [ Cobrar R$ 100,00 no Mastercard ••••7452 ]   │
│ Usar outro cartão (digitar os dados)          │
└───────────────────────────────────────────────┘
```

- Um clique cobra, sem segunda confirmação. Durante o processamento o botão vira "Processando..." e fica travado (protege contra duplo clique).
- "Usar outro cartão" abre o formulário atual, sem mudanças; há um caminho de volta para a lista de cartões.
- Cartão com validade já vencida aparece desabilitado com a marca "vencido"; cartão sem tokenização ativa aparece com "precisa recadastrar".
- Se nenhum cartão salvo servir, o diálogo abre direto no formulário de hoje.
- Resultado aprovado, recusado ou erro aparece na mesma faixa de status que o diálogo já usa, com mensagem legível.

## 3. Segurança

- O cliente envia apenas `venda_id`, `aluno_id`, `cartao_id`, `installments` e uma chave de idempotência. Valor e token vêm do servidor.
- O frontend nunca recebe `token_rede` nem `tokenization_id`: a consulta de cartões seleciona só id, bandeira, final, validade, padrão e ativo (padrão já usado em `usePortalCartoes`).
- O servidor valida: usuário logado, coordenador ou admin (mesma regra de hoje), cartão pertence ao aluno da venda, cartão ativo, validade não vencida, tokenização ativa existente, venda ainda não paga.
- Limite de tentativas com o mesmo `fn_check_rate_limit` já usado.
- Idempotência dupla: bloqueio por pagamento aprovado/pendente da venda (como hoje) mais `pagamentos_rede.idempotency_key`, que já tem índice único parcial — a segunda tentativa com a mesma chave não cria segunda cobrança.

## 4. Resultado

- Aprovado: mesmos efeitos do fluxo manual — venda paga, parcelas quitadas, contrato/cobranças criados quando for plano, registro em `pagamentos_rede` com TID e `created_by`, aviso de sucesso e atualização da lista.
- Recusado: mensagem legível via `motivoRecusaLegivel`, venda segue pendente, nada marcado como pago. Cartão vencido (código 54) desativa o cartão salvo, como já ocorre hoje.
- Falha técnica (comunicação/criptograma): nada alterado no banco além do registro de log.

## 5. Recorrência automática

Este fluxo é manual, disparado pelo clique. Não lê nem escreve `sistema_config.cobranca_recorrente_ativa`, não toca no agendamento (job 28 segue inativo) nem em `cobrar-recorrencias-diario`. A trava global continua `false` e sem efeito sobre esta cobrança.

## 6. Arquivos, funções e migrações

Novos:
- `supabase/functions/rede-cobrar-salvo/index.ts` — cobrança de um clique (auth + permissão + limite + validações + `cobrarComToken` + pós-aprovação).
- `supabase/functions/_shared/venda-pos-aprovacao.ts` — extração, sem mudança de comportamento, do bloco pós-aprovação de `rede-cobrar-cartao` (venda, parcelas, contrato) para ser usado pelas duas funções.
- `src/hooks/useCartoesCobranca.ts` — lista de cartões ativos do aluno com sinal de tokenização válida.

Alterados:
- `src/components/pagamentos/PagarCartaoDialog.tsx` — modo "cartão salvo" com seletor, parcelas e botão único; formulário atual preservado.
- `rede-cobrar-cartao/index.ts` — apenas passa a importar o pós-aprovação extraído (comportamento idêntico).

Migração: nenhuma obrigatória. `pagamentos_rede.idempotency_key` e o índice único já existem. Opcional, aditivo: uma função de leitura que devolva os cartões elegíveis já com o sinal de tokenização ativa, evitando que o frontend consulte `rede_tokenizacoes`. Recomendado, porque `rede_tokenizacoes` hoje é legível por toda a equipe.

Intocados: `cobrar-recorrencias-diario`, `rede-cobrar-token`, `_shared/rede-recorrencia-core.ts`, `processar-cobrancas-diario`, cron, trava global.

## 7. Riscos e decisões suas

Riscos: cobrança em produção, portanto o botão precisa deixar valor e cartão explícitos (previsto); token pode estar inválido na operadora mesmo com tokenização "ativa" no banco (tratado como recusa legível); extrair o pós-aprovação mexe em código de venda que já funciona (mitigado por testes de unidade e revisão linha a linha).

Decisões que dependem de você:
1. Um clique sem nenhuma confirmação em qualquer valor, ou pedir confirmação acima de um limite (ex.: R$ 1.000)?
2. Parcelas no cartão salvo: manter até 12x como hoje, ou travar em 1x?
3. Quem pode usar: manter coordenador e admin, como hoje?
4. Adotar a função de leitura de cartões elegíveis (fecha o acesso a `rede_tokenizacoes` no frontend)?

## 8. Teste sem cobrar cartão real

- Testes de unidade das validações (cartão de outro aluno, cartão vencido, sem tokenização, venda já paga, chave repetida) com a operadora simulada.
- Chamadas à função sem login e sem permissão: devem recusar antes de qualquer contato com a operadora.
- Repetição da mesma chave de idempotência: segunda chamada não deve gerar segunda cobrança.
- Conferência visual do diálogo nos três estados (um cartão, vários cartões, nenhum cartão) sem apertar o botão de cobrar.
- Único teste real: uma cobrança autorizada por você, feita por você na tela.

## 9. Fases

1. Extração do pós-aprovação compartilhado, sem mudança de comportamento, com testes.
2. Nova função de cobrança com cartão salvo (validações, idempotência, limite) e testes com operadora simulada.
3. Diálogo com o modo cartão salvo e o link "Usar outro cartão".
4. Verificação completa sem cobrar e, por último, a cobrança real autorizada por você.
