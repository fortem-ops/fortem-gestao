# Reativar contrato vencido com novo término

## Caso atual
MACIEL GOELZER: contrato de 17/10/2025 a 17/10/2026 ficou "encerrado" e o plano inativo. Existe também um contrato "cancelado" com as mesmas datas, que não será tocado.

## O que será feito
1. Na aba Pagamentos do aluno, contratos **encerrados** ganham o botão **Reativar contrato** (só coordenação/admin).
2. A janela pede a **nova data de término**, já preenchida com o último dia do mês atual (ex.: 31/10/2026). A data precisa ser depois do término antigo. Campo opcional de motivo.
3. Ao confirmar (com aviso antes):
   - o contrato volta para **ativo** com o novo término;
   - o plano ligado volta a **ativo**, com o mesmo término e a próxima renovação nessa data;
   - fica registrado quem reativou, quando, o término antigo e o novo.
4. Contratos **cancelados** (rescisão) não podem ser reativados por esse botão.

## O que NÃO muda
Nenhuma cobrança é criada, apagada ou enviada para a Rede; nenhum valor muda. Se o período extra precisar ser cobrado, a equipe lança à parte. Planos 1 e 2 e flags intocados.

## Detalhes técnicos
- Função no banco `fn_reativar_contrato(contrato_id, nova_data_fim, motivo)` SECURITY DEFINER, verifica coordenador/admin, exige status = 'encerrado' e nova data > data_fim; atualiza `contratos` e `planos` (ativo, data_fim, proxima_renovacao) e grava em `audit_log`/`system_logs`.
- Botão e diálogo em `ContratoFinanceiro.tsx`; invalidar consultas de contrato, plano e status do aluno.
- Teste da regra da data padrão (último dia do mês) e da validação "depois do término antigo".
- Conferir no Maciel após aplicar (só se você aprovar reativá-lo).
