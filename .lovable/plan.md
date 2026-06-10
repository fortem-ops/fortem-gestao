## Diagnóstico

Reproduzi os três números no banco:

- **132** — o que `useCarteiraStats` (frontend) e `fn_carteira_ativos_por_profissional` (backend) retornam hoje: apenas verifica `status='ativo'`, `planos.ativo=true`, tipo na whitelist e ausência de licença vigente.
- **142** — o que aparece em Meta Global no preview do usuário. Bate exatamente com `132 + 10 VIP`, ou seja, a versão que está rodando para ele ainda não tem o ajuste da whitelist (provavelmente cache do React Query / build). Esse caso já se resolve sozinho com o novo deploy, mas o número-alvo ainda não é 132.
- **126** — o que a tela **Alunos Ativos** mostra com filtro Start/Start+/Power/Pro. Bate exatamente com a regra usada em `getDisplayStatus`/`StudentList`:
  - tipo na whitelist (Start, Start+, Power, Pro);
  - sem licença vigente;
  - **Start** é auto-renovável → sempre vigente;
  - **Start+/Power/Pro** exigem `plan_end >= hoje`, onde `plan_end = data_fim ?? (data_inicio + duracao_meses)`.

Hoje 6 alunos Start+ têm `data_fim` nulo e `data_inicio + duracao_meses` no passado, então a tela Alunos os trata como encerrados, mas Comissionamentos ainda os conta. Esses são exatamente a diferença `132 - 126 = 6`.

## Objetivo

Alinhar **Comissionamentos > Meta da carteira** (total e "meus") à mesma regra de vigência usada em **Alunos Ativos**, para que o número exibido seja **126**.

## Alterações

### 1. `src/hooks/useComissionamentos.ts` — `useCarteiraStats`

- Ampliar o `select` de planos para incluir `data_inicio, data_fim, duracao_meses`.
- Calcular o `planEnd` efetivo igual ao `StudentList`:
  ```ts
  const planEnd = p.data_fim
    ? new Date(p.data_fim + "T00:00:00")
    : addMonths(new Date(p.data_inicio), p.duracao_meses ?? 0);
  ```
- Considerar o aluno qualificado quando existe pelo menos um plano com:
  - `tipo ∈ {Start, Start+, Power, Pro}`;
  - **e** (`isAutoRenewPlan(tipo)` **ou** `planEnd >= hoje`);
  - **e** o aluno não está em licença vigente (já tratado).
- Reaproveitar `isAutoRenewPlan` de `src/lib/planTipo.ts` (Start cai como auto-renew; Start+/Power/Pro não).

### 2. `src/pages/Comissionamentos.tsx` — `CarteiraDetalhe`

- Aplicar exatamente a mesma regra na aba **Carteira > Alunos qualificados**.
- Ajustar o texto do motivo de exclusão para cobrir o novo caso:
  - "Em licença"
  - "Plano VIP/Agregador (não qualifica)"
  - "Plano vencido"
  - "Sem plano ativo qualificado"

### 3. Subtítulo do card "Meta da carteira"

Trocar de "alunos ativos qualificados (Start/Start+/Power/Pro)" para "alunos ativos com plano vigente (Start/Start+/Power/Pro)" para refletir o critério real.

## Validação esperada

Após o ajuste, com os dados atuais:
- `useCarteiraStats.total` → **126** (em vez de 132/142).
- Aba **Carteira** lista os mesmos 126 como qualificados; os 6 Start+ com plano vencido aparecem com motivo "Plano vencido".

## Fora de escopo

- Função `fn_carteira_ativos_por_profissional` no banco — não usada pela UI desta tela; mantém comportamento atual.
- `CarteiraWidget` do Dashboard — critério próprio, não tocar nesta etapa.
- Corrigir/migrar os 6 planos Start+ com `data_fim` nulo — é uma decisão operacional, não de regra do relatório.