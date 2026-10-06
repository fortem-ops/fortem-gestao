# Plano: convite público FORTEM 10 anos

## Objetivo
Criar a experiência pública em `/10anos` e a lista interna de confirmações, sem alterar fluxos existentes do sistema.

## Página pública
- Adicionar a rota pública com carregamento sob demanda, fora do login e do layout interno.
- Criar uma página mobile-first, escura, minimalista e alinhada à identidade FORTEM, com logo existente, tipografia atual e animações discretas que respeitam redução de movimento.
- Montar as seções na ordem solicitada: abertura, história, festa, confirmação e rodapé.
- Centralizar data, local, horário, atrações, Instagram, textos e os seis marcos de exemplo em `src/config/festa10anos.ts`.
- Usar seis imagens neutras locais como placeholders, declaradas no mesmo arquivo de configuração e com dimensões/lazy-loading.
- Aplicar metadados específicos para título, descrição, canonical e compartilhamento social.

## Confirmação de presença
- Criar formulário acessível com nome, WhatsApp brasileiro, e-mail opcional, vínculo e até três acompanhantes removíveis.
- Validar no navegador com Zod, normalizar o WhatsApp para somente dígitos e incluir honeypot invisível.
- Enviar somente os campos permitidos para o banco, com estado de carregamento e mensagens em português.
- Tratar WhatsApp já cadastrado sem consultar ou expor dados: exibir apenas a mensagem amigável solicitada.
- Após sucesso, substituir o formulário pelo agradecimento e total de pessoas confirmadas.

## Banco e segurança
- Criar `festa_confirmacoes` com tipos, defaults, índice único de WhatsApp e limites estruturais para nome, WhatsApp, e-mail, vínculo, acompanhantes e total de pessoas.
- Dar ao público somente permissão de inserção e uma política de INSERT com validação integral da linha; nenhuma leitura, alteração ou exclusão anônima.
- Permitir leitura a staff autenticado e exclusão apenas ao nível administrativo/CRM já adotado pelo projeto, usando as funções de papel existentes.
- Conceder apenas os privilégios necessários, com RLS ativa desde a criação.

## Tela interna
- Adicionar `/festa-10-anos/confirmacoes` dentro do layout protegido.
- Mostrar totais de confirmações e pessoas, busca por nome, tabela com os campos pedidos, exportação CSV e exclusão com confirmação.
- Adicionar “Festa 10 anos” discretamente no grupo Comercial, visível para coordenadores e administradores, como a área administrativa/CRM atual.

## Integração e validação
- Registrar as duas páginas no roteamento sem tocar nas demais rotas.
- Atualizar a decisão estrutural do projeto para documentar que o conteúdo editável da festa fica isolado no arquivo de configuração.
- Validar compilação, segurança da tabela e os fluxos essenciais em desktop e celular: envio público, duplicidade sem vazamento, consulta interna, busca, CSV e exclusão confirmada.

## Premissas
- “Quem já enxerga a área administrativa/CRM” corresponde a coordenadores e administradores (`isCoordAdmin`).
- A leitura interna será para staff; a exclusão seguirá o nível coordenador/admin exibido no menu, evitando ampliar privilégios de professores.
- O Instagram será preenchido com o perfil já existente no projeto; se nenhum perfil estiver registrado, ficará editável no arquivo de configuração sem inventar um endereço.
