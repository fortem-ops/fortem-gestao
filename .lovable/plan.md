## Problema

Em **Relatório de Ponto → Diário/Período**, a tabela só lista linhas de `ponto_jornadas`. Quando um profissional simplesmente não bate ponto (ex.: Vanessa em 25/06/2026), nenhuma jornada é criada → o dia some do relatório. Hoje a falta passa despercebida.

## Solução

Gerar linhas sintéticas de **"Falta"** para cada par (profissional × dia útil) dentro do período filtrado em que:
- existe horário cadastrado em `ponto_horarios_professor` para o dia da semana, e
- **não** existe jornada em `ponto_jornadas` (já considerada hoje), e
- **não** há ausência justificada (feriado em `ponto_feriados` ou férias/folga em `ponto_ferias`).

Essas linhas aparecem misturadas com as jornadas reais, ordenadas por data desc, com badge **Falta** em vermelho na coluna Pendências e justificativa vazia. Quando houver ausência justificada (feriado/férias) e não houver jornada, a linha aparece como **"Ausência justificada"** (não conta como falta).

Refletir no resumo mensal: `pendencias` passa a somar também as faltas; `previsto_minutos` já considera o dia (a falta cai como saldo negativo automaticamente).

## Alterações

### `src/pages/RelatorioPonto.tsx`

1. **Novo tipo `LinhaDiaria`** que une jornada real e sintética:
   ```ts
   type LinhaDiaria =
     | { kind: "jornada"; jornada: Jornada }
     | { kind: "falta"; usuario_id: string; data: string; previsto: number }
     | { kind: "ausencia"; usuario_id: string; data: string; motivo: string; descricao?: string };
   ```

2. **`useMemo` de linhas sintéticas** percorrendo cada dia do intervalo `[inicio, fim]`:
   - Para cada profissional do filtro (`profId === "todos"` → todos com horário ativo; senão só ele).
   - Pular dias com jornada existente.
   - Se há horário ativo no `dia_semana`:
     - Se `ausenciaPara(uid, data)` → linha `ausencia`.
     - Senão → linha `falta`.
   - Sem horário → ignora.

3. **Merge + filtro de status**: combinar com `jornadasFiltradas`. O filtro de status ganha duas opções:
   - `falta` (somente sintéticas de falta).
   - `pendencia` passa a incluir faltas.
   - `todos` mostra tudo.

4. **`DiarioTable`** recebe `linhas: LinhaDiaria[]` em vez de `jornadas`. Renderização condicional:
   - `jornada` → linha atual.
   - `falta` → entrada/saída em "—", `Trab. = 0`, `Prev.` calculado, badge vermelho **Falta**, botão **Ajustar** abre `AjustarJornadaDialog` com `jornadaId=null` (cria jornada vazia para edição manual — exige pequeno ajuste no dialog se ainda não suportar).
   - `ausencia` → mesma estrutura visual, badge azul "Ausência justificada" e sem pendência.

5. **Agregado mensal (`agregadoMensal`)**: incluir contagem de faltas em `pendencias` e expor `faltas` separadamente (nova coluna opcional). Mínimo: somar faltas em `pendencias`. Como `previsto` já é calculado pelo horário, o saldo já reflete a falta — manter.

6. **Exportações (`handleExportDiario`)**: incluir as linhas sintéticas no CSV/XLSX (`entrada/saida/intervalo = null`, `pendencias = "Falta"` ou `"Ausência justificada"`).

### `src/components/ponto/AjustarJornadaDialog.tsx` (verificar)

Garantir que aceita criar uma jornada nova quando `jornadaId=null` recebendo `usuario_id` + `data` (provavelmente já cobre — confirmar antes de implementar; se não, adicionar). Sem alterações em RLS — coord/admin já podem inserir.

## Fora do escopo

- Não cria registros automáticos no banco (não polui `ponto_jornadas` com faltas fantasmas).
- Banco de horas: o cálculo de previsto vs trabalhado já gera o saldo negativo da falta; nenhum lançamento automático é feito.

## Verificação

- Filtrar período 01-30/06/2026, Vanessa → 25/06 aparece com badge **Falta**.
- Feriado nacional no período → linha aparece como **Ausência justificada** sem contar pendência.
- Resumo mensal de Vanessa → "Pendências" inclui a falta; "Saldo" mais negativo na medida do previsto do dia.
- Export CSV diário → linha 25/06 presente com pendência `Falta`.
