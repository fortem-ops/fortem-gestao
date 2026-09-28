# Corrigir o lembrete de avaliação funcional da Tania

## Diagnóstico confirmado

- O aviso da imagem vem do lembrete próprio do Dashboard, não da Central de Tarefas.
- A Tania tem um agendamento de Avaliação Funcional com o Gustavo em 25/09/2026.
- Ela possui dois registros `funcional_v2` nessa data: um contém Mobilidade/Flexibilidade e Força; o outro contém Força.
- O lembrete antigo só reconhece os nomes exatos `funcional` e `forca`. Como os dados atuais ficam em registros `funcional_v2`, ele interpreta incorretamente que as duas partes ainda faltam.

## Correção

1. Atualizar o lembrete para reconhecer o formato atual da Avaliação Premium:
   - Mobilidade/Flexibilidade concluída quando houver métricas preenchidas em uma avaliação funcional válida após o agendamento.
   - Força concluída quando houver exercícios de força preenchidos após o agendamento.
   - Manter compatibilidade com registros antigos dos tipos `funcional` e `forca`.
2. Considerar registros da mesma data do agendamento, como os da Tania.
3. Manter inalterada a regra dos lembretes de Treino Experimental.
4. Adicionar testes para avaliação completa, somente mobilidade, somente força e registro anterior ao agendamento.
5. Validar no Dashboard que o aviso da Tania desaparece para o Gustavo, sem ocultar avisos realmente incompletos de outros alunos.

## Detalhes técnicos

- Centralizar a classificação de conclusão para evitar depender apenas do texto do campo `tipo`.
- Ler `avaliacoes.dados.metricas` e `avaliacoes.dados.forca.exercicios` nos registros `funcional_v2`.
- Não alterar nem excluir avaliações, agendamentos ou tarefas; a correção é somente na identificação do que já foi preenchido.
