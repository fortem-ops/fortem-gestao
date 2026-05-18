## Objetivo

Implementar a aba **Experimental** em **Avaliações** com formulário estruturado de **Anamnese** + **Avaliação de Mobilidade**, com autosave contínuo, edição pós-finalização e permissões restritas a **Coordenadores e Administradores**.

## 1. Estrutura do formulário

Substituir o placeholder atual da aba `experimental` em `AssessmentForm.tsx` por um novo componente `ExperimentalAssessment`.

### Seção — Anamnese (todas perguntas em par "sim/não" + campo de detalhe quando "sim")

1. Histórico de saúde — condição diagnosticada (cardíaca, respiratória, metabólica, ortopédica, etc.) — `Radio Sim/Não` + `Textarea "Quais?"`
2. Uso de medicação — `Radio` + `Textarea "Qual?"`
3. Gestante — `Radio` + `Input numérico "Semanas"`
4. Limitações/dores/lesões — `Radio` + `Textarea "Quais?"`
5. Atividade física regular — `Radio`:
   - Se "Sim" → `Textarea "Qual?"`
   - Se "Não" → `Input "Há quanto tempo está parado(a)?"`
6. O que trouxe à Fortem e objetivo principal — `Textarea` (livre, obrigatório)

### Seção — Avaliação de Mobilidade

Quatro testes, cada um com 3 opções mutuamente exclusivas (`RadioGroup`):

| Teste | Opções |
|---|---|
| Gatinho | Móvel · Restrito · Dificuldade de compreensão e execução |
| Rocking | Móvel · Restrito · Dificuldade de compreensão e execução |
| Rotação Interna e Externa de Ombro na Parede | Móvel · Restrito · Dificuldade de compreensão e execução |
| Hip Hinge com bastão nas costas | Móvel · Restrito · Dificuldade de compreensão e execução |

Mais um `Textarea` "Observações sobre os padrões de mobilidade".

## 2. Autosave contínuo

- Ao abrir a aba, criar (uma única vez) um registro em `avaliacoes` com `tipo='experimental'` e `dados = { status: 'rascunho', anamnese: {}, mobilidade: {} }`.
- A cada alteração de campo, fazer **debounce 800ms** e `UPDATE avaliacoes SET dados = ... WHERE id = ...`.
- Indicador visual no topo: "Salvando…" / "Salvo às HH:MM".
- Botão **"Finalizar avaliação"** apenas marca `dados.status = 'finalizado'` — o registro continua editável (autosave segue ativo) conforme requisito "Editável pós finalização".

## 3. Permissões (RLS + UI)

- **Migration** ajustando a policy de DELETE de `avaliacoes` para permitir também coordenadores:
  ```sql
  DROP POLICY "Admin can delete avaliacoes" ON public.avaliacoes;
  CREATE POLICY "Coord/Admin can delete avaliacoes"
    ON public.avaliacoes FOR DELETE
    USING (public.is_coordinator_or_admin(auth.uid()));
  ```
- INSERT/UPDATE já estão cobertas (autor ou coord/admin). Na UI da aba Experimental, **bloquear** todos os inputs e ocultar botão Salvar/Excluir caso o usuário não seja coord/admin (consulta via `is_coordinator_or_admin` rpc) — exibir mensagem "Somente Coordenadores e Administradores podem preencher avaliações experimentais".

## 4. Visualização

Atualizar `AssessmentViewerDialog.tsx`:
- Adicionar render para `tipo === 'experimental'`: listar respostas da anamnese e quadro com os 4 testes de mobilidade + observações.
- Mostrar badge "Rascunho" / "Finalizada" baseado em `dados.status`.
- Para coord/admin, botão **Editar** que reabre o formulário (reaproveitando `ExperimentalAssessment` em modo "edição" via prop `avaliacaoId`).
- Para admin/coord, botão **Excluir** com confirmação.

## 5. Arquivos afetados

- **edit** `src/components/student/assessment/AssessmentForm.tsx` — substituir TabsContent "experimental" pelo novo componente.
- **new** `src/components/student/assessment/ExperimentalAssessment.tsx` — formulário + autosave + permissões.
- **edit** `src/components/student/assessment/AssessmentViewerDialog.tsx` — render experimental + ações editar/excluir.
- **migration** — atualizar policy de DELETE para incluir coordenadores.

## 6. Detalhes técnicos

- Schema do `dados` jsonb:
  ```json
  {
    "status": "rascunho" | "finalizado",
    "anamnese": {
      "saude": { "tem": bool, "detalhe": "" },
      "medicacao": { "usa": bool, "qual": "" },
      "gestante": { "esta": bool, "semanas": null },
      "limitacoes": { "tem": bool, "quais": "" },
      "atividade": { "pratica": bool, "qual": "", "tempo_parado": "" },
      "motivo_objetivo": ""
    },
    "mobilidade": {
      "gatinho": "movel" | "restrito" | "dificuldade",
      "rocking": "...",
      "rotacao_ombro": "...",
      "hip_hinge": "...",
      "observacoes": ""
    },
    "finalized_at": "ISO" | null
  }
  ```
- Hook `useDebounce` já existe em `src/hooks/useDebounce.ts` — usar para o autosave.
- Invalidar queries `["avaliacoes-aluno", student.id]` e `["avaliacoes-global", student.id]` após cada save bem-sucedido (com throttle para não floodar).
