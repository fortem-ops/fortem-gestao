# Redesenho mobile das avaliações no Portal do Aluno

## Resultado no portal

- Substituir a apresentação funcional atual por uma tela mobile-first com o título **Minha avaliação** e a data mais recente.
- Manter o estado sem avaliação e o convite para agendar; quando houver avaliação, retirar da experiência principal a tabela antiga e qualquer classificação Fraco/Regular/Médio/Bom/Excelente.
- Usar apenas verde, âmbar e coral para assimetria, com os nomes **Equilibrado**, **Atenção** e **Prioridade**.

## Conteúdo inicial

1. Criar um cartão de resumo com:
   - quantidade de pontos para acompanhar;
   - maior diferença entre lados;
   - quantidade de medidas equilibradas;
   - estado “Tudo equilibrado” quando não houver atenção.
2. Exibir três anéis por camada — Mobilidade, Flexibilidade e Força — mostrando `pontos / total`, com arco proporcional e cor do pior nível; camada sem dado mostra “—”.
3. Preservar o mapa corporal, suas camadas e vistas, em uma composição própria do portal que não exiba os anéis antigos de Simetria/Estabilidade.
4. Exibir “Pontos de atenção” somente para medidas em Atenção ou Prioridade, ordenadas por nível e pela diferença normalizada pelo corte severo.

## Cartões recolhidos

- **Todas as medidas:** métricas e força no formato compacto E/D + diferença, incluindo equilibradas, com legenda dos cortes e nota específica do Psoas.
- **Evolução:** disponível com duas ou mais avaliações; reutiliza os cálculos da aba Evolução, mostra tendência, troca do lado mais fraco, mini-gráfico temporal com faixas e valor atual. Sem força, mostra a mensagem solicitada.
- **Comparativo:** última contra anterior; reutiliza o módulo Comparativo, filtra apenas métricas com mudança em algum lado, resume as sem mudança e trata força pelo corte provisório já existente.
- **Relação entre regiões:** mostra cadeias compensatórias únicas por texto e desaparece quando não houver conteúdo.
- **Como me comparo com a base Fortem:** curvas compactas com sexo e faixa etária; sem sexo, mostra indisponibilidade.

## Reutilização e limites

- Criar funções puras exclusivas de composição do portal, consumindo `classificarAssimetria`, `nivelAssimetria`, helpers de `assimetriaGrafico` e `comparativoValores`; nenhuma regra clínica será duplicada ou alterada.
- Usar nomes de tela compartilhados, ajustando a pontuação visual para o formato “Quadril · Rotação Interna” apenas no portal.
- Não alterar telas da equipe, limiares, classificações, mapa vetorial ou motor de avaliação.
- Preservar composição corporal fora do novo bloco funcional; o histórico funcional antigo deixa de repetir a tabela detalhada, pois Evolução e Comparativo passam a concentrar essa leitura.

## Celular e acessibilidade

- Garantir largura de 390 px sem rolagem horizontal, textos sem corte e controles com no mínimo 44 px.
- Manter o tema escuro e os tokens visuais existentes do portal.
- Cartões recolhidos terão título, descrição curta, indicador de expansão e estado acessível.

## Testes e verificação

- Testar funções puras para:
  - frase de resumo com e sem pontos;
  - anéis por camada, inclusive força sem dados;
  - deduplicação de cadeias por texto;
  - filtro “só o que mudou” do comparativo.
- Rodar o typecheck e a suíte completa sem ajustar expectativas clínicas para mascarar falhas.
- Conferir visualmente em 390 px e desktop que não há rolagem horizontal nem sobreposição.
