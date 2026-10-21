# /10anos — R$ 75 por pessoa

## Mudanças
- Trocar os dois preços por um único valor de 7500 centavos: convidado e acompanhantes custam o mesmo; crianças continuam isentas e sem cadastro.
- Atualizar a página pública, resumo do formulário e inclusão manual da equipe. Mostrar 1 pessoa = R$ 75, 2 = R$ 150 e 4 = R$ 300; Equipe10 continua zerando tudo.
- Recalcular novas confirmações no servidor, inclusive inclusões manuais. O PIX, webhook e consulta de conciliação usarão esse total e recusarão valores divergentes.
- Preservar os totais históricos nas edições e nos pagamentos de confirmações existentes, sem reajuste silencioso.
- Revisar textos e fórmulas da festa e rodar testes de cálculo e validação de pagamento, sem cobranças ou mensagens reais.

## Confirmações existentes conferidas
- **Zero confirmações aguardando pagamento** com valores antigos.
- Duas confirmações isentas e duas canceladas; nenhuma será alterada.
- O registro de teste de Nicolas tem PIX de **R$ 70,00**, txid `FESTA10iYvufKPkGh9CWMgVCSL9dzgYH`, QR armazenado e prazo registrado até 09/11/2026 00h de Brasília. A confirmação já consta como cancelada; o estado atual no banco Inter não foi consultado. Não cancelar nem alterar esse PIX.

## Detalhes técnicos
- Configuração pública com um único campo de preço; regra de servidor compartilhada no fluxo isolado da festa.
- Garantir cálculo de novas inclusões manuais no servidor com validação de inserção em `festa_confirmacoes`, aplicada por migration, sem atualizar linhas existentes.
- A baixa compartilhada do webhook/conciliação continua validando contra o total calculado e registrado na criação; não reprecificar históricos com a tarifa atual.
- Proteger o valor histórico ao editar confirmações existentes na tela da equipe; totais a receber/recebidos seguem os valores armazenados.
- Testar valores concretos, voucher e recusa de pagamento divergente com simulações, além de conferir que registros existentes permanecem iguais.

## Fora do escopo
Não publicar o site. Não alterar Planos 1 e 2, flags, contratos, cobranças de outros módulos, recorrência ou dados históricos. Não gerar, pagar ou cancelar PIX real nos testes.

**Aprovação necessária:** esta mudança altera o cálculo de cobrança da festa; a implementação começa após aprovação deste plano.