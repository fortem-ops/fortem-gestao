# Corrigir "Confirmar reativação" que não faz nada

## O que acontece
Ao confirmar, o banco recusa a reativação: o registro de auditoria usa a operação "REATIVAR", que não está na lista permitida. Nada é salvo (o contrato do MACIEL continua encerrado). O aviso de erro também não aparece, porque a tela usa um tipo de aviso que não está ligado no app — por isso parece que "nada acontece".

## Correção
1. Recriar `fn_reativar_contrato` gravando no `audit_log` com operação `UPDATE` (permitida), mantendo o detalhe "reativação" nos dados registrados. Resto da função igual.
2. Em `ContratoFinanceiro.tsx`, trocar os avisos da reativação para `sonner` (o que o app mostra), para que sucesso e erro apareçam.
3. Conferir com uma chamada sem efeito que a função não falha mais; a reativação de verdade fica para você clicar.

Nada de cobranças, valores, Planos 1 e 2 ou flags muda.
