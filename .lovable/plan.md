# Reorganizar Pagamentos do portal

- Destacar uma única próxima cobrança, a mais próxima entre os contratos ativos, e o estado geral de atraso.
- Mostrar o cartão principal e recolher os demais controles em “Trocar”, preservando o cadastro de cartão.
- Simplificar cada contrato com título, progresso de parcelas, período e valor; ordenar o histórico com agendadas primeiro e pagas da mais recente para a mais antiga.
- Manter regularização por WhatsApp e aviso de nota fiscal.

## Limites técnicos
- Preservar integralmente as consultas existentes, mutations, `usePortalCartoes`, diálogo de cadastro, rotas e regras financeiras.
- Compartilhar somente os resultados já carregados pelos contratos para compor o destaque da tela, sem consultas novas.
- Aplicar os tokens e a fonte exclusivamente nesta tela do portal; verificar apresentação no celular e computador.
- Informar os arquivos alterados ao concluir.