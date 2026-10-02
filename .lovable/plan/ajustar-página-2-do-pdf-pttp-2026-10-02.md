# Ajustar página 2 do PDF PTTP

## Implementação
- Reorganizar a página 2 para começar pelas duas progressões lado a lado, cada uma com título e colunas próprias.
- Ampliar o histórico futuro além das 8 linhas atuais, calculando a quantidade para aproveitar a página sem cortar o bloco de instrução.
- Exibir a instrução da rampa em um bloco mais legível, com quebra de texto e proteção contra quebra de página.
- Mover os Treinos 1–4 para depois das progressões e listar somente os três auxiliares, preservando `CAT | EXERCÍCIO | SÉRIES/REPS | KG | CARGA`.

## Validação
- Gerar o PDF PTTP real de teste e converter todas as páginas em imagens.
- Conferir visualmente títulos, linha divisória, colunas, quantidade de registros, instrução completa e ausência dos levantamentos centrais nos treinos.
- Rodar o typecheck, o teste de geração dos PDFs e revisar o diff final.

## Premissa de layout
A página 2 será reservada às progressões e à legenda quando o conteúdo ocupar sua altura; os treinos auxiliares continuarão nas páginas seguintes, mantendo a ordem solicitada.
