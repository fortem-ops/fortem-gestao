# Prescrever treino: aplicar agora ou agendar início

Ao salvar uma prescrição de treino (Banco de Treinos, treino Personalizado ou indicação na aula experimental), o professor poderá escolher:

- **Aplicar agora** — vira o treino atual imediatamente (comportamento atual).
- **Agendar início** — escolhe uma data futura; o treino fica como *Aguardando início* e só vira atual quando a data chega (treino atual anterior continua valendo até lá).

## Mudanças

### 1. Banco de dados (migration)
- Adicionar coluna `data_inicio DATE` em `treinos`.
- Atualizar o CHECK de `status` para aceitar também `'aguardando'` (mantém `'atual'`, `'arquivado'`).
- Índice em `(aluno_id, status, data_inicio)` para a ativação diária.
- Função `public.ativar_treinos_agendados()` (SECURITY DEFINER) que, para cada aluno com algum treino `aguardando` cuja `data_inicio <= CURRENT_DATE`, arquiva o `atual` vigente e promove o mais recente agendado a `atual`. Pode ser chamada via RPC.

### 2. UI de prescrição
Em `WorkoutDetail.tsx`, `PersonalizadoEditor.tsx` e `workoutImport.ts` (`prescribeFaseInicial`), trocar o botão único "Salvar" por um diálogo de confirmação com dois modos:

- **Aplicar imediatamente** (padrão) → insere `status='atual'`, arquiva os anteriores como hoje.
- **Programar início em [date picker, mínimo = amanhã]** → insere `status='aguardando'`, `data_inicio = <data>`, **sem** arquivar o treino atual vigente.

### 3. Listagem do histórico
Em `StudentWorkouts.tsx` e `PortalWorkouts.tsx`:
- Antes de listar, chamar `supabase.rpc('ativar_treinos_agendados')` (idempotente, leve) para garantir promoção em D+0.
- Novo badge `Aguardando início — dd/mm/aaaa` (azul) para `status='aguardando'`.
- Permitir cancelar/excluir um agendado (botão lixeira já existente cobre, basta liberar para `aguardando` também).

### 4. Resumo / caches
- `invalidatePlanoCaches` não muda; apenas garantir que `["treinos", alunoId]` seja invalidado após salvar.

## Fluxo após a mudança

```text
[Salvar treino]
    │
    ├── Aplicar agora  ──► arquiva atual + insere status=atual
    │
    └── Programar      ──► insere status=aguardando, data_inicio=X
                              │
                              └── (no carregamento, em ou após X)
                                    RPC ativar_treinos_agendados
                                      → arquiva atual + promove agendado a atual
```

Nenhuma alteração em fluxos sem prescrição (edição de treino já salvo continua igual).
