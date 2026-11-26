# Avisos automáticos ao consultor, professor e coordenação (com push)

## O que muda para a equipe

1. **Avaliação realizada → aviso ao consultor**
   Quando uma avaliação **experimental**, **funcional** ou **de força** for finalizada (rascunhos não contam), o consultor do aluno recebe um aviso no Notificar e no celular: "Avaliação experimental de Fulano realizada por Ciclano", com link para a ficha. Se o consultor for quem fez a avaliação, ele não recebe o aviso.

2. **Prospect virou aluno → aviso ao professor do experimental + coordenação**
   Quando um prospect tiver o primeiro plano ativado (vendas na Nova Venda, /planos, Corrida e planos de agregador Wellhub/TotalPass), recebem aviso e push:
   - o professor que deu o treino experimental;
   - todos os coordenadores e administradores ativos.
   A mensagem traz o nome do aluno, o plano contratado, a frequência e, se for agregador, qual. Só um aviso por aluno por conversão, para que repetições e reprocessamentos não gerem aviso duplicado.

3. **Todo aviso sobre um aluno inclui professor responsável e coordenadores**
   Qualquer aviso do Notificar ligado a um aluno (manual ou automático) passa a incluir sempre o professor responsável pelo aluno e os coordenadores, sem repetir quem já está na lista e sem incluir quem criou o aviso. Todos recebem também o push.

Regras de push mantidas: só funcionário ativo, sem ponto de exclamação, avisos não urgentes fora do expediente esperam até 06:10 do próximo dia útil, e cada pessoa recebe no máximo um push por aviso.

## Detalhes técnicos

- **Quem é quem:** consultor = `alunos.consultor_id`; professor responsável = `alunos.responsavel_id`; professor do experimental = `avaliador_id` da avaliação experimental mais recente do aluno.
- **Gatilho 1:** `AFTER INSERT/UPDATE` em `avaliacoes` filtrando tipo experimental/funcional/força e transição para finalizada (mesma regra de rascunho da 0303); cria a `notificacoes` e o destinatário.
- **Gatilho 2:** a ativação do primeiro plano de quem estava em prospect (movimento do pipeline de prospects para aluno ou o primeiro plano ativo); trava de deduplicação por aluno.
- **Gatilho 3:** `AFTER INSERT` em `notificacoes` com `aluno_id`: insere `notificacao_destinatarios` para o responsável e os coordenadores (`ON CONFLICT DO NOTHING`), sem incluir `criado_por`.
- **Push:** novo gatilho `AFTER INSERT` em `notificacao_destinatarios` chama `send-push-equipe` (`fn_call_edge_function`) com `gatilho='notificacao_aluno'`, `referencia=notificacao_id`; incluir o gatilho em `GATILHOS_EQUIPE` (não urgente; "urgente" quando a prioridade do aviso for urgente). A deduplicação usa o índice existente em `equipe_push_log`.
- Uma migration; funções `SECURITY DEFINER` sem acesso para `anon`; nenhuma regra de vendas alterada.
- **Testes:** ensaio SQL revertido com dados de teste (consultor avisado e autor excluído, conversão avisa professor+coord com plano/agregador e só uma vez, aviso de aluno inclui responsável+coord sem duplicar), teste vitest do novo gatilho de push e das regras de texto, suíte completa, lint e regra registrada no AGENTS.md.
- Fazer o deploy do `send-push-equipe`; a tela não muda.
