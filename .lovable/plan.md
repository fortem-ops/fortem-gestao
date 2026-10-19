# /corrida: opção de não incluir prova(s)

## O que muda
Hoje, no plano Anual, a inscrição NB 42k 2027 com 50% OFF entra automaticamente no pedido, sem como tirar. A MIPOA já é opcional.

- No passo "Suas provas", o bloco da NB vira uma escolha que pode ser ligada/desligada (igual à MIPOA), começando ligada como hoje.
- Novo botão "Não quero incluir provas": desliga NB e MIPOA de uma vez.
- Sem nenhuma prova escolhida: o resumo e o total não mostram prova, e o passo "Inscrição" (dados da prova) não aparece — o visitante segue só com o plano.
- O aviso de vagas restantes só aparece com a NB ligada.

Nada muda em preços, kits, avaliação, rota "só provas" (que continua exigindo ao menos uma prova) nem no pagamento.

## Detalhes técnicos
- `CorridaConfigurator.tsx`: novo estado `incluirNb` (padrão `true`, reiniciado em `escolherRota`); `provasPedido` só inclui NB se `incluirNb`; `renderProvas` usa `Toggle` para a NB e botão "Não quero incluir provas" (`setIncluirNb(false); setMipoa(false)`); passar `incluirNb` para o resumo e para `pedido_resumo`.
- `corridaPreco.ts`: `ResumoParams` ganha `incluirNb?: boolean` (padrão `true`); a linha da NB só entra quando ligada.
- Teste em `corridaPreco.test.ts`: Anual com `incluirNb: false` não soma a NB ao total.
