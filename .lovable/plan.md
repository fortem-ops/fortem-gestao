## Regra

Aluno = **Ativo** se possui um **plano ativo** (`planos.ativo = true` E `data_fim >= hoje`, ou plano de renovação automática como Start/Gympass/Wellhub/Totalpass). Caso contrário = **Inativo**.

Isso vale para o badge em **Cadastros > Alunos** e para o posicionamento nos funis **Aluno** e **Inativo** do Pipeline.

## O que muda

### 1. `src/lib/studentStatus.ts` (badge da lista de Alunos e Perfil)
- Remover o fallback "ativo" quando não há `planEnd`. Hoje, aluno sem plano aparece como Ativo — passará a Inativo.
- Nova ordem da lógica:
  1. `lead`/`prospect` → mantém
  2. Licença vigente → `Licença`
  3. Plano auto-renovável vigente (`planos.ativo = true`) → `Ativo`
  4. `planEnd` existe e `>= hoje` → `Ativo`
  5. Caso contrário (sem plano OU plano vencido) → `Inativo`

### 2. `src/pages/StudentList.tsx` e demais consumidores
- Já usam `getDisplayStatus`; nenhuma alteração necessária além de garantir que `planTipo`/`planEnd` venham só de planos com `ativo = true` (já é o caso na query atual).
- Filtro de status "Ativo/Inativo" continuará funcionando porque é baseado em `display.key`.

### 3. Pipeline — funis "Aluno" e "Inativo"
Atualizar a função `public.fn_detect_evasao()` (via migration) para refletir a mesma regra:
- Aluno **sem plano ativo** OU com plano vencido (e sem auto-renovação) → mover para a primeira etapa do funil **Inativo**.
- Aluno **com plano ativo** (auto-renovação ou `data_fim >= hoje`) atualmente em funil Inativo → mover de volta para a primeira etapa do funil **Aluno** (ex.: "Ativo").
- Manter as etapas intermediárias existentes (Risco, Renovação) conforme já implementadas.

A função roda automaticamente ao abrir o Pipeline e via botão "Detectar evasão agora", então a sincronização é imediata.

### 4. Visual
- Badge "Inativo" continua usando `status-urgent` (vermelho), label "Inativo".
- Cards no Pipeline herdam a etapa correta automaticamente após o scan.

## Fora de escopo
- Não altera tabela `alunos.status` (continua só refletindo lead/prospect/ativo/inativo bruto). A "verdade" do status visual passa a depender do plano ativo.
- Não mexe na regra de Licença (continua sobrepondo Ativo).