# Reabilitação: Nome e Idade preenchidos automaticamente

## O que muda

No formulário de Reabilitação (protocolo "Avaliação Fisioterapia"), a primeira caixa
"Nome" e a caixa "Idade" começam vazias hoje. Passam a vir preenchidas
automaticamente com os dados do cadastro do aluno/paciente:

- **Nome** → nome completo do cadastro.
- **Idade** → idade calculada a partir da data de nascimento do cadastro.

Regras:

- O preenchimento só acontece quando o campo ainda está vazio — se a pessoa da
  equipe já digitou algo (ou editou depois), o conteúdo digitado é preservado e
  nunca sobrescrito.
- Se o cadastro não tiver data de nascimento, a caixa Idade fica vazia.
- Os campos continuam editáveis normalmente (a equipe pode corrigir se precisar).
- Vale também para relatórios já salvos: ao abrir um relatório antigo em que essas
  caixas ficaram vazias, elas passam a mostrar nome e idade do cadastro — sem
  alterar o que já foi salvo.
- Vale para qualquer tipo dinâmico que tenha perguntas rotuladas exatamente como
  "Nome" e "Idade" (hoje: Reabilitação). Os demais tipos (Experimental, Força,
  Pliometria etc.) não têm essas perguntas e não são afetados.

## Detalhes técnicos

- `DynamicAssessment.tsx`:
  - Na inicialização (novo relatório ou carga de um existente), percorrer
    `schema.sections[*].questions` e, para perguntas cujo rótulo normalizado é
    "nome" → preencher `student.nome`; "idade" → `differenceInYears(new Date(), parseISO(student.data_nascimento))`.
  - Aplicar apenas quando `answers[qid]` está vazio; alimentar `dados` antes do
    primeiro autosave e ajustar `lastSerialized` para não disparar gravação
    desnecessária em relatório novo intocado (o autosave normal já grava quando
    houver qualquer edição).
  - Comparação de rótulo case-insensitive e sem espaços extras ("Nome", "nome",
    " Idade " etc.).
- Nenhuma migration nem mudança no schema do protocolo — é só preenchimento
  inicial no formulário.
- Validar com `bunx tsgo --noEmit` e build; abrir um novo relatório de
  Reabilitação e conferir Nome/Idade preenchidos e a exibição no relatório salvo.
