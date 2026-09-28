# Converter em aluno ativo

## O que muda
Um botão **"Converter em aluno ativo"** aparece ao lado de "Converter em cliente avulso" em todos os lugares onde ele existe:

1. **Perfil do aluno** (painel de Pipeline) — hoje não tem.
2. **Pipeline** — no painel lateral do card (hoje não tem) e no card (já existe; será mantido).
3. **Cadastros > Leads** — hoje não tem. Prospects e Alunos Perdidos já têm; ficam iguais.

Ao clicar, abre a mesma tela de conversão já usada no Pipeline: CPF e e-mail obrigatórios, endereço com busca por CEP. Ao confirmar, o cadastro vira aluno ativo, vai para a etapa "Aluno ativo" do funil e o histórico registra "Conversão para aluno". A venda do plano segue o fluxo normal.

Quem pode: Coordenação e Administração (Nutri/Fisio e Professores não veem).

## Detalhes técnicos
- Novo `src/components/leads/ConvertToAlunoButton.tsx` (variantes default/compact/icon, igual ao `ConvertToAvulsoButton`), abrindo `ConvertToAlunoDialog` com `fullConvert` e destino "Aluno ativo"; visível só com `isCoordAdmin`.
- Usar em `StudentPipelinePanel.tsx`, `PipelineLeadDrawer.tsx` e `Leads.tsx`, nas mesmas condições do botão de avulso.
- Invalidar também `leads-list` e o perfil do aluno após converter.
- Sem alterações no banco.
