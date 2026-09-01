# Separar Avaliações de Relatórios em Registros

Hoje a sub-aba "Avaliações/Relatórios" mistura duas coisas: as avaliações estruturais (Funcional, Composição Corporal) e os relatórios dinâmicos (Experimental, Reabilitação, Relatórios de Força). A proposta separa em duas sub-abas.

## Nova ordem das sub-abas de Registros

```text
Tarefas | Relatórios | Avaliações | Observações | Uploads
```

Sub-aba padrão ao abrir Registros: Tarefas.

## Avaliações

- Card "Última Avaliação Funcional" com o selo de severidade e o lápis para corrigir a data.
- "Histórico de Avaliações" listando apenas registros estruturais.
- Um único botão: **Avaliações** (abre o módulo premium do aluno).

## Relatórios (nova)

- Lista dos relatórios do aluno (tipos dinâmicos), mesmo cartão clicável e mesmo visualizador de hoje, incluindo exclusão para coordenador/admin.
- Botão **+ Novo Relatório**, apontando para o mesmo fluxo atual.

## Como os registros são divididos

Pelo tipo salvo em cada registro:

- Avaliações: `funcional`, `funcional_v2`, `composicao_corporal` (motores estruturais).
- Relatórios: todo o resto (`experimental`, `reabilitacao`, `relatorioforca`, `forca`, `pliometria` e futuros tipos criados em Administração > Relatórios).

Contagem atual do banco: 142 registros vão para Avaliações e 66 para Relatórios.

## Detalhes técnicos

- `src/components/student/StudentRegistros.tsx`: adicionar `relatorios` a `REGISTROS_SUBTABS`, reordenar os triggers para Tarefas, Relatórios, Avaliações, Observações, Uploads; sub-aba padrão `tarefas`; contador próprio para cada uma das duas listas.
- `src/components/student/StudentAssessments.tsx`: passar a receber uma prop `modo: "avaliacoes" | "relatorios"`. No modo avaliações filtra os tipos estruturais, mostra o card de última funcional e só o botão "Avaliações"; no modo relatórios filtra o complemento e mostra só "+ Novo Relatório". A lista, o viewer, a exclusão e as permissões continuam idênticos.
- Constante compartilhada com os tipos estruturais para o filtro (alinhada com `ENGINES_EXCLUIDAS_LEGADO` já usada em `AssessmentForm.tsx`).
- `src/pages/StudentProfile.tsx`: mapear o link legado `?tab=avaliacoes` para a sub-aba Avaliações e aceitar `?sub=relatorios`.
- Sem mudanças de banco, RLS ou regras de negócio.
