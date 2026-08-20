# Excluir avaliações lançadas por engano

Hoje só a aba **Mobilidade/Flexibilidade** tem botão de excluir. Quando o laudo Kinology (Força) sobe errado, ou quando uma composição/pliometria é lançada com dados errados, não há como remover pela tela de Avaliações Premium.

## O que será feito

Adicionar exclusão nas abas que hoje não têm, com a mesma lógica e a mesma proteção já usada na Mobilidade:

- **Força**: no card de importação Kinology, listar as dinamometrias já importadas (por data) com botão "Excluir". Ao excluir, se aquela mesma avaliação também tiver dados de mobilidade lançados, apaga só o bloco de força e preserva a mobilidade; se não tiver, apaga a avaliação inteira. O arquivo PDF do laudo no armazenamento também é removido.
- **Composição corporal**: botão excluir na medição selecionada.
- **Pliometria**: botão excluir na medição selecionada.

Em todos os casos:
- Confirmação obrigatória antes de apagar ("Esta ação não pode ser desfeita").
- Botão visível apenas para Coordenação e Admin (o banco já restringe a exclusão a esses perfis; professores continuam sem acesso).
- Após excluir, a página recarrega os dados e o mapa corporal/score é recalculado automaticamente.

## Detalhes técnicos

- Sem migração: a política de exclusão de `avaliacoes` já é `is_coordinator_or_admin() OR is_admin_role()`. Pliometria hoje só permite exclusão para admin — a linha filha em `avaliacao_pliometria` será removida junto com a avaliação pai via exclusão da avaliação (ou apenas o bloco de dados), evitando necessidade de mudança de política.
- Arquivos alterados: `src/components/avaliacoes-premium/PremiumKinologyImport.tsx` (lista + exclusão), `tabs/ComposicaoTab.tsx`, `tabs/PliometriaTab.tsx`.
- Gate de permissão via `supabase.rpc("is_coordinator_or_admin")`, igual ao já usado em `StudentAssessments.tsx`.
- Invalidação de cache: `["aluno-avaliacoes-consolidadas", alunoId]` e as chaves de avaliação funcional já existentes.
- Remoção do PDF: `supabase.storage.from("aluno-files").remove([laudoPath])` quando o caminho estiver salvo em `dados.forca.laudoPath`.
