# Corrigir "Onde iniciar?" — fase inicial não vincula ao perfil do aluno

## Diagnóstico (confirmado)

No formulário dinâmico (`DynamicAssessment.tsx`), a resposta do campo de fase inicial é gravada em uma chave fixa (`fase_inicial_treino`), e não no identificador real da pergunta do protocolo.

No protocolo "Relatório da aula experimental" essa pergunta tem o id `f20a4de7-...` (gerado ao ser criada em Administração). Consultando as últimas avaliações desse protocolo, nenhuma tem a resposta gravada — nem na chave fixa, nem no id da pergunta. Consequência:

- o seletor sempre volta em branco ("Selecione a fase inicial...");
- a resposta não fica registrada na avaliação;
- como a comparação de "valor anterior" também usa a chave errada, o vínculo do treino fica instável (repete a prescrição a cada seleção e não reflete o estado real).

## Correção

1. Gravar e ler a resposta pelo **id da própria pergunta** do protocolo, em vez da chave fixa. O seletor passa a exibir a fase escolhida e a avaliação passa a guardar o valor.
2. Manter compatibilidade com registros antigos: ao abrir uma avaliação que gravou na chave legada `fase_inicial_treino`, o valor é exibido normalmente no campo.
3. Ao escolher a fase, o fluxo atual permanece: se o aluno já tem treino "atual", pede confirmação para substituir; senão, importa e prescreve o treino direto. Após prescrever, além da lista de treinos, invalidar também as consultas do perfil do aluno para o treino aparecer sem recarregar a página.
4. Se a prescrição falhar (erro), a seleção não fica marcada como aplicada — o campo volta ao valor anterior e o erro é exibido.

## Detalhes técnicos

- `src/components/student/assessment/DynamicAssessment.tsx`:
  - `handleFaseInicialChange` passa a receber o `qid` da pergunta; `setAnswer(qid, fase)` e leitura de `prev` por `dados.answers[qid] ?? dados.answers[FASE_INICIAL_QUESTION_ID]`.
  - `QuestionField` do tipo `fase_inicial`: `value` já vem por `q.id`; fallback de leitura para a chave legada quando `q.id` estiver vazio.
  - `runPrescribe` guarda o `qid` pendente (junto de `pendingFase`) e, em caso de erro, reverte a resposta.
  - Invalidar também `["treinos", student.id]` / chaves do perfil usadas na aba Treinos do aluno (confirmar as keys em uso antes de aplicar).
- Sem alteração de banco; nenhum dado histórico é reescrito.

## Verificação

- Selecionar uma fase em Técnico > Relatórios: campo mantém o valor, toast de treino vinculado, e o treino aparece no perfil do aluno como "atual".
- Reabrir a avaliação: o valor selecionado continua exibido.
- Build + suíte de testes.
