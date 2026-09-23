# Aceites do Tecnofit + Fiscal de Contratos

Decisões: 1a (criar documento de registro para quem não tem), 2b (você escolhe os 7 casos), 3 sim (gravar mesmo com aceite anterior ao contrato atual).

## Lista final para gravar (conferida, nada gravado ainda)

- **35 documentos existentes sem aceite** recebem o aceite do Tecnofit. (Eram 31 na simulação anterior; a conta subiu porque agora considero todos os documentos de contratos ativos/suspensos, não só o mais recente.)
- **101 documentos novos** "Aceite migrado do Tecnofit", já aceitos com a data da planilha.
- **4 já aceitos** no sistema atual: não mexo.
- **6 sem contrato ativo**: ficam de fora.
- **69 casos com aceite anterior à criação do contrato atual.** Quase todos os contratos foram criados em 25/06/2026, na importação do Tecnofit, então isso é esperado. Serão gravados (decisão 3).

## Os 7 com mais de um contrato ativo — sugestão por caso (confirme ou corrija)

Contrato no Tecnofit → contrato sugerido no sistema:

| Aluno | Tecnofit (aceite) | Sugestão |
|---|---|---|
| Bruna Meyer | PRO 3x (12/01/2026) | Pro, 12/01/2026–12/01/2027 (não o de Corrida) |
| Carmem Maria Galvão | PRO 3x (28/11/2025) | Pro, 05/12/2025–05/12/2026 |
| Cecilia Pelisoli Gafforelli | Recorrente 3x Wellhub (19/02/2026) | Start+, 19/02/2026–19/02/2027 |
| Gabrieli Anay Pivetta Clerice | Recorrente 3x Wellhub (12/02/2026) | Start+, 13/02/2026–13/02/2027 |
| Juliana Leote Ribeiro | Power 2x (27/03/2026) | Power, 25/10/2025–25/10/2026 |
| Laura de Castro e Garcia | Start+ 2x (10/04/2026) | Start+, 19/01/2026–19/01/2027 |
| Paula Cerski Lavratti | Start 3x mensal (24/08/2026) | Start, 27/08/2026–24/09/2026 (o Power começa em 28/09 e fica sem aceite) |

Nos 7 casos, os contratos de Corrida (e o Power da Paula) ficam sem aceite migrado e seguem pelo fluxo normal de aceite.

## Como fica registrado que veio do Tecnofit

- `formato_aceite = 'migracao_tecnofit'`; `data_aceite` = data da planilha no horário de Brasília.
- `variaveis_utilizadas` guarda origem "tecnofit", código do cliente, nome do contrato no Tecnofit e o texto original do aceite.
- Documentos novos: texto "Aceite registrado no sistema anterior (Tecnofit) em dd/mm/aaaa hh:mm — contrato: X", sem modelo, versão 0.
- A gravação só atinge documentos com aceite = falso; nenhum aceite atual é sobrescrito.

## Etapas após aprovação

1. Gravar os aceites (35 atualizações + 101 documentos novos + os 7 conforme a tabela acima) em uma única operação; conferir as contagens depois.
2. Fiscal de Contratos:
   - `aceite_pendente`: documento sem aceite há mais de 7 dias. Atenção até 30 dias; crítico acima de 30 dias com contrato ativo.
   - `contrato_sem_documento`: contrato ativo ou suspenso sem documento. Atenção.
   - Ignora cancelados, encerrados, TotalPass e Gympass. Corrida entra. Ficha de saúde fica de fora.
   - Aceite migrado do Tecnofit conta como válido.
   - Roda no job diário com os outros quatro fiscais. Categoria "Contratos" na Auditoria, no widget do Dashboard e no contador do menu.
3. Rodar o fiscal e informar a contagem por tipo de alerta.

## Detalhes técnicos

- Dados gravados pelo executor de SQL com lista fixa de ids (não por migração), WHERE `aceite = false` nas atualizações.
- Migração `fiscal_contratos`: `fn_auditoria_fiscal_contratos()` SECURITY DEFINER, search_path=public, EXECUTE só service_role.
- Job 33 chama os 5 fiscais; edge `auditoria-fiscal-pagamentos` devolve `resultado_contratos` e é redeployada.
- Frontend: `src/pages/Auditoria.tsx`, `src/components/dashboard/AuditoriaWidget.tsx`. Nada de Rede, cobranças ou grants de outras funções.
