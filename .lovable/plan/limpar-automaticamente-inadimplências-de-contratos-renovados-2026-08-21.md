# Limpar automaticamente inadimplências de contratos renovados

## Diagnóstico confirmado

O painel está correto em relação aos dados atuais: ele lista 77 cobranças ainda marcadas como `atrasado`, somando R$ 38.845,25. Os pagamentos mais recentes foram registrados em novos contratos e não deram baixa nas cobranças vencidas dos contratos anteriores.

Exemplos confirmados:

- Eric: agosto está pago, mas julho pertence a outro contrato e continua atrasado.
- Maurício: o contrato anual novo está pago, mas restou uma parcela vencida no contrato anterior cancelado.
- Vítor: existem cobranças atrasadas em contratos anteriores cancelados.
- Carla: o contrato atual ainda possui uma cobrança vencida real; somente o débito do contrato anterior encerrado entra na limpeza automática.

## Regra aprovada

Ao confirmar um pagamento de renovação, cancelar automaticamente débitos vencidos de contratos anteriores quando todos estes critérios forem verdadeiros:

1. o contrato antigo pertence ao mesmo aluno;
2. é do mesmo tipo de plano do contrato pago;
3. começou antes do contrato pago;
4. está `encerrado` ou `cancelado`;
5. a cobrança antiga ainda está `atrasado`;
6. a inadimplência correspondente ainda está `aberta`.

Não cancelar cobranças do contrato atual, contratos paralelos de outro tipo, nem contratos antigos ainda ativos. Isso preserva cobranças realmente devidas e o suporte a múltiplos contratos, inclusive Corrida.

## Implementação

1. Criar uma rotina transacional no banco acionada quando uma cobrança muda para `pago`.
2. Nessa rotina:
   - localizar apenas cobranças antigas que atendam aos critérios acima;
   - marcar essas cobranças como `cancelado`;
   - marcar as inadimplências correspondentes como `cancelada`;
   - preservar os registros para auditoria, sem exclusão física.
3. Aplicar a mesma regra retroativamente aos dados existentes. A consulta atual identificou 8 inadimplências, totalizando R$ 3.095,75; a lista será recalculada imediatamente antes da correção.
4. Manter o painel consumindo apenas inadimplências abertas. Os fluxos de baixa já invalidam esse cache, então a contagem será atualizada após o pagamento.

## Validação

- Confirmar que os 8 registros elegíveis deixam o painel após a correção.
- Confirmar que a cobrança atual vencida da Carla continua visível.
- Confirmar que uma nova baixa cancela somente débitos do contrato anterior equivalente.
- Confirmar que contratos paralelos, contratos atuais e planos de tipos diferentes não são afetados.
- Rodar o linter de segurança do banco após a alteração.
