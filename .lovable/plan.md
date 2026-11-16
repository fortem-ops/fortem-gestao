# Corrigir links de pagamento que "expiram" após cartão recusado

## Problema confirmado
Os dois pontos do servidor que abrem e cobram o link de pagamento tratam a venda com status "falha" (cartão recusado) como encerrada:
- abrir o link mostra "expirado";
- tentar cobrar devolve "link expirado".

Com isso o cliente não consegue tentar outro cartão, e um link novo gerado pela equipe em "Gerar link" já abre expirado. Afeta todos os links (Corrida, planos, VIP etc.), não só o Semestral.

## Correção proposta
- Só "cancelado" e "estornado" encerram o link. "falha" volta a permitir nova tentativa, como era antes.
- Nada muda para vendas já pagas (continua bloqueado cobrar de novo) nem para canceladas/estornadas.
- A trava contra cobrança dupla continua igual.

## Detalhes técnicos
- `_shared/semestral-link.ts`: `vendaEncerrada` passa a usar `["cancelado","estornado"]`.
- `validar-link-pagamento/index.ts`: trocar a lista fixa pela função `vendaEncerrada`.
- Teste de regressão: `vendaEncerrada("falha") === false`, `("cancelado")`/`("estornado") === true`.
- Rodar `bunx vitest run` + eslint e republicar as duas funções.
