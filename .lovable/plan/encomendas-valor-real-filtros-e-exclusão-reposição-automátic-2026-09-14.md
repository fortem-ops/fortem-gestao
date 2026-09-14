# Encomendas: valor real, filtros e exclusão + reposição automática

## 1. Valor real recebido em Encomendas

Hoje a tela soma o preço dos itens, ignorando cupom. O pedido de teste com o cupom N100 tem R$ 260 em itens, R$ 260 de desconto e R$ 0 efetivamente recebido — por isso aparece o valor cheio.

Mudanças:
- Passar a exibir duas colunas: "Valor dos itens" e "Valor recebido".
- O valor recebido de cada linha é calculado proporcionalmente ao valor final do pedido (itens que vieram de um pedido 100% gratuito aparecem como R$ 0,00).
- Subtotais por modelo e um total geral no rodapé usando o valor recebido.
- Marcar visualmente pedidos cobertos por cupom (etiqueta com o código usado).

## 2. Filtros na página

Barra de filtros acima da tabela:
- Busca por texto (cliente, modelo, cor, tamanho).
- Período (data inicial e final).
- Seletores de modelo, cor e tamanho, preenchidos a partir das encomendas existentes.
- Valor recebido: todos / somente pagos / somente gratuitos.
- Botão para limpar filtros e contador de resultados.

Os filtros atuam sobre as linhas já carregadas, mantendo o agrupamento por modelo.

## 3. Excluir pedidos

Exclusão disponível para qualquer pedido, sempre com confirmação nomeando cliente, itens e valor, e restrita a Coordenação e Administração.

Ao excluir:
- Devolve ao estoque o que estava reservado (usando a rotina de reversão já existente) quando o pedido ainda não foi retirado.
- Remove os registros de tentativa de pagamento (cartão e PIX) ligados ao pedido, que hoje impedem a exclusão.
- Devolve o uso do cupom, se havia cupom aplicado.
- Remove o pedido e seus itens.
- Atualiza a tela e mostra confirmação.

A ação fica tanto na aba Pedidos quanto na aba Encomendas.

## 4. Reposição automática ao remover aluno de um horário

Regra: ao remover o aluno de um horário, o crédito do serviço contratado volta para ele, ficando disponível para remarcar.

- Agenda de serviços: a devolução já acontece por regra do banco; será tornada explícita, registrando o movimento como "Reposição — horário removido" e garantindo que também ocorra quando o horário é removido só naquele dia (exceção de recorrência).
- Agenda de treinos: a exclusão pelo staff passa a devolver o crédito por padrão, sem depender de marcar a opção, e registra a reposição.
- Confirmação na tela informando que a reposição ficou disponível para o aluno.
- Se o horário não tinha crédito debitado (por exemplo, cortesia), nada é devolvido e a mensagem avisa isso.

## Detalhes técnicos

- `src/components/loja/EncomendasTab.tsx`: consulta passa a trazer `valor_total`, `desconto`, `valor_final`, `status` e o código da promoção; rateio proporcional por item; estado de filtros com `useMemo`.
- Exclusão: nova função no banco `fn_loja_excluir_pedido(p_pedido_id uuid)` com `SECURITY DEFINER`, restrita a `is_coordinator_or_admin`, reaproveitando `fn_loja_reverter_reserva`, apagando `pagamentos_rede`/`pix_cobrancas` do pedido, decrementando `promocoes.uso_atual` e removendo `pedidos` (itens caem por cascade). Chamada via `supabase.rpc` em `EncomendasTab.tsx` e `PedidosTab.tsx`.
- Reposição: `fn_agenda_estornar_credito` passa a gravar observação "Reposição"; novo gatilho para `agenda_servicos_excecoes` devolvendo crédito do dia removido; `fn_staff_excluir_treino_agendamento` com `p_estornar` padrão `true` e registro do estorno em `ciclos_credito`; ajuste do texto de confirmação em `src/pages/AgendaTreinos.tsx` e `src/pages/Agenda.tsx`.
- Sem alterações na vitrine pública da Loja, no checkout ou nas políticas de acesso existentes.
