
# Expansão do módulo Ponto

Este é um escopo grande (6 grandes blocos funcionais). Proponho dividir em **6 fases** para entregar incrementalmente, cada uma testável de forma isolada. Confirme se quer ir nessa ordem ou priorizar algo.

---

## Fase 1 — Cadastro Trabalhista do Funcionário

**Banco de dados**
- Nova tabela `public.cadastro_trabalhista` (1:1 com `profiles`/usuário):
  - `tipo_vinculo` (enum: horista, mensalista, pj, estagiario, autonomo, coordenador_gestao)
  - `valor_hora_aula` (numeric)
  - `carga_horaria_semanal` (int, minutos)
  - `limite_diario_min` (int)
  - `banco_horas_ativo` (bool)
  - `elegivel_ponto` (bool, default true)
  - `art_62_clt` (bool, default false) — cargo de confiança, dispensa controle
- RLS: admin gerencia, dono lê o próprio.

**UI**
- Nova aba em `Admin → Ponto → Vínculos` (ao lado de Horários/Feriados/Férias).
- Tabela listando colaboradores + dialog de edição.
- No widget/perfil pessoal: exibir tipo de vínculo e flags.

**Regras**
- Se `elegivel_ponto=false` ou `art_62_clt=true`, esconder marcações de ponto e excluir de fechamentos.

---

## Fase 2 — Tratamento de Janelas (jornada efetiva × tempo ocioso)

**Lógica**
- Função SQL `fn_ponto_calcular_janelas(_usuario, _data)` retornando:
  - `tempo_trabalhado_min` (soma das aulas/blocos com aluno)
  - `tempo_ocioso_min` (gaps entre aulas dentro do período no estabelecimento)
  - `tempo_total_estabelecimento_min` (entrada → saída − intervalos formais)
- Cruzar `agenda` (aulas confirmadas) com `ponto_jornadas` para detectar janelas.

**UI**
- Em `ResumoDoDia` e `MeuRelatorioPonto`: 3 cards (Trabalhado / Ocioso / No local).
- Dashboard coordenador: KPI adicional de tempo ocioso médio.

---

## Fase 3 — Sistema de Substituições

**Banco**
- `public.ponto_substituicoes`:
  - `substituto_id`, `substituido_id`, `data`, `hora_inicio`, `hora_fim`, `motivo`, `qtd_horas`, `valor_hora_aplicado`, `forma_pagamento` (pagamento | banco_horas), `status` (pendente/aprovado).
- Trigger: ao aprovar, lança no fechamento mensal do substituto (extras pagas ou banco+).

**UI**
- Nova aba em `Ponto → Substituições`: criar/listar substituições.
- Validação: bloquear se ultrapassar 10h/dia ou 2h extras/dia do substituto.

**Cálculo**
- `valor_hora_aplicado` puxa de `cadastro_trabalhista.valor_hora_aula` do substituto por padrão (editável).

---

## Fase 4 — Motor Completo de Banco de Horas

**Banco**
- Já existe `banco_horas`. Estender com:
  - `competencia` (date — primeiro dia do mês/ano da regra)
  - `vencimento` (date)
  - `tipo_lancamento` (credito/debito/compensacao/vencimento/rescisao)
  - `auditoria_jsonb` (quem, quando, ação)
- Job `pg_cron` mensal: expira saldos vencidos → lança `vencimento`.
- Função `fn_ponto_calcular_rescisao(_usuario, _data_saida)`: paga saldo positivo, zera negativo conforme regra.

**Regras de validação (triggers)**
- Bloquear lançamento que ultrapasse 2h extras/dia.
- Bloquear jornada >10h/dia.

**UI**
- `MeuBancoHoras` + `AdminBancoHorasTable`: adicionar colunas de competência, vencimento, tipo.
- Tela de "Fechamento anual" no Admin Ponto.

---

## Fase 5 — Atividades Especiais (eventos)

**Banco**
- `ponto_atividades_especiais`: `nome`, `data`, `hora_inicio`, `hora_fim`, `descricao`.
- `ponto_atividades_participantes`: `atividade_id`, `usuario_id`, `horas`, `forma_pagamento` (pagamento|banco), `valor_hora`.
- Validação: máx 8h por participante por evento.

**UI**
- Aba `Admin → Ponto → Atividades Especiais`: CRUD eventos + vincular profissionais.
- Integração com fechamento mensal (igual substituições).

---

## Fase 6 — Controle de Intervalos (acordos individuais)

**Banco**
- `ponto_acordos_intervalo`: `usuario_id`, `tipo` (estendido_2h | reduzido_30min), `vigencia_inicio`, `vigencia_fim`, `documento_url`, `aceite_digital_em`, `aceite_ip`.
- Storage bucket `acordos-intervalo` (privado, RLS por dono+admin).

**UI**
- Em `Admin → Ponto → Vínculos`: ação "Registrar acordo" → upload PDF + aceite digital.
- Validador de jornada consulta acordo vigente antes de marcar divergência de intervalo.

---

## Detalhes técnicos

- Todas as migrations usam triggers (não CHECK) para validações temporais.
- Funções de cálculo com `security definer` + `set search_path = public`.
- Reusar tokens semânticos (`bg-success/15`, `text-warning`, etc.) — sem cores hardcoded.
- Edge function `ponto-fechamento-mensal` atualizada para consolidar: jornadas + substituições + atividades + banco de horas.

---

## Pergunta

Posso começar pela **Fase 1 (Cadastro Trabalhista)** já que ela é pré-requisito de quase tudo (valor hora, elegibilidade, art. 62)? Ou prefere outra ordem / quer fatiar mais?
