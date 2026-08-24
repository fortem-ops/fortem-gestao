# Incluir créditos do plano no widget "Clientes com créditos disponíveis"

Hoje o widget do dashboard lista apenas créditos avulsos/manuais (tabela de créditos do aluno). Alunos que têm sessões de Nutrição/Reabilitação **inclusas no plano** não aparecem. O ajuste passa a considerar as duas fontes.

## Comportamento novo

- Cada cliente aparece se tiver saldo disponível de Nutrição (nutricionista) ou Reabilitação (fisioterapeuta) — vindo de créditos avulsos **ou** do plano contratado.
- A linha mostra nome, atividade, saldo restante (ou "ilimitado") e uma etiqueta discreta de origem: "Plano" ou "Avulso".
- Regra anti-duplicidade mantida: quando o aluno já tem crédito registrado no ledger para aquela atividade, o ledger vence e o cálculo do plano é ignorado (evita saldo dobrado).
- Clique continua abrindo o perfil do cliente; o total no topo continua contando clientes distintos.

## Detalhes técnicos

- `src/components/dashboard/ClientesCreditosWidget.tsx`:
  - Manter a consulta atual de `creditos_aluno` (ativo, não expirado, saldo > 0).
  - Adicionar consultas de `planos` (ativo = true, campos `id, aluno_id, servicos`, join `alunos(nome)`) e de `consumo_servicos` (`plano_id, tipo_servico, tipo_registro, quantidade, agenda_id`) filtrado pelos ids dos planos, em chunks de 300 como em `StudentList.tsx`.
  - Consolidar com `saldoTotalPorAtividade` de `src/lib/creditosServicos.ts` por aluno (ledger tem prioridade — comportamento já implementado na função), mapeando "Consultas Nutrição" → Nutrição e "Consultas Reabilitação" → Reabilitação via `SERVICOS_PLANO`.
  - Filtrar pelas atividades recebidas na prop `atividades` (já enviada pelo `Dashboard.tsx` conforme o papel) e ordenar por nome.
- Sem mudanças de banco: RLS/grants atuais de `planos`, `consumo_servicos` e `creditos_aluno` já permitem leitura por staff.
- Sem alteração em lógica de negócio compartilhada (`creditosServicos.ts` fica intacto).
