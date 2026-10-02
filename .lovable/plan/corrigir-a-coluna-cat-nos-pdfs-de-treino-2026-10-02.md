# Corrigir a coluna CAT nos PDFs de treino

## Objetivo
Garantir que nomes longos de categoria no aquecimento permaneçam sempre em uma única linha, sem aumentar a altura das linhas e sem reduzir a coluna de exercícios.

## Implementação
- Criar em `pdfShared.ts` uma regra compartilhada que calcula a fonte da coluna CAT conforme o maior nome da tabela, respeitando um mínimo legível e usando reticências quando ainda não couber.
- Aplicar essa regra aos blocos de aquecimento dos 12 métodos/fases, substituindo qualquer configuração que permita quebra de linha.
- Dar alguns milímetros extras à coluna CAT quando necessário, retirando esse espaço de colunas compactas como CARGA, sem espremer EXERCÍCIOS.
- Manter intactas as tabelas de força e o restante do layout.

## Validação
- Atualizar o cenário visual com categorias longas, incluindo “TORÁCICA ROTAÇÃO”, “ESTABILIDADE LOMBAR PA” e “QUADRIL-ISQUIOS”.
- Gerar os 12 PDFs reais e inspecionar visualmente ao menos Personalizado, Planilha 5RM e Mile Deep.
- Rodar o typecheck e o teste visual dos PDFs.
- Conferir o diff final disponível no ambiente.
