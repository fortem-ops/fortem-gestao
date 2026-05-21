## Objetivo

1. **Dashboard** — Novo card "Avaliação Funcional Atrasada" com a contagem de alunos ativos do profissional logado (ou de todos, para coord/admin com filtro "Todos") cuja última avaliação funcional esteja vencida. Clique → navega para `/carteira`.
2. **Carteira de Alunos** — Em cada linha, mostrar "Última Avaliação Funcional: dd/mm/aaaa". Se atrasada, texto em vermelho e badge **ATRASADA**.

## Critério de "atrasada"

Reusar a regra já existente em `AlertsWidget` (Reavaliação funcional):
- Atrasada (urgente) = **última avaliação funcional há mais de 6 meses**, OU
- Aluno ativo **sem nenhuma avaliação funcional** registrada (nunca avaliado).

(Isso mantém consistência com os alertas já mostrados no Dashboard.)

## Implementação

### 1. `src/components/dashboard/StatsCards.tsx`
- Adicionar query `dashboard-aval-funcional-atrasada` que:
  - Busca `alunos` com `status='ativo'` (e `responsavel_id = professorId` quando filtrado).
  - Busca `avaliacoes` com `tipo='funcional'`, agrupa última data por `aluno_id`.
  - Conta alunos cuja última data > 6 meses no passado OU sem avaliação.
- Adicionar novo card na `row2` (ou `row3`), ícone `ClipboardCheck`/`AlertTriangle`, cor `text-destructive`, label "Aval. Funcional Atrasada".
- Tornar o card clicável (`onClick={() => navigate("/carteira")}`) — ajustar `renderCard` para aceitar `onClick` opcional e cursor-pointer.

### 2. `src/pages/CarteiraAlunos.tsx`
- Estender a query `carteira-alunos`: após buscar `alunos`, buscar `avaliacoes` (`tipo='funcional'`, `aluno_id in (...)`, ordenado por `data desc`) e construir um map `alunoId → ultima_data`.
- No render de cada aluno, abaixo da linha de email/frequência mostrar:
  - "Última aval. funcional: dd/mm/aaaa" (ou "Nunca avaliado").
  - Se atrasada (> 6 meses ou nunca): texto `text-destructive` + `<Badge variant="destructive">ATRASADA</Badge>`.
- (Opcional) Adicionar filtro/contador no bloco de Stats: "Aval. atrasadas: N".

## Fora de escopo
- Não alterar regras de comissionamento, agenda, ou backend.
- Não criar migração — usa tabelas/colunas existentes (`avaliacoes`, `alunos`).