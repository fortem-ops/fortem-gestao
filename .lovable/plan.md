# Motivo exato da recusa do cartão, em português

## Resposta (já consultado)
Cobrança de Rafaela Lima Oliveira, 28/10/2026 15:57, R$ 579,00 à vista, cartão final 3161:
- Código da Rede: **111**
- Mensagem: "Unauthorized. Insufficient funds." → **Saldo/limite insuficiente**.
Não é erro do sistema; o banco da aluna negou. As cobranças anteriores (R$ 479 e R$ 100) no mesmo cartão foram aprovadas.

## Proposta
A janela de cobrança já mostra a mensagem da Rede, mas em inglês e curta. Mudar para:
- Texto em português com o que fazer, ex.: "Recusada pelo banco: saldo ou limite insuficiente (código 111). Peça à aluna para liberar limite ou usar outro cartão."
- Mesma tradução no histórico de tentativas (Financeiro > Cartões) e na tela do aluno.
- Códigos desconhecidos: mostrar a mensagem original da Rede + código, nunca esconder.

## Detalhes técnicos
- Novo `src/lib/redeRetornos.ts` com mapa dos códigos de retorno da Rede (101–124, 51, 57 etc.) → texto PT-BR + orientação; teste para 111 e código desconhecido.
- Usar em `PagarCartaoDialog.tsx`, `CartoesCredito.tsx`, `PedidosTab.tsx`. Somente exibição; nenhuma mudança em cobrança, retentativa ou banco.
