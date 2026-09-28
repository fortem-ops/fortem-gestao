# Após converter em aluno: abrir perfil + tela de venda

## O que muda
Ao confirmar "Converter em aluno" (em qualquer lugar: perfil, Pipeline, Leads, Prospects, Alunos Perdidos), o sistema leva direto para o **perfil do aluno** com a **tela de venda de planos/serviços já aberta**. Se a pessoa fechar a venda sem concluir, continua no perfil normalmente.

A renovação de plano (mesma tela, modo renovação) não muda.

## Detalhes técnicos
- `ConvertToAlunoDialog.tsx`: após sucesso com `fullConvert`, `navigate(`/alunos/${alunoId}?venda=1`)` (antes do `onConverted`).
- `StudentProfile.tsx`: ao carregar com `venda=1`, abre o `VendaDialog` (`setVendaOpen(true)`) e remove o parâmetro da URL para não reabrir ao atualizar a página.
- Sem alterações no banco.
