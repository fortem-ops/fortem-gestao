# 5-3-1 no portal do aluno: análise e plano só de interface

## 1. Como a tela está hoje
- A tela do 5-3-1 é uma parte própria dentro da página de Treinos do portal. É só para leitura e não usa as peças da tela de Fases/Personalizado. O Personalizado e as Fases usam a mesma tela.
- **Topo:** "5-3-1 · Onda de 4 semanas", frequência e % do Training Max.
- **Semana:** 4 botões ("Sem 1…Sem 4 / deload") que o aluno escolhe na mão. Começa sempre na Semana 1 e não sabe em que semana o aluno está.
- **Aquecimento:** um bloco único com siglas LIB/MOB/ATI/PREV, texto de 10 a 12 px e ícone de vídeo de 14 px.
- **Treinos:** aparecem todos os dias de uma vez (Treino 1, 2, 3…), um embaixo do outro. Cada levantamento mostra o TM e uma lista "Aquec./Trabalho · reps × % → kg". Depois vêm Acessórios (escondidos no deload) e Auxiliares.
- **Carga, repetições, salvamento e concluir:** não existem. O aluno não registra carga, não marca série e não tem botão "Concluir". A sessão não é registrada pelo portal.
- **Vídeo:** ícone pequeno ao lado do nome, que abre outra aba.

## 2. O que provavelmente está ruim no celular
- **Muita rolagem:** todos os treinos da semana aparecem juntos, e o aluno precisa procurar o treino do dia.
- **Não guarda a semana:** sempre abre na Semana 1, sem dizer qual é a atual.
- **Não dá para interagir:** sem carga, sem marcar a série, sem concluir. No Personalizado tudo isso existe.
- **Sem progresso:** nada como "Treino 2 de 3", "Semana 2 de 4" ou "série 3 de 5".
- **Toques pequenos:** os ícones de vídeo têm 12 a 14 px, abaixo dos 44 px mínimos. As abas de semana têm cerca de 32 px de altura.
- **Texto pequeno:** de 9 a 12 px em quase tudo, o que dificulta a leitura durante o treino.
- **Fora da identidade do portal:** cantos arredondados, sombra na aba ativa, fundo "muted" e rótulos de 10 px em vez de 13 px em caixa alta, com destaque vermelho espalhado. Também usa siglas (LIB, MOB, ATI, PREV, TM) sem explicação.
- **Diferente das Fases e do Personalizado:** lá existem o cartão de progresso, a escolha do treino, a carga por exercício e o botão grande "Concluir".

## 3. O que reaproveitar do Treino personalizado (sem alterar a tela dele)
- O campo de carga já existente (`CargaInput`), que usa teclado numérico e salva sozinho a carga do aluno. Ele já é usado no M102, X-Fab e outros métodos.
- O mesmo registro de "sessão concluída" que o M102 e o X-Fab já usam.
- O mesmo visual: cartão de progresso no topo ("Sessão X de Y" e %), seletor de treino e botão primário vermelho fixo embaixo, com 48 px ou mais.
- O mesmo padrão de aquecimento com nomes completos e vídeo em botão de 44 px.

## 4. Plano em etapas (cada uma pode ser aplicada e testada sozinha)
Fica tudo preservado: cálculos de carga, percentuais e progressão do 5-3-1; consultas; regras de acesso; Fases, Personalizado e painel da equipe.

**E1. Visual do portal (só aparência).** Cantos retos, sem sombra, filetes de 1 px, rótulos de 13 px em caixa alta. Vermelho só no destaque de kg de trabalho. Siglas trocadas por nomes (Liberação, Mobilidade, Ativação, Prevenção) e "TM" explicado como "Carga de referência".

**E2. Um treino por vez.** Um seletor de treino (T1, T2, T3) com botões de 44 px ou mais, mostrando só o treino escolhido. A semana continua escolhida na mão, com abas maiores (44 px).

**E3. Séries mais legíveis.** Cada série vira uma linha alta e fácil de tocar: "Série 3 de 5 · 5 reps · 85% → 102,5 kg", com a série principal (AMRAP/"5+") destacada. Vídeo em botão de 44 px.

**E4. Carga do aluno.** Colocar o campo de carga já existente nos acessórios e auxiliares, como no M102. A carga calculada continua sendo a referência.

**E5. Progresso e conclusão (precisa da sua confirmação).** Cartão de progresso ("Semana 2 de 4 · Treino 1 de 3") e botão "Concluir treino", usando o mesmo registro de sessão do M102. Ponto em aberto: em qual semana o 5-3-1 está hoje é decidido pela escolha manual. Mostrar a semana atual sozinha a partir das sessões concluídas é regra nova e precisa da sua aprovação. Sem aprovação, o cartão mostra só o treino escolhido.

Cada etapa termina com build e conferência visual a 393 px com dados simulados.

## Detalhes técnicos
- Componente: `Portal531View` em `src/pages/portal/PortalWorkouts.tsx` (linhas 1098–1300). Ele é escolhido quando `template_fase === "5-3-1"` ou `variante === "531"`. Os cálculos vêm de `@/lib/wendler531` (`computeWave`, `trainingMax`, `acessorioKg`).
- A extração pode ir para `src/components/portal/Portal531View.tsx`, sem tocar no fluxo principal (linhas 169–1096), usado por Fases e Personalizado.
- E4 usa `CargaInput` (tabela `treino_cargas`, já usada). E5 usa `registrarSessaoConcluida` (linha 1308), já usada pelo M102 e X-Fab. Não muda consultas nem regras de acesso.
