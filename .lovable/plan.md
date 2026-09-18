# Relatório de corrida: nome correto e texto próprio da categoria

## O problema

1. Na aba Relatórios do perfil do aluno, cada registro mostra o código interno do tipo
   ("relatorioforca") em vez do nome real. Como corrida e força são categorias do mesmo tipo
   "Relatórios Técnicos", o relatório de corrida da Yasmim aparece como se fosse de força.
2. O texto explicativo que aparece ao escolher a categoria "Treinos de corrida" está cadastrado
   com o conteúdo do relatório de força ("...andamento dos treinos de força", "quinzenalmente").

## O que muda

- Na lista de relatórios do aluno, o título passa a ser o nome do tipo mais a categoria escolhida,
  por exemplo: "Relatórios Técnicos — Treinos de corrida". Quando não houver categoria, mostra só
  o nome do tipo. Avaliações estruturais (Funcional, Funcional Nova, Composição Corporal) seguem
  com seus nomes normais.
- Na janela de visualização do relatório, o título usa o mesmo nome (hoje também mostra
  "relatorioforca"); o selo "Protocolo: ..." continua como está.
- O texto da categoria "Treinos de corrida" passa a falar de corrida:
  "Este relatório tem o objetivo de manter registrado questões importantes e relevantes para a
  equipe e a coordenação técnica sobre o andamento dos treinos de corrida. Ele deve ser alimentado
  quinzenalmente."
  O texto de "Treinos de força" continua como está (mensal).

Nada muda nas perguntas dos formulários, nem nos relatórios já respondidos.

## Detalhes técnicos

- `StudentAssessments.tsx`: além de `avaliacoes`, buscar `avaliacao_tipos` (slug → nome) e
  `avaliacao_protocolos` (id → nome) uma vez por tela e montar o rótulo
  `nomeTipo(a.tipo) + (protocolo ? " — " + nomeProtocolo(a.protocolo_id) : "")`, com fallback para
  o comportamento atual (`a.tipo.replace(/_/g," ")`) quando o tipo não for encontrado.
- `AssessmentViewerDialog.tsx`: trocar `avaliacao.tipo.replace(/_/g,' ')` no título pelo nome do
  tipo (consulta a `avaliacao_tipos` por slug) + nome do protocolo já carregado em `protocoloInfo`.
- Correção de dado (não é migration): `UPDATE avaliacao_protocolos SET descricao = '<texto de
  corrida>' WHERE id = '15007760-bc0c-4ff2-a48c-7d731f23b634'`.
- Validar com typecheck, build e abertura de um relatório de corrida no perfil do aluno.
