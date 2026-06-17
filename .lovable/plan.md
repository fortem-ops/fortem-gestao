# Plano: Multi-seleção nos Filtros de Alunos

Permitir selecionar várias opções nos filtros de status/categoria de `Alunos Ativos > Filtros`, usando dropdown com checkboxes.

## Filtros afetados (multi-seleção)
- Status
- Última Avaliação Funcional
- Tipo de Plano
- Professor Responsável
- Serviços do Plano Disponíveis (com crédito)

Mantém **seleção única** (sem mudança):
- Frequência, Serviços do Plano (Com/Sem), Serviços Contratados (Com/Sem), Plano VIP, todos os Dados Cadastrais (Com/Sem), datas e busca.

## UI
Substituir o `Select` desses 5 filtros por um componente `MultiSelectDropdown` novo:
- Trigger no mesmo estilo dos selects atuais (altura h-9, mesmo padding).
- Mostra: "Todas" quando vazio; o rótulo da opção quando 1 selecionada; "N selecionados" + badge com contagem quando >1.
- Conteúdo: `Popover` + lista de `Checkbox` + label por opção, com botão "Limpar" no rodapé.
- Comportamento: lista vazia = "todos" (sem filtro aplicado).

## Mudanças de estado/tipo
Em `src/components/student/StudentListFilters.tsx`:
- Tipos viram arrays: `status: string[]`, `ultimaAvaliacaoFuncional: UltimaAvalFuncFiltro[]` (sem `"todos"`), `tipoPlano: string[]`, `professor: string[]`, `servicoPlanoDisponivel: ServicoPlanoDispFiltro[]`.
- `defaultFilters` desses campos = `[]`.
- `activeCount` conta cada array `length > 0` como 1 ativo (mantém consistência com badge atual).
- `clearAll` zera todos os arrays.

## Lógica de filtragem
Em `src/pages/StudentList.tsx`, ajustar onde cada filtro é aplicado:
- Array vazio → ignora filtro (passa todos).
- Caso contrário → `arr.includes(valorDoAluno)` (OR entre opções do mesmo filtro; AND entre filtros diferentes, como hoje).
- Para Última Avaliação Funcional, manter a lógica atual de derivar o status do aluno (em_dia/pendente/atrasada/nunca_realizada) e checar `includes`.

## Componente novo
`src/components/student/MultiSelectFilter.tsx` — reutilizável, props: `label?`, `options: {value, label}[]`, `value: string[]`, `onChange: (v: string[]) => void`, `placeholderAll?: string`.

## Fora de escopo
- Filtros Com/Sem (binários) e datas permanecem como estão.
- Sem mudanças no backend/banco.
- Sem alteração no campo de busca textual nem no Select compacto de Status do header (esse vira o mesmo MultiSelect ou permanece single? **Decisão:** o Select de Status no header da barra superior também vira MultiSelect para alinhar com o avançado).
