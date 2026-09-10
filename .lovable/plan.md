# Upload de imagens da Loja

## Objetivo
Substituir os campos de endereço de imagem por seleção de arquivo, mantendo links já salvos funcionando normalmente.

## Implementação
1. Criar o bucket público `loja-produtos`, com limite de arquivo adequado para imagens.
2. Adicionar políticas de acesso:
   - leitura pública para visitantes e usuários autenticados;
   - envio, substituição e exclusão somente para Coordenador e Administrador.
3. Criar um controle reutilizável de upload com:
   - seleção exclusiva de imagens;
   - validação de tipo e tamanho antes do envio;
   - prévia da imagem atual ou recém-enviada;
   - indicador de envio e mensagem clara em caso de falha.
4. No cadastro de produto, enviar para `produtos/{id-ou-id-temporario}/{timestamp}-{arquivo}` e gravar a URL pública em `imagem_url`.
5. Nas variantes, exibir o upload somente quando houver cor e enviar para `produtos/{produto_id}/variantes/{cor}-{timestamp}-{arquivo}`.
6. Impedir salvar/adicionar enquanto uma imagem estiver sendo enviada, evitando registros com upload incompleto.

## Compatibilidade e validação
- URLs antigas continuam sendo usadas como prévia sem migração de dados.
- A criação de produto usará um identificador temporário estável durante o formulário.
- Validar as políticas e a configuração pública do bucket no backend.
- Rodar a verificação de tipos e confirmar o build da aplicação.
