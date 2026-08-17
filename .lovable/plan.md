# Jornada partida (2 turnos) — exceção por dia

## Problema confirmado

Nos dias 10/07, 15/07, 17/07, 20/07 e 24/07 o Bruno trabalhou em dois turnos, e o sistema só sabe representar um bloco (entrada → intervalo → saída). Consequências verificadas no banco:

- O vão entre os turnos foi gravado como "intervalo" (185 a 246 min contra 60 min previstos) → gerou desconto grande no banco de horas.
- O turno da manhã fica fora do horário previsto do dia (ex.: previsto 12:00–20:00) → gerou "hora extra" indevida.
- Em 10/07 a saída (11:26) ficou antes do fim do intervalo (14:57), zerando os minutos trabalhados do dia.

Exemplo (minutos): 10/07 → 656 descontáveis e 235 extras; 15/07 → 292 e 337; 20/07 → 122 e 309.

## Solução

Marcar o dia como **jornada partida**. Nesses dias a carga prevista continua a mesma do horário padrão do profissional (ex.: 8h), mas o cálculo passa a comparar o **total efetivamente trabalhado x total previsto do dia**, ignorando as divergências ponto a ponto (entrada, saída e duração do intervalo). Assim o vão entre turnos não vira desconto e o início antecipado não vira extra.

Regra:

```text
trabalhado = (saída - entrada) - (intervalo_fim - intervalo_inicio)
previsto   = (horário_fim - horário_início) - intervalo_previsto
diferença  = trabalhado - previsto
  diferença < -tolerância  → desconto (só o excedente da tolerância)
  diferença > +tolerância  → hora extra (só o excedente)
  dentro da tolerância     → sem lançamento
```

Continua sendo um recurso permanente, disponível para qualquer profissional e qualquer dia, com motivo obrigatório e registro em log de auditoria.

## Como o usuário vai usar

1. Em Relatório de Ponto (visão diária), no botão **Ajustar** do dia, aparece uma nova opção **"Jornada partida (2 turnos)"** com campo de motivo.
2. Ao ativar, o dia é recalculado na hora e o banco de horas do mês é reconsolidado — a tela atualiza sem refresh.
3. A linha do dia passa a exibir um selo **"2 turnos"** para identificação visual.
4. Também é possível desmarcar (volta ao cálculo normal).
5. Os horários do dia continuam editáveis normalmente pelo mesmo diálogo — em 10/07 será preciso corrigir a saída, que hoje está antes do fim do intervalo.

## Detalhes técnicos

**Banco**
- Nova coluna `ponto_jornadas.jornada_partida boolean not null default false`.
- `fn_ponto_calcular_divergencias`: quando `jornada_partida = true`, calcular pelo saldo total do dia (regra acima) em vez das divergências por marcação; `divergencia_intervalo_min` fica zerada e `status_ponto` é derivado do saldo (banco_negativo / hora_extra / dentro_tolerancia).
- Nova RPC `fn_ponto_marcar_jornada_partida(_jornada_id uuid, _valor boolean, _motivo text)`, SECURITY DEFINER, restrita a admin/coordenador, com motivo mínimo de 10 caracteres. Ela grava a flag, insere registro em `ponto_ajustes_log`, chama `fn_ponto_calcular_divergencias` e `fn_ponto_consolidar_banco` do mês. GRANT EXECUTE para `authenticated`.
- Reprocessar os 5 dias do Bruno já marcando-os como jornada partida na própria migration (mantendo o bypass de fechamento aprovado já existente).

**Front-end**
- `src/components/ponto/AjustarJornadaDialog.tsx`: switch "Jornada partida (2 turnos)" com texto explicativo, chamando a nova RPC; usa `invalidateBancoHoras` + invalidação das chaves `relatorio-*` / `ponto-*` já existentes.
- `src/pages/RelatorioPonto.tsx`: selecionar o campo `jornada_partida` na query e exibir o selo "2 turnos" na linha do dia.
- Sem alteração no PDF de fechamento nesta etapa (os totais já vêm corrigidos do banco).
