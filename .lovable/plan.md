# Corrigir contagem de "Avaliações Hoje" e "Treino Exp. Hoje"

## Causa
A função `get_dashboard_data` filtra a `agenda_servicos` com:
```
WHERE dia_semana = dia_semana_hoje OR data_especifica = today_date
```
Todos os registros atuais são `tipo='avulso'` com `data_especifica` preenchida — mas também têm `dia_semana` preenchido (o DOW da data). Resultado: o `OR dia_semana = hoje` casa com **todo avulso de qualquer terça-feira passada**, inflando a contagem (hoje 16/06/2026, 1 avaliação real + 1 treino exp. real, mas o painel soma vários avulsos antigos de outras terças).

## Correção (migration)
Atualizar a CTE `agenda_hoje` em `public.get_dashboard_data`:

```sql
agenda_hoje AS (
  SELECT atividade
  FROM agenda_servicos
  WHERE (_professor_id IS NULL OR profissional_id = _professor_id)
    AND (
      (tipo = 'fixo'   AND dia_semana = dia_semana_hoje)
      OR
      (tipo = 'avulso' AND data_especifica = today_date)
    )
    AND NOT EXISTS (
      SELECT 1 FROM agenda_servicos_excecoes e
      WHERE e.agenda_id = agenda_servicos.id
        AND e.data_excecao = today_date
    )
)
```

Mudanças:
- Separa fixos (recorrência semanal) de avulsos (data única).
- Exclui ocorrências canceladas em `agenda_servicos_excecoes`.

Nenhuma alteração de UI necessária.
