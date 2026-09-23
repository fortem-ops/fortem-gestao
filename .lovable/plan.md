# Fiscal de Créditos — nova categoria "creditos" na Auditoria

Reaproveita toda a infraestrutura já existente: tabela `auditoria_inconsistencias`, aba `/auditoria`, widget do Dashboard e contador no menu. A lógica nova fica em uma função irmã `fn_auditoria_fiscal_creditos()`, chamada pela mesma edge function agendada.

## O que foi confirmado no banco

- Os créditos ficam em `creditos_aluno` (aluno, atividade, origem, quantidade inicial, quantidade usada, ilimitado, validade, ativo). A tela "Serviços e Créditos Contratados" lê exatamente essa tabela.
- Cada uso/estorno é registrado em `creditos_movimentos` (crédito, tipo, quantidade, agendamento, consumo).
- A origem do crédito de plano aponta para a venda (`vendas`), que aponta para o plano; o número esperado de créditos do contrato está em `contratos.creditos_total` (já é frequência × período).
- Situação atual medida: 11 créditos ativos com "usado" diferente da soma dos movimentos, 8 movimentos de consumo apontando para um agendamento que não existe mais, nenhum saldo negativo hoje.

## As três checagens

1. **Saldo não bate com o esperado** (atenção)
   Para créditos de Treino vindos de plano, compara a quantidade inicial do crédito com o total de créditos do contrato vigente daquele aluno (frequência × período). Também compara o "usado" registrado com a soma real dos movimentos (consumos menos estornos). Só dispara quando existe contrato vigente com total definido, para não gerar ruído em cadastros antigos sem contrato.

2. **Saldo negativo** (crítico)
   Crédito ativo, não ilimitado, com restante menor que zero (usado maior que o inicial).

3. **Consumo sem agendamento correspondente** (atenção)
   Movimento de consumo cujo agendamento não existe mais na agenda de serviços nem nos agendamentos de treino, ou que não tem nenhum vínculo (nem agendamento nem registro de consumo).

Todos os itens são gravados com categoria `creditos`, com o nome do aluno e a atividade na descrição, e o mesmo anti-duplicidade já usado hoje: se já existe um item aberto com mesma categoria, subtipo e registros afetados, não cria de novo.

## Detalhes técnicos

- Migração: `fn_auditoria_fiscal_creditos()` em plpgsql `SECURITY DEFINER`, mesmo padrão de `fn_auditoria_fiscal_pagamentos()`, com subtipos `saldo_divergente_formula`, `usado_divergente_movimentos`, `saldo_negativo`, `consumo_sem_agendamento`; retorna JSON com a contagem por subtipo.
- `supabase/functions/auditoria-fiscal-pagamentos/index.ts`: passa a invocar também `fn_auditoria_fiscal_creditos` e devolve os dois resultados; sem mudança no cron (09:00 UTC).
- `src/pages/Auditoria.tsx`: adiciona `creditos` ao filtro de categoria e ao mapa `CATEGORIA_LABEL` ("Créditos").
- `src/components/dashboard/AuditoriaWidget.tsx`: adiciona "Créditos" ao `CATEGORIA_LABEL`.
- `src/hooks/useAuditoria.ts`: sem mudança de tipo necessária (categoria é texto livre); contadores e resumo já agregam qualquer categoria.
- Após aplicar: rodar a função uma vez e reportar a contagem por subtipo; validar com consulta direta no banco antes de dar como concluído.
- Nada de RLS novo: a tabela já tem leitura para a equipe e escrita/encerramento só para admin.
