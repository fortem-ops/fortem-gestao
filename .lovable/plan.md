# Baixa manual com débito e bandeira para os recebíveis

## O que já existe (conferido)
- A lista "Forma de recebimento" já tem "Cartão de débito (máquina)" e "Cartão de crédito (máquina)" (vem pré-selecionada em Dinheiro, por isso talvez não tenha aparecido).
- A cobrança não guarda a bandeira: a tabela de cobranças só tem forma e gateway.
- Os recebidos do financeiro calculam a taxa do cartão sempre pela **bandeira padrão** da máquina e pela modalidade **crédito à vista**; débito não tem tratamento próprio (fica com taxa zero / sem prazo da adquirente).

## O que muda na tela de baixa
1. Ao escolher "Cartão de débito (máquina)" ou "Cartão de crédito (máquina)", aparece o campo **Bandeira** (VISA, MASTERCARD, ELO — a mesma lista do cadastro da adquirente), já com a bandeira padrão marcada. Obrigatório para confirmar.
2. No crédito na máquina, aparece também **Parcelas** (1x a 12x), padrão 1x, para escolher a taxa certa (à vista, 2–6x, 7–12x).
3. Dinheiro, Pix, Boleto e cartão online continuam como hoje, sem campos extras.
4. A mesma regra vale na baixa feita pela tela Financeiro > Contratos e na linha do tempo de cobranças, que usam a mesma lista.

## O que muda no financeiro (recebíveis)
- A cobrança passa a guardar bandeira e parcelas da baixa.
- Recebidos/recebíveis usam essas informações: débito na máquina usa a taxa e o prazo de **débito** da bandeira escolhida; crédito usa a modalidade conforme as parcelas; sem bandeira gravada (baixas antigas) continua o cálculo atual pela bandeira padrão — nada do histórico muda de valor.

## Testes
- Débito VISA aplica a taxa de débito VISA; crédito 3x aplica 2–6x; baixa antiga sem bandeira mantém o cálculo atual; Dinheiro/Pix não pedem bandeira; botão bloqueado sem bandeira no cartão.
- `bunx vitest run` e eslint dos arquivos alterados.

## Detalhes técnicos
- Migration aditiva: `cobrancas.bandeira text NULL`, `cobrancas.parcelas_cartao smallint NULL` (check 1–12).
- `src/lib/formasRecebimento.ts`: marcar formas `maquina_*` como `exigeBandeira`; helper `modalidadeAdquirente(forma, parcelas)` → `debito | credito_vista | credito_2_6x | credito_7_12x`.
- `ContratoFinanceiro.tsx`, `Contratos.tsx`, `TimelineCobrancas.tsx`: campos condicionais e gravação de `bandeira`/`parcelas_cartao` no update; propagar a bandeira para a venda vinculada quando ela ainda estiver "a definir".
- Recriar `vw_recebidos_periodo` (e a perna de mensalidades dos previstos, se aplicável) juntando `adquirentes_taxas` por `COALESCE(cb.bandeira, cfg.bandeira_padrao)` e pela modalidade derivada; ler `src/lib/AGENTS.md` antes.
- A loja (`DarBaixaPedidoDialog`) fica fora, salvo pedido.
