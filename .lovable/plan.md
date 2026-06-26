## Diagnóstico

A Carteira mostra **81** porque filtra `planos.ativo = true`. No banco existem **205** com `status='ativo'`. Faltam **124**:

- **93** com contrato ativo, mas plano marcado `ativo=false` (importação dos 103 contratos)
- **27** com plano histórico, sem contrato ativo
- **4** sem contrato e sem plano

### Lista dos 27 (sem contrato ativo, com plano histórico)

| Nome | Telefone | Última data_fim |
|---|---|---|
| ALLANA NUNES BENTO | (53) 99992-1314 | 2026-06-12 |
| ALONSO ALEJANDRO GONZALEZ CORNEJO | (51) 98493-5581 | — |
| ANA CAROLINA TESAINER MITIDIERO | (51) 99314-6012 | 2026-06-12 |
| DAIANE HEMIELEWSKI | (51) 99917-0992 | 2027-05-10 |
| DÉBORA PERIN DECOL | (54) 99152-9129 | 2026-06-25 |
| EDUARDO C. ALTHAUS | (51) 98184-6469 | — |
| ELIEZER BERNART | (51) 98300-3886 | 2026-06-02 |
| FABIANE ELIZABETHA DE MORAES RIBEIRO | (51) 99851-7733 | — |
| FERNANDA GALLAS | (51) 99632-8727 | 2026-07-13 |
| GABRIELA BALAGUEZ | (51) 99318-3029 | — |
| GUILHERME SILVEIRA | (51) 99325-4005 | 2026-06-28 |
| GUSTAVO LUCAS AGUILAR | (51) 98158-3239 | 2026-06-16 |
| JULIA MARCHETTI | (51) 98525-8002 | — |
| KARINA SASSI | (51) 99440-3113 | 2026-08-01 |
| LAURA FERRARI MONTEMEZZO | (51) 98511-3343 | 2026-12-03 |
| LAURA KREBS ALVARES | (51) 99318-8894 | 2026-06-29 |
| LUIZ FELIPE BASTOS DUARTE | (51) 99957-0306 | — |
| MANUELE MONTANARI ARALDI | (54) 98142-3683 | 2026-10-21 |
| MARCELO SPILLARI VIOLA | (51) 99863-7200 | — |
| MÁRCIA RIBEIRO WINGERT | (51) 99653-6813 | 2026-06-25 |
| NATHÁLIA NUNES DA CONCEIÇÃO | (51) 99977-2564 | 2026-07-07 |
| PAULO SERGIO DE OLIVEIRA MACHADO | (51) 99941-7392 | — |
| RAFAELA CESAR MACHADO | (75) 1263-1318 | 2026-11-22 |
| SERGEI JÚLIO DOS SANTOS | (51) 99315-4514 | 2026-10-15 |
| SONIA MARCHETTI | (51) 99114-2494 | 2026-10-09 |
| TALITHA PERALTA | (51) 99904-4913 | 2026-06-17 |
| ZILMARA BONAI | (51) 98400-5561 | 2026-07-09 |

### Lista dos 4 (sem contrato e sem plano)

| Nome | Telefone |
|---|---|
| GABRIELLE DIAS SALTON | (51) 98433-9239 |
| JULIANA GONÇALVES MORENO | (51) 98205-7335 |
| Nicolas Squeff Janovik | 51991519640 |
| SOPHIA DE ANDRADE BICHELS | (51) 99737-8437 |

## Plano de correção (apenas dados)

1. **93 alunos com contrato ativo** → atualizar plano mais recente: `ativo=true`, `data_inicio`/`data_fim`/`valor_mensal`/`plano_tipo`/`frequencia_semanal` sincronizados com o contrato vigente.
2. **27 alunos sem contrato ativo** → reativar plano histórico mais recente (`ativo=true`):
   - se tiver `data_fim` futura, mantém;
   - se `data_fim` é passada ou nula, estende para **CURRENT_DATE + 30 dias** (provisório, até criar contrato real).
3. **4 sem nada** → criar plano básico mensal (Start, 1x/semana, valor 0) com `data_inicio=CURRENT_DATE`, `data_fim=CURRENT_DATE+30`, `ativo=true`. Vai gerar tarefa de revisão no histórico_profissional.

Resultado esperado: Carteira passa de **81 → 205** alunos.

Sem alterações em código (`.tsx`/`.ts`). Só migração/insert de dados.

Confirma executar os 3 passos?
