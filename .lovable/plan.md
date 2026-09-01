# Tipos de avaliação: o que é estrutural e o que pode sair

## Resposta à pergunta

Verifiquei o código e o banco. A tela **Avaliações** (antiga "Premium") **não lê a tabela de tipos**: ela lê os registros de avaliação pelo texto do campo `tipo` (`funcional`, `funcional_v2`, `composicao_corporal`, `pliometria`). Ou seja, apagar um "Tipo" não apaga nem esconde nada na tela Avaliações.

Situação real de cada item selecionado:

| Tipo | Motor | Situação hoje | Dados existentes |
|---|---|---|---|
| Avaliação Funcional (Nova) | funcional_v2 | não aparece em Técnico > Relatórios (excluído por regra); é o formulário do módulo Avaliações | 22 avaliações (a última de hoje, vindas da importação Kinology) |
| Composição Corporal | composicao_pollock | idem — formulário do módulo Avaliações | 0 avaliações |
| Funcional | funcional_fixo | inativo, não aparece em lugar nenhum | 120 avaliações antigas (histórico) |
| Força | dinâmico | inativo, não aparece | 5 avaliações antigas |
| Potência | dinâmico | inativo, não aparece | 2 avaliações antigas |

Conclusão: **os dois primeiros são estruturais** (são os motores de captura do módulo Avaliações e, hoje, ficam "escondidos" no meio dos tipos de Relatórios). **Os três inativos não são estruturais** — podem ser excluídos sem impacto na tela Avaliações; só o histórico permanece como registro.

## Proposta

1. **Criar a aba Administração > Avaliações**, separada de Administração > Relatórios.
   - Lista apenas os tipos dos motores do módulo Avaliações (Funcional Nova e Composição Corporal), com seus protocolos.
   - Administração > Relatórios passa a listar apenas os tipos dinâmicos/legado (Experimental, Relatórios e novos criados pelo usuário).
2. **Excluir os três tipos inativos** (Funcional, Força, Potência) junto com seus protocolos vazios. As avaliações históricas continuam visíveis no histórico do aluno.
3. Manter as proteções atuais: aviso reforçado ao excluir tipos de sistema e confirmação antes de apagar protocolos.

## Detalhes técnicos

- `AdminTiposAvaliacao.tsx` ganha uma prop de escopo (`escopo: "relatorios" | "avaliacoes"`) filtrando por `engine`: `funcional_v2`/`composicao_pollock` na aba Avaliações, os demais em Relatórios. Sem duplicar componente.
- `Admin.tsx`: nova `TabsTrigger` "Avaliações" apontando para o mesmo componente com o escopo novo.
- Exclusão dos três tipos inativos via migração SQL (`avaliacao_tipos` + `avaliacao_protocolos` vinculados). Nenhuma linha de `avaliacoes` é tocada.
- Nada muda em `AvaliacoesPremium.tsx`, `useAlunoAvaliacoesConsolidadas.ts` nem na regra `ENGINES_EXCLUIDAS_LEGADO` do formulário de Técnico > Relatórios.
