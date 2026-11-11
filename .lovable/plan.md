# Plano do teste real de R$ 1,00 — Plano Semestral (Pro Semestral) com Bruna Meyer

Nada disto é executado sem a sua aprovação expressa. Aluna: BRUNA MEYER (`b7f99527-9f4a-448b-9cca-78017bbc0cb2`), sem plano de agregadora.

## Como contornar elegibilidade e preço (seguro e reversível)
- Não ligar os 4 itens nem os 2 modelos para ninguém. Nada de plano Wellhub "falso" no cadastro dela (isso mexeria em check-ins, Clube e relatórios).
- Uma chave temporária `semestral_teste_real` em `sistema_config`: `{ "aluno_id": "<Bruna>", "codigo": "pro_semestral_wellhub_3x", "valor_centavos": 100, "valido_ate": "<hoje 23:59>" }`.
- Pequena alteração (migração, com aprovação) lida só quando a chave existe e o aluno é exatamente a Bruna:
  - `fn_semestral_elegivel`: dispensa a exigência de agregadora (CPF e prazo continuam valendo).
  - `fn_semestral_itens_elegiveis`: mostra só esse item a ela, mesmo desligado.
  - `fn_venda_semestral_criar`: grava a venda, a nº 1 e o contrato com R$ 1,00 e origem `teste_2027` (fora de relatórios, sem comissão e sem aviso de venda paga). A Bruna entra temporariamente em `vendas_2027_teste_aluno_ids`.
- Para desfazer, basta apagar a chave e tirar a Bruna da lista. A alteração fica sem efeito para qualquer outro aluno, e um teste automático garante isso.

## Passos (cada um com a consulta de conferência)
1. **Antes:** foto do estado da Bruna (planos, créditos, contratos, vendas, cartões, `pagamentos_rede`). Também confirmar que os itens e modelos estão desligados e que nenhum outro aluno é elegível pela chave.
2. **Cartão:** a equipe cadastra o cartão real dela pela tokenização Rede (Cadastrar cartão). Conferir `cartoes_salvos` e `rede_tokenizacoes` com status `active`.
3. **Venda:** Nova Venda > Plano Semestral > Pro Semestral (R$ 1,00) e depois "Cobrar R$ 1,00 agora". Conferir:
   - venda e nº 1 pagas, com 1 `pagamentos_rede` approved (tid, nsu)
   - plano ativo, com 12 Treinos, 4 sessões de Bota e 1 Avaliação
   - nº 2 criada uma vez só, com vencimento em +30 dias
   - nenhum plano de agregadora encerrado (ela não tem)
4. **Parar o próximo ciclo na hora:** cancelar pelo botão de admin (sem multa). Conferir que a nº 2 ficou cancelada e que `fn_recorrencia_2027_devidas` não traz a venda. A 08:00 do dia seguinte não cobra nada.
5. **Estorno:** pelo fluxo existente de estorno de mensalidade/venda (`estornar-cobranca`; o `rede-cancelar` marca a venda como estornada e o pagamento como `refunded`). Conferir na resposta da Rede e em `pagamentos_rede` o status `refunded` e o comprovante de estorno.
6. **Limpeza:** plano e créditos inativos e zerados (os créditos não saem sozinhos no estorno, por regra), contrato cancelado, cartão de teste desativado se a Bruna quiser. Depois, apagar a chave `semestral_teste_real` e tirar a Bruna da lista de teste.
7. **Depois:** a mesma foto do passo 1. Só podem ter mudado os registros do teste, todos inativos, cancelados ou estornados.

## O que fica registrado
- `pagamentos_rede`: 1 linha approved, depois refunded (tid, nsu, R$ 1,00), mais o comprovante de estorno.
- Venda estornada, contrato cancelado, nº 1 paga e estornada, nº 2 cancelada e logs em `system_logs` (`planos-semestral`).
- A trilha financeira não é apagada.

## Decisão pendente
- Pela regra de uma contratação por CPF, a venda paga deixa o CPF da Bruna bloqueado para o Semestral. Opções:
  - **(a)** manter (ela é só cadastro de teste);
  - **(b)** apagar a venda e o contrato de teste no fim, mantendo `pagamentos_rede` e o estorno.
- Recomendação: (a).
