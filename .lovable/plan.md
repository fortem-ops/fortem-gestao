# Adicionar chaves da AWS

## O que será feito
1. Conferir se já existem chaves AWS salvas no projeto (para não duplicar).
2. Abrir o formulário seguro para você colar os valores (eles não passam pelo chat):
   - `AWS_ACCESS_KEY_ID` (começa com `AKIA` ou `ASIA`)
   - `AWS_SECRET_ACCESS_KEY` (par obrigatório da chave acima)
   - `AWS_REGION` (ex.: `sa-east-1`), se ainda não houver
3. Nenhum código é alterado nesta etapa; as chaves só ficam guardadas para uso futuro nas funções do servidor.

## Onde obter
No console da AWS: IAM → Usuários → seu usuário → Credenciais de segurança → Criar chave de acesso. Dê ao usuário só as permissões necessárias.

## Dúvida
Para qual serviço da AWS será usada (S3, SES, Rekognition...)? Isso define as permissões mínimas e o próximo passo.
