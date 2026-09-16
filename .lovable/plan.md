# Reabilitação → Evolução: sessões acumuladas em um único registro

## O que muda

Ao escolher Relatórios → Reabilitação → categoria **EVOLUÇÃO**, a tela passa a funcionar
como um prontuário de evolução contínuo do aluno/paciente:

### Sessão 1 — resumo da Avaliação Fisioterapia (somente leitura)
- No topo aparece um bloco "Sessão 1 — Avaliação Fisioterapia", com a data da avaliação
  e as respostas preenchidas nela (queixa principal, EVA, HDA, histórico, achados
  clínicos, condutas, recomendações etc.), sem campos editáveis.
- É usada a Avaliação Fisioterapia mais recente daquele aluno. Perguntas sem resposta
  não são exibidas.
- Se o aluno ainda não tiver Avaliação Fisioterapia, aparece um aviso ("Este aluno ainda
  não tem Avaliação Fisioterapia registrada") e a Sessão 1 vira um campo de texto normal,
  para não travar o atendimento.

### Sessões seguintes — 2, 3, 4, 5… sem limite
- Cada sessão é um bloco com campo de texto e um botão **Finalizar sessão**.
- Ao finalizar, a sessão fica registrada com data e nome de quem preencheu, e passa a ser
  exibida recolhida/somente leitura, com a opção **Reabrir** para corrigir.
- Um botão **+ Nova sessão** cria a próxima na sequência (2, 3, 4…), numerada
  automaticamente.

### Um único registro por aluno
- Existe um único relatório de Evolução por aluno: ao abrir a categoria EVOLUÇÃO, o
  sistema carrega o registro já existente e continua de onde parou, em vez de criar um
  novo a cada acesso. Todas as sessões ficam reunidas nesse mesmo lugar, em ordem.
- O salvamento automático atual é mantido.
- A categoria "Avaliação Fisioterapia" continua exatamente como está hoje, e os demais
  tipos (Experimental, Relatórios Técnicos etc.) não são afetados.

## Detalhes técnicos

- Novo componente `src/components/student/assessment/ReabilitacaoEvolucao.tsx`,
  despachado em `AssessmentForm.tsx` (`EngineDispatcher`) quando
  `tipo.slug === "reabilitacao"` e o protocolo selecionado for o de EVOLUÇÃO
  (`is_default`/nome "EVOLUÇÃO"); todos os outros casos seguem usando
  `DynamicAssessment` sem alteração.
- Carga inicial: busca em `avaliacoes` o registro `aluno_id = X`, `tipo = 'reabilitacao'`,
  `protocolo_id = <EVOLUÇÃO>` mais recente; se existir, reutiliza esse `id` (edição), se
  não existir, cria no primeiro autosave — mesmo fluxo de insert/update já usado em
  `DynamicAssessment`.
- Sessões passam a viver em `dados.sessoes: { n, texto, finalizado_em, autor_id,
  autor_nome }[]` dentro do mesmo JSONB. As respostas antigas das perguntas fixas
  "SESSÃO 1..4" do schema são migradas para esse array na primeira abertura (sem apagar
  `answers`), então nada do que já foi digitado se perde. O schema do protocolo no banco
  não é alterado.
- Resumo da Sessão 1: consulta a avaliação `tipo = 'reabilitacao'` com
  `protocolo_id = <Avaliação Fisioterapia>` mais recente do aluno e cruza
  `dados.answers` com o schema desse protocolo para renderizar rótulo → resposta
  (inclusive os tipos `sim_nao_detalhe`).
- Autosave com debounce, badges de status e invalidação de queries seguem o padrão atual
  de `DynamicAssessment`.
- Sem migration, sem mudança de RLS.
- Validação: `bunx tsgo --noEmit` e build.
