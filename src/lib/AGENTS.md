- Importação de fatura de cartão: despesas usam origem_tabela='fatura_cartao' e origem_id = UUID derivado de SHA-256 (cartão+data+beneficiário+valor+parcela+ocorrência), para reimportar sem duplicar.
- PDFs de treino: a coluna CAT do aquecimento usa a regra compartilhada de ajuste de fonte e reticências, nunca quebra linha; por quê: manter todas as linhas com altura uniforme em todos os métodos.

- Pix agendado: a data escolhida fica em `despesas.pix_data_agendada`; `data_pagamento` só é preenchida na baixa, com a data confirmada pelo Inter. Por quê: despesa pendente com data_pagamento parece paga em outras telas.
- Valor a enviar por Pix = `despesas.valor_liquido_previsto ?? valor`; na folha `valor` JÁ É o líquido (com Comissão/DSR) e `valor_liquido_previsto` repete o mesmo valor por compatibilidade. `valor_pago` só nasce na baixa (Pix: sempre = `despesa.valor`, sem extrair valor "real" do Inter/extrato).
