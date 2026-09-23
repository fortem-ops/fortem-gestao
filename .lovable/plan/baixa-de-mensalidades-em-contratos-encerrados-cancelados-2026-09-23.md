# Baixa de mensalidades em contratos encerrados/cancelados

## Por que não dá para dar baixa hoje

Na aba Contrato do aluno, o botão "Dar baixa" aparece só na tabela de cobranças dos contratos **ativos**. Contratos encerrados ou cancelados vão para "Histórico de contratos", que mostra apenas uma linha de resumo, sem as cobranças. Os 5 inadimplentes do Início têm justamente a mensalidade em aberto num contrato já encerrado ou cancelado, então o botão nunca aparece para eles.

| Aluno | Vencimento | Valor | Contrato |
|---|---|---|---|
| Carla Cimone Portes Rodrigues | 11/07/2026 | R$ 579 | Encerrado |
| Patricia Tirelli Lena | 12/07/2026 | R$ 379 | Encerrado |
| Carolina Guerra Baião | 01/08/2026 | R$ 379 | Cancelado |
| Jean Rodrigues da Silva | 04/08/2026 | R$ 379 | Encerrado |
| Gabrieli Lazzari Vieira | 18/08/2026 | R$ 379 | Encerrado |

## O que vou fazer

1. **Tela do aluno > Contrato > Histórico de contratos**: quando um contrato antigo tiver mensalidade pendente, atrasada ou estornada, o cartão dele mostra um aviso "X mensalidade(s) em aberto" e a lista dessas mensalidades, cada uma com o botão **Dar baixa**. Só administrador e coordenação veem o botão, igual aos contratos ativos.
2. A baixa usa exatamente o mesmo diálogo e a mesma gravação dos contratos ativos: escolha da forma (incluindo "Cartão de crédito online"), data do pagamento, fechamento automático da inadimplência e atualização da venda ligada. Depois da baixa, o quadro de Inadimplentes do Início se atualiza sozinho.
3. Nenhuma baixa será dada automaticamente. Com a tela pronta, você mesmo dá baixa nos 5 alunos como "Cartão de crédito online", na data certa de cada pagamento. Se preferir, posso gravar os 5 por aqui depois: é só me passar as datas de pagamento.

Fora do escopo: contratos ativos, estorno, cobrança automática, operadora do cartão e regras do quadro de Inadimplentes, que continuam como estão.

## Detalhes técnicos

- `src/pages/alunos/ContratoFinanceiro.tsx`: no bloco do histórico, buscar as cobranças com status pendente/atrasado/estornado dos contratos do histórico, com a query key `cobrancas-contrato` por contrato para reaproveitar as invalidações que já existem. Renderizar as linhas com botão que chama o `pedirBaixa` que já existe, passando `podeCancelar`.
- `handleBaixa` fica como está. Ele já grava a cobrança como paga (meio manual_admin; tid nulo se estava estornada), regulariza a inadimplência, propaga para a venda e invalida `["inadimplencias","abertas"]`. Vou só acrescentar a invalidação das cobranças do histórico.
- Verificação: tipos/build e teste do diálogo de baixa num contrato encerrado (renderizar o botão e chamar o update). Sem gravar nada em produção nos testes.
