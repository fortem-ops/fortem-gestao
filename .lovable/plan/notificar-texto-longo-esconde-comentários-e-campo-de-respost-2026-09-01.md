# Notificar: texto longo esconde comentários e campo de resposta

## Problema confirmado

Na tela Notificar, o painel de detalhe (`NotificacaoDetail.tsx`) tem 3 blocos empilhados em coluna: cabeçalho (título + descrição completa), lista de comentários e barra de resposta. O cabeçalho não tem limite de altura nem scroll próprio: quando a descrição é longa (como a ata da reunião do grupo de corrida), ele cresce e empurra a lista de comentários e o campo "Comentário..." para fora do container, que tem altura fixa (`md:h-[calc(100vh-260px)]`) e `overflow-hidden` em `Notificar.tsx` — por isso somem da tela.

## Correção

1. **Cabeçalho com altura limitada e scroll próprio**: o bloco de cabeçalho passa a ser `shrink-0` e a descrição fica dentro de uma área com altura máxima (aprox. 40% do painel) e rolagem vertical própria, preservando quebras de linha do texto original.
2. **Área de comentários sempre visível**: adicionar `min-h-0` à região de comentários para que ela ceda espaço corretamente no flex e nunca seja empurrada para fora.
3. **Barra de resposta fixa no rodapé**: garantir que o bloco do campo de comentário seja `shrink-0`, permanecendo sempre visível na base do painel.
4. **Mobile**: no celular o painel não tem altura definida; definir uma altura mínima para o detalhe para que comentários e campo de resposta apareçam sem depender da altura da descrição.

## Detalhes técnicos

- `src/components/notificar/NotificacaoDetail.tsx`: `shrink-0` no header e no rodapé; envolver `{n.descricao}` em um wrapper com `max-h-[35vh] overflow-y-auto pr-1`; `min-h-0` no `ScrollArea` de comentários.
- `src/pages/Notificar.tsx`: adicionar altura mínima no container do detalhe para telas pequenas (`min-h-[70vh] md:min-h-0`).
- Sem mudanças de dados, backend ou lógica de negócio.
