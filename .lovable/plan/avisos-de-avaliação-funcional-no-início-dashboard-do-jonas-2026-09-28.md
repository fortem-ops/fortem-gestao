# Avisos de avaliação funcional no Início (Dashboard do Jonas)

## O que foi verificado
Conferi os 6 avisos da foto contra as avaliações salvas em **Avaliações**:

| Aluno | Mobilidade/Flex. | Força | Situação real |
|---|---|---|---|
| Leonardo Zimmer Saldanha | feita 23/09 | feita 23/09 | Concluída — aviso deve sumir |
| Larissa Souza Furtat | feita 20/08 | feita 20/08 | Concluída — aviso deve sumir |
| Luiza Soares da Silva | feita 08/09 | feita 08/09 | Concluída — aviso deve sumir |
| Airton Luiz Moraes Junior | feita 03/08 e 05/08 | feita 05/08 | Concluída — aviso deve sumir |
| João Vicente Laste Rodenbusch | feita 01/09 | falta | Pendente só Força |
| Marcelo Luiz Nunes Melim | falta | falta | Pendente completa |

A correção que reconhece a avaliação nova (feita no caso da Tania) já trata esses casos corretamente, mas ainda **não está no site publicado** que o Jonas usa — por isso os 4 concluídos continuam aparecendo.

## O que muda
1. **Clicar no aviso abre Avaliações** (antiga Avaliações Premium) já com o aluno selecionado, em vez da tela antiga "Novo Relatório".
2. **Texto do aviso mostra o que falta de verdade**: "falta Força" (João Vicente), "falta Mobilidade/Flexibilidade e Força" (Marcelo), em vez de sempre "Funcional + Força".
3. Após aprovar, conferir no preview que só João Vicente e Marcelo continuam no Dashboard do Jonas, e **publicar** para o aviso sumir no site dele.

Nada muda em tarefas, agenda ou na tela de Relatórios.

## Detalhe técnico
- `LembreteAvaliacoesPendentesBanner.tsx`: `handleClick` → `/avaliacoes-premium/${alunoId}`; mensagem montada a partir de `faltam` (`funcional` = "Mobilidade/Flexibilidade", `forca` = "Força").
- Regra de conclusão continua em `src/lib/avaliacaoPendente.ts` (metricas / forca.exercicios em `funcional_v2`).
- Validar com Playwright logado como Jonas (profissional_id dos agendamentos).
