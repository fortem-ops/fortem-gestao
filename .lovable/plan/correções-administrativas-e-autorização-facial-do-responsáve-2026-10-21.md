# Correções administrativas e autorização facial do responsável

## Parte A
- Excluir equipe da consulta de Relatórios Técnicos, inclusive dos totais.
- Fazer a permissão de coordenação/admin respeitar perfis explicitamente desativados.
- Proteger o último admin considerando apenas administradores não desativados.

## Parte B
- Criar links válidos por sete dias, gerados exclusivamente pela equipe, com token armazenado apenas como hash.
- Receber autorização pública do responsável com termo definido pelo servidor, CPF validado e armazenado apenas como hash e últimos três dígitos.
- Criar página pública protegida contra indexação, envio de referência e analytics; manter o envio por WhatsApp apenas como abertura manual.
- Mostrar estado e geração/cancelamento na aba Facial compartilhada pela ficha do aluno e funcionário.
- Liberar envio da foto por menores apenas quando já houver autorização válida do responsável, sem novo consentimento.

## Verificação e limites
- Testes de permissões, estados dos links, validações e reserva da fila em transações revertidas.
- Conferir telas com dados simulados e contagens finais 227/1/1.
- Não alterar configuração facial, enviar mensagens, criar pedidos ou consentimentos reais, nem publicar o domínio.

## Detalhes técnicos
- Uma migration para B1 e correções A2/A3, com grants explícitos e funções SECURITY DEFINER de escopo público.
- Função pública facial-responsavel com limite de corpo, validação e RPCs exclusivas de service_role.
- Bloquear os carregadores de analytics existentes antes de executarem na nova página; demais páginas permanecem iguais.
