# Decisões técnicas

- A conclusão do lembrete de Avaliação Funcional deve ser inferida pelo conteúdo de `avaliacoes.dados` em registros `funcional_v2`, mantendo suporte aos tipos legados; o tipo sozinho não representa as partes preenchidas.- Categorias de despesa: lançamentos novos só usam categorias com `nivel` (central/sub); `nivel` nulo = categoria antiga, mantida só para histórico/filtros. Por quê: preservar lançamentos antigos sem poluir o cadastro novo.
- Importação de fatura de cartão: despesas usam origem_tabela='fatura_cartao' e origem_id = UUID derivado de SHA-256 (cartão+data+beneficiário+valor+parcela+ocorrência), para reimportar sem duplicar.
- PDFs de treino: a coluna CAT do aquecimento usa a regra compartilhada de ajuste de fonte e reticências, nunca quebra linha; por quê: manter todas as linhas com altura uniforme em todos os métodos.
- Pagamentos Pix (Inter Banking v2) só saem pela função `enviar-pagamentos-pix`, Admin-only e após confirmação na tela; a baixa vem de `verificar-pagamentos-pix-diario` (agendada, só consulta). Por quê: nenhum dinheiro sai sem confirmação humana e o status do Inter é a fonte da verdade.
- Pix agendado: a data escolhida fica em `despesas.pix_data_agendada`; `data_pagamento` só é preenchida na baixa, com a data confirmada pelo Inter. Por quê: despesa pendente com data_pagamento parece paga em outras telas.
