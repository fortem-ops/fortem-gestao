# Exercício do Gustavo que não aparece em Preventivo > Ombro

## O que foi encontrado
- O exercício está gravado corretamente no Banco de Exercícios, com o nome **"F2 - Rot. externa de ombros em abdução + press HSR"** (não "F2 Rotação externa de ombro...").
- Ele está em dois lugares: Aquecimento > Ativação Muscular > Ombro/Escápula e Aquecimento > Preventivo > Ombro (mesma categoria e subcategoria dos outros 22 exercícios que aparecem ali).
- Criado às 16:12 e alterado às 16:15 (horário de Brasília). É provável que o vínculo com Preventivo > Ombro tenha entrado só na segunda gravação, pouco antes do relato.
- O seletor do treino lista tudo de Preventivo > Ombro e filtra pelo que é digitado. Digitando "rotação", ele não acha, porque o nome salvo usa "Rot.".

## Causa mais provável (não confirmada na tela)
1. Busca por "rotação" com o nome salvo como "Rot."; ou
2. Teste feito antes da segunda gravação, que incluiu Preventivo > Ombro.

## Proposta
1. Pedir ao Gustavo para abrir o bloco Preventivo > Ombro, sem digitar nada (ou digitando "HSR" ou "rot"), e conferir se o exercício aparece. Nenhuma mudança no sistema.
2. Melhoria opcional na busca do seletor de exercícios: ignorar acentos e maiúsculas e aceitar parte de cada palavra em qualquer ordem (ex.: "rot ext ombro" acha "Rot. externa de ombros"). Só a busca muda; o cadastro e a montagem do treino ficam iguais.
3. Opcional: renomear o exercício para o nome que ele usa ("F2 Rotação externa de ombro em abdução + press HSR"), se ele preferir.

## Detalhes técnicos
- Dados: `exercicios_personalizados.id = 3f172d0b-...`, `grupos` contém `{grupo: Aquecimento, categoria: Preventivo, subcategoria: Ombro}`; `exercicio_categorias` tem a mesma subcategoria `Ombro` (PREV).
- Seletor: `src/components/student/workout/ExerciseSelector.tsx` filtra por `itemCasaAlvo` e depois `nome.toLowerCase().includes(query)`. A melhoria 2 troca esse filtro por uma comparação normalizada (NFD sem acentos) por termos, com teste unitário.
