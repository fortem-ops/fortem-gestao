# Digitar a data em "Cliente desde (de/até)" — Disparos avulsos, passo Público

## O que muda
- Cada um dos dois campos passa a ser uma caixa de texto onde se digita a data no formato dd/mm/aaaa, com máscara automática (as barras entram sozinhas).
- Ao lado da caixa fica um ícone de calendário que abre o mesmo calendário de hoje, para quem preferir clicar.
- A data só é aplicada ao filtro quando estiver completa e for válida (ex.: 31/02/2026 é recusada). Enquanto estiver incompleta ou inválida, o filtro não muda e a borda fica vermelha.
- Apagar o texto limpa o filtro, igual ao botão "limpar", que continua existindo.
- Escolher no calendário preenche a caixa.

## Fora do escopo
- Nenhuma outra tela (a lista de alunos continua igual), banco, envio, regras de seleção ou exclusão.

## Detalhes técnicos
- Só em `src/components/disparos/DisparosAvulsos.tsx` (bloco das datas, função `Publico`) e em `src/lib/disparos.ts`.
- Nova função pura `brParaIso("dd/mm/aaaa") -> "aaaa-mm-dd" | null` (valida dia/mês/ano reais) e `mascararDataBr(texto)`; testes Vitest com casos válidos, 31/02, incompleto e vazio.
- Pequeno componente local de campo de data com o texto em estado próprio, sincronizado quando o valor ISO muda por fora (calendário/limpar). O valor do filtro continua ISO, então seleção, rascunho e resumo não mudam.
- Rodar a suíte e a compilação.
