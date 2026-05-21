## Problema

Ao visualizar uma avaliação experimental no perfil do aluno, o dialog mostra apenas as seções **Anamnese** e **Avaliação de Mobilidade** — exatamente o conteúdo do `avaliacao_templates` (schema antigo/inicial gravado para `tipo='experimental'`).

As novas seções (Estabilidade, Padrões de Força, Treino, Observações Gerais etc.) existem porque o formulário de preenchimento usa o schema do **protocolo** vinculado (`avaliacao_protocolos.schema`, via `AssessmentForm → EngineDispatcher → DynamicAssessment`), e não o template legado. A coluna `avaliacoes.protocolo_id` já guarda qual protocolo foi usado em cada avaliação, mas o viewer ignora isso.

## Causa raiz

`AssessmentViewerDialog.tsx` (linhas 77–81) carrega o schema com `fetchExperimentalSchema()`, que sempre lê `avaliacao_templates` (Anamnese + Mobilidade). O resultado: respostas das demais seções caem em "Outras respostas registradas" (chaves cruas) ou ficam ocultas, e mesmo a Mobilidade renderiza com base no schema antigo, sem refletir alterações do protocolo.

## Correção

1. **Buscar o schema a partir do protocolo da avaliação** no viewer:
   - Em `AssessmentViewerDialog.tsx`, adicionar uma query `["avaliacao-protocolo-schema", avaliacao.protocolo_id]` que faz `select schema, nome from avaliacao_protocolos where id = avaliacao.protocolo_id` quando `protocolo_id` existir.
   - Usar esse schema no `<ExperimentalView />` em vez de `fetchExperimentalSchema()`.
   - Fallback: se `protocolo_id` for nulo (avaliações antigas), manter o comportamento atual (template legado) — assim o histórico antigo continua legível.

2. **Generalizar para qualquer engine dinâmico** (opcional mas recomendado): hoje o viewer só renderiza schema dinâmico quando `tipo === "experimental"`. Aplicar o mesmo `ExperimentalView` para outras avaliações cuja `protocolo_id` aponte para protocolos dinâmicos (ex.: futuros tipos), mantendo o ramo `funcional`/`composicao`/`funcional_v2` intacto. Pode ficar para uma segunda etapa se preferir minimizar mudança.

3. **Mostrar nome do protocolo** no cabeçalho do dialog (`Protocolo: X`) para deixar claro qual versão foi aplicada — ajuda em auditoria, já que protocolos podem ser editados ao longo do tempo.

4. Manter a seção "Outras respostas registradas" como rede de segurança para chaves fora do schema atual (já existe).

## Arquivos a editar

- `src/components/student/assessment/AssessmentViewerDialog.tsx` — trocar a fonte do schema do bloco experimental para o protocolo da avaliação, com fallback para o template; exibir nome do protocolo no header.

Nenhuma mudança de banco, RLS ou de fluxo de preenchimento é necessária — apenas a leitura no viewer.