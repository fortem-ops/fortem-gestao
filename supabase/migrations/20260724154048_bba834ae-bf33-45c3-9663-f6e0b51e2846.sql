UPDATE public.whatsapp_disparos_config
SET
  template_texto = '*%TIPO_SERVICO% de %DIA_SEMANA%, %DATA%, às %HORA_INICIO%:*
_Treinador(a): %NOME_PROFISSIONAL%_

✅Nome Completo: %NOME_ALUNO%
✅Data de nascimento: %DATA_NASCIMENTO%
✅Como conheceu a FORTEM? %COMO_CONHECEU%
✅Limitações / patologias / dores / lesões: %LIMITACOES%
✅Atividade física atual: %ATIVIDADE_FISICA%
✅Objetivo: %OBJETIVO%

📝 Observações: %OBSERVACOES%',
  variaveis_disponiveis = ARRAY[
    '%TIPO_SERVICO%','%DIA_SEMANA%','%DATA%','%HORA_INICIO%','%NOME_PROFISSIONAL%',
    '%NOME_ALUNO%','%DATA_NASCIMENTO%','%COMO_CONHECEU%','%LIMITACOES%',
    '%ATIVIDADE_FISICA%','%OBJETIVO%','%OBSERVACOES%'
  ]
WHERE nome = 'Treino Experimental → Profissional';