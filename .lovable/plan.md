## Diagnóstico
No Banco de Treinos hoje:

- **Fases 1–4** (estrutura fixa em `WORKOUT_TEMPLATES`): edições são salvas como overrides em `banco_treinos_escolhas`. As policies já restringem INSERT/UPDATE/DELETE a coord/admin (`is_coordinator_or_admin`). O componente respeita `canEdit` corretamente. ✅
- **Corrida 1–4**: ao clicar no card, o app abre `PersonalizadoEditor`. O salvamento grava em `banco_treinos_personalizados` com `criado_por = auth.uid()` — **qualquer professor pode criar a própria cópia**. A busca usa `find(m => m.nome === templateFase)`, então pode haver várias linhas de Corrida e o "base" fica aleatório. As policies atuais permitem que professores criem registros para nomes Corrida.

A regra desejada: **Fases 1–4 e Corrida 1–4 são "base" da casa**. Apenas Coord/Admin editam e salvam; o registro de Corrida vira único por fase (uma só base compartilhada). Professores só visualizam.

## Alterações

### 1. Banco — base única + RLS para Corrida
Migration:

- Deduplicar registros existentes de `banco_treinos_personalizados` cujo `nome` começa com `Corrida ` (manter o mais recente por nome, apagar os demais).
- Criar índice único parcial `UNIQUE (nome) WHERE nome ILIKE 'Corrida %'` para garantir uma base por fase de Corrida.
- Substituir as policies de INSERT/UPDATE/DELETE em `banco_treinos_personalizados`:
  - INSERT: se `nome ILIKE 'Corrida %'` → exige `is_coordinator_or_admin(auth.uid())`; caso contrário mantém regra atual (`auth.uid() = criado_por`).
  - UPDATE/DELETE: se `nome ILIKE 'Corrida %'` → exige `is_coordinator_or_admin(auth.uid())`; caso contrário mantém regra atual (autor OU coord/admin).
- SELECT permanece aberto a autenticados (a base precisa ser lida por todos).

### 2. UI — `src/pages/BancoTreinos.tsx`
- **Card de Corrida**: se `!canEdit` e não houver `existing` em `banco_treinos_personalizados`, exibir badge "Somente leitura — aguardando configuração" e **bloquear o clique** (toast informativo). Se já houver `existing`, abrir em modo read-only (`readOnly={!canEdit}`) — comportamento já parcialmente presente, garantir consistência.
- **Cards de Fases 1–4** (`TemplateDetail`): já passam `canEdit`, mas reforçar:
  - Quando `!canEdit`, esconder os controles inline de séries/reps/dias/categoria (hoje só mostra valor) — já ok via `canEdit`.
  - Manter badge "Somente leitura" já existente.
- **Listagem "Meus Modelos / Modelos Professor X"**: filtrar fora os nomes que começam com "Corrida " (já filtra hoje pelo `corridaNomes` derivado de `WORKOUT_TEMPLATES`) — manter.

### 3. PersonalizadoEditor — bloqueio extra
- Quando `readOnly`, o componente já omite o botão Salvar (a confirmar no trecho relevante). Garantir que o autosave remoto também respeite `readOnly` (já faz, linha 242).

Nenhuma mudança em comportamento dos Modelos pessoais dos professores (Personalizado / Personalizado 2) — eles seguem podendo criar/editar os próprios.

## Escopo dos arquivos
- Migration SQL (1 arquivo): dedupe + índice único + 3 policies refeitas.
- `src/pages/BancoTreinos.tsx`: gate no clique do card de Corrida quando não houver base e usuário não for coord/admin.
- (Opcional) `src/components/student/workout/PersonalizadoEditor.tsx`: revisar para garantir que o botão "Salvar modelo" não aparece em `readOnly`.