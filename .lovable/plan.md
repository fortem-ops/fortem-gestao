# Auditoria: resolver ou ignorar vários itens de uma vez

## O que muda na tela (só admin, só itens abertos)
- Cada card aberto ganha uma caixinha de seleção à esquerda.
- Acima da lista: "Selecionar todos os visíveis" (respeita os filtros atuais) e o contador "N selecionados".
- Com 1 ou mais selecionados aparece uma barra com "Resolver selecionados", "Ignorar selecionados" e "Limpar seleção".
- Ao clicar, abre a mesma janela de confirmação de hoje, com o título "Marcar N itens como resolvidos" / "Ignorar N itens", a lista resumida (até 5 descrições + "e mais X") e uma nota opcional, aplicada a todos.
- Depois de confirmar: mensagem "N itens atualizados", seleção limpa, lista e contadores atualizados.
- Trocar de filtro limpa a seleção (para não agir sobre itens que sumiram da tela).
- Os botões individuais "Resolvido"/"Ignorar" de cada card continuam iguais.

## Regras
- Só itens com status "aberto" podem ser selecionados; a atualização em massa também filtra status = aberto no banco, para nunca sobrescrever um item já tratado por outra pessoa.
- Permissão continua a mesma (só admin resolve/ignora, pela regra de acesso já existente). Nada é apagado.

## Detalhes técnicos
- `useAuditoria.ts`: o hook `useResolverAuditoria` passa a aceitar `ids: string[]` (um `update ... in("id", ids).eq("status","aberto")`, retornando as linhas atualizadas para informar a contagem real); o uso atual com um id vira `ids: [id]`.
- `Auditoria.tsx`: estado `selecionados: Set<string>`, `Checkbox` do shadcn em cada card aberto, barra de ações e diálogo generalizado (`alvo` passa a ser `{ ids, acao, descricoes }`).
- Sem mudança de banco nem nos fiscais.
- Teste de regressão em `src/test/`: função pura de seleção (selecionar todos só pega abertos; filtro troca → seleção limpa; itens não-abertos são removidos do lote).
- Rodar `bunx vitest run`, tipos e `bunx eslint` nos arquivos alterados.
