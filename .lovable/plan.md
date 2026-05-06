## Objetivo

Automatizar o status do aluno conforme o ciclo do plano, ajustar cores dos status e introduzir o controle de **Licenças** (Plano e Médica) com limites por tipo de plano.

---

## 1. Status automático e cores

Hoje o `status` em `alunos` é fixo no banco. A regra ficará:

- **Ativo** (verde — `status-active`): plano ativo e dentro da vigência.
- **Licença** (roxo — nova classe `status-license`): existe licença vigente (Plano ou Médica).
- **Inativo / Encerrado** (vermelho — `status-urgent`): data final do plano < hoje **e** sem licença vigente.

A cor "Inativo" já é vermelha. Será criada nova utilitária roxa em `index.css`:

```css
--license: 270 70% 55%;
.status-license { @apply bg-[hsl(var(--license))]/15 text-[hsl(var(--license))] border border-[hsl(var(--license))]/30; }
```

O cálculo do status exibido será derivado em runtime (sem mudar o `status` salvo no banco para não conflitar com pipeline `lead/prospect`). Componentes afetados:

- `src/pages/StudentList.tsx` — coluna Status passa a usar `getDisplayStatus(student, plano, licencaVigente)`.
- `src/pages/StudentProfile.tsx` — header do aluno.
- `src/components/student/StudentSummary.tsx` — card "Status" (Plano e Cadastrais).

Helper novo: `src/lib/studentStatus.ts` retornando `{ key: 'ativo'|'licenca'|'encerrado', label, className }`.

---

## 2. Licenças — modelo de dados

Nova tabela `aluno_licencas`:

| campo | tipo | nota |
|---|---|---|
| id | uuid PK | |
| aluno_id | uuid | |
| plano_id | uuid | plano vigente quando criada |
| tipo | text | `plano` ou `medica` |
| data_inicio | date | |
| data_fim | date | |
| dias | integer | calculado (fim - início + 1) |
| motivo | text nullable | |
| arquivo_url | text nullable | atestado (médica) |
| criado_por | uuid | |
| created_at / updated_at | | |

Validação por **trigger** (não CHECK, pois envolve consulta a outra tabela):

- `dias > 0` e `data_fim >= data_inicio`.
- Se `tipo = 'plano'`: limite por `planos.tipo` → Start+ 10, Power 15, Pro 20, Max 30. Plano Start não permite Licença do Plano.
- Se `tipo = 'medica'`: até 30 dias para Start, Start+, Power, Pro, Max.
- Soma de dias de licenças do mesmo tipo no plano vigente não pode ultrapassar o limite.

RLS: SELECT autenticados; INSERT/UPDATE/DELETE para coord/admin (`is_coordinator_or_admin`).

Ao final da vigência, o status volta automaticamente para "Ativo" (derivado em runtime; nenhum job necessário).

---

## 3. UI — gerenciar licenças

Em **Resumo > Plano** (`StudentPlan.tsx`), adicionar nova seção **"Licenças"** abaixo dos Créditos:

- Lista das licenças do plano vigente (tipo, período, dias, status `vigente|encerrada|futura`).
- Botão **"Adicionar licença"** (visível para coord/admin) → abre `AddLicencaDialog` com:
  - Tipo: `Licença do Plano` | `Licença Médica` (radio).
  - Data início / Data fim (com cálculo em tempo real dos dias).
  - Motivo (opcional).
  - Upload de atestado (opcional, médica).
  - Aviso do limite restante para o tipo escolhido (ex.: "Pro: 20 dias permitidos, 12 já usados, 8 disponíveis").
  - Bloqueio do submit se ultrapassar limite.
- Excluir licença (coord/admin).

Novo arquivo: `src/components/student/AddLicencaDialog.tsx`.
Helper de limites: `src/lib/licencas.ts` exportando `LICENCA_LIMITS` e `getLimiteDisponivel(plano, licencas, tipo)`.

---

## 4. Detalhes técnicos

- Limites centralizados em `src/lib/licencas.ts`:
  ```ts
  export const LICENCA_PLANO: Record<string, number> = {
    "Start+": 10, "Power": 15, "Pro": 20, "Max": 30,
  };
  export const LICENCA_MEDICA = 30;
  export const PLANOS_ELEGIVEIS_MEDICA = ["Start","Start+","Power","Pro","Max"];
  ```
- Mesma constante usada no trigger (via tabela `pipeline_metadata` não — apenas validação nativa SQL com CASE por nome do plano).
- `getDisplayStatus`: prioridade Licença > Encerrado > Ativo.

---

## 5. Arquivos

**Novos**
- `supabase/migrations/<timestamp>_aluno_licencas.sql` (tabela + RLS + triggers)
- `src/lib/licencas.ts`
- `src/lib/studentStatus.ts`
- `src/components/student/AddLicencaDialog.tsx`
- `src/components/student/StudentLicencas.tsx` (lista renderizada dentro de `StudentPlan`)

**Editados**
- `src/index.css` — token e utilitária `.status-license`
- `src/components/student/StudentPlan.tsx` — seção de licenças + badge do plano usando status derivado
- `src/components/student/StudentSummary.tsx` — status com cor correta (roxo / vermelho)
- `src/pages/StudentList.tsx` — coluna Status derivada + cor
- `src/pages/StudentProfile.tsx` — header com status derivado
