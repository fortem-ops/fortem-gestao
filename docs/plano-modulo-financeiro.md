# Plano — Módulo Financeiro & Contratos

**Status:** planejado, não implementado. Discussão concluída em 2026-06-24.
**Escopo:** contratos, cobranças, ciclos de crédito, inadimplência, rescisão calculada automaticamente.

---

## Visão geral

O módulo financeiro é o coração operacional do sistema. Centraliza o vínculo
jurídico (contrato), os eventos financeiros (cobranças), a liberação de créditos
de treino e a régua de inadimplência — tudo derivado diretamente das cláusulas
contratuais de cada plano.

---

## Regras de negócio consolidadas (todos os contratos)

### Créditos por frequência

| Frequência | Mensal (Start) | Anual (Start+/Power/Pro/Max) |
|------------|---------------|------------------------------|
| 1x/semana  | 4 créditos    | 52 créditos                  |
| 2x/semana  | 8 créditos    | 104 créditos                 |
| 3x/semana  | 12 créditos   | 156 créditos                 |
| Livre      | 20 créditos   | 260 créditos                 |

> **Planos anuais:** créditos liberados **todos na assinatura**, independente
> da forma de pagamento (parcelado ou recorrência).

### Serviços complementares por plano

| Plano   | Avaliações | Consultas incluídas |
|---------|-----------|----------------------|
| Start   | 0         | nenhuma              |
| Start+  | 1         | nenhuma              |
| Power   | 1         | 2 nutrição **ou** 2 fisio (escolha) |
| Pro     | 2         | 4 nutrição **ou** 4 fisio **ou** 2+2 (escolha) |
| Max     | 3         | 5 nutrição **E** 5 fisio (ambas, sem escolha) |

> Valores fixos: nutrição R$ 300,00 · fisioterapia R$ 150,00
> Não reembolsáveis em nenhuma hipótese após utilização.

### Trancamento máximo por plano

| Plano   | Normal    | Por doença/lesão (com atestado) |
|---------|-----------|----------------------------------|
| Start   | não tem   | 30 dias (único)                  |
| Start+  | 10 dias   | 30 dias                          |
| Power   | 15 dias   | 30 dias                          |
| Pro     | 20 dias   | 30 dias                          |
| Max     | 30 dias   | 30 dias                          |

> Trancamento: 1 vez por vigência contratual. Período adicionado ao final do contrato.
> Start aceita apenas trancamento por doença/lesão com atestado.

---

## Schema das 4 tabelas novas

### `contratos`

```sql
CREATE TABLE public.contratos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id                uuid NOT NULL REFERENCES public.alunos(id),
  plano_tipo              text NOT NULL,
  -- 'start' | 'start_plus' | 'power' | 'pro' | 'max' | 'corrida' | ...
  frequencia_semanal      smallint NOT NULL CHECK (frequencia_semanal IN (1,2,3,0)),
  -- 0 = livre
  creditos_total          integer NOT NULL,
  vigencia_tipo           text NOT NULL CHECK (vigencia_tipo IN ('mensal','anual')),
  data_inicio             date NOT NULL,
  data_fim                date,
  -- null = mensal indefinido (Start)
  data_renovacao          date,
  -- próxima renovação automática
  forma_pagamento         text NOT NULL,
  -- 'cartao_recorrencia' | 'cartao_parcelado' | 'pix_automatico'
  -- | 'boleto' | 'maquina_debito' | 'maquina_credito' | 'dinheiro'
  valor_base              numeric(10,2) NOT NULL,
  valor_cobrado           numeric(10,2) NOT NULL,
  -- já inclui taxa_recorrencia se aplicável
  taxa_recorrencia        numeric(10,2) NOT NULL DEFAULT 0,
  -- 0 ou 20 ou valor especial por condição comercial
  parcelas                smallint NOT NULL DEFAULT 1,
  status                  text NOT NULL DEFAULT 'ativo',
  -- 'ativo' | 'suspenso' | 'cancelado' | 'inadimplente' | 'encerrado'
  indice_reajuste         text,
  -- 'igpm' | 'ipca' | 'fixo' | null
  percentual_reajuste     numeric(5,2),
  multa_percentual        numeric(5,2),
  -- % da multa contratual (25, 20 ou 15 dependendo do mês)
  cartao_token_id         uuid REFERENCES public.cartoes_salvos(id) ON DELETE SET NULL,
  notificacao_30d_enviada boolean NOT NULL DEFAULT false,
  criado_por              uuid REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
```

### `cobrancas`

```sql
CREATE TABLE public.cobrancas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id      uuid NOT NULL REFERENCES public.contratos(id),
  aluno_id         uuid NOT NULL REFERENCES public.alunos(id),
  numero_ciclo     smallint NOT NULL,
  -- 1 = primeira cobrança, 2 = segunda...
  valor            numeric(10,2) NOT NULL,
  data_vencimento  date NOT NULL,
  data_pagamento   date,
  status           text NOT NULL DEFAULT 'pendente',
  -- 'pendente' | 'pago' | 'atrasado' | 'cancelado' | 'isento'
  forma_pagamento  text NOT NULL,
  meio_registro    text NOT NULL DEFAULT 'automatico',
  -- 'automatico' | 'manual_admin' | 'gateway_webhook'
  gateway          text,
  -- 'rede' | 'inter_pix' | 'boleto' | 'maquina' | 'dinheiro' | null
  tid              text,
  comprovante_url  text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

### `ciclos_credito`

```sql
CREATE TABLE public.ciclos_credito (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         uuid NOT NULL REFERENCES public.contratos(id),
  cobranca_id         uuid REFERENCES public.cobrancas(id),
  creditos_liberados  integer NOT NULL,
  creditos_usados     integer NOT NULL DEFAULT 0,
  data_inicio         date NOT NULL,
  data_fim            date,
  -- null = não expira (planos anuais com créditos liberados na assinatura)
  status              text NOT NULL DEFAULT 'ativo',
  -- 'ativo' | 'suspenso' | 'expirado' | 'cancelado'
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

### `inadimplencias`

```sql
CREATE TABLE public.inadimplencias (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id          uuid NOT NULL REFERENCES public.contratos(id),
  cobranca_id          uuid NOT NULL REFERENCES public.cobrancas(id),
  aluno_id             uuid NOT NULL REFERENCES public.alunos(id),
  data_vencimento      date NOT NULL,
  valor                numeric(10,2) NOT NULL,
  dias_atraso          integer GENERATED ALWAYS AS
                         (CURRENT_DATE - data_vencimento) STORED,
  status               text NOT NULL DEFAULT 'aberta',
  -- 'aberta' | 'regularizada' | 'cancelada'
  data_regularizacao   date,
  notificacoes         jsonb NOT NULL DEFAULT '{}',
  -- { "d0": "2026-06-01T07:00:00Z", "d3": null, "d7": null }
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

---

## Fluxo de cancelamento antecipado com cálculo rescisório

Esta é a funcionalidade mais complexa do módulo. Ao solicitar cancelamento,
o sistema calcula automaticamente todos os valores devidos e os exibe de forma
clara antes de confirmar.

### Regras por tipo de contrato

#### Start (mensal, sem fidelidade)
- Sem multa de cancelamento
- Acesso mantido até o fim do ciclo já pago
- Cobranças futuras interrompidas imediatamente

#### Start+ / Power / Pro / Max — Recorrência mensal (12 meses)

**Lógica:** multa sobre as **mensalidades vincendas** (ainda não cobradas).

```
meses_vincendos = meses_restantes_do_contrato
valor_vincendo  = meses_vincendos × valor_mensalidade

percentual_multa:
  mês 1–4  → 25%
  mês 5–6  → 20%
  mês 7–12 → 15%

valor_multa = valor_vincendo × percentual_multa

serviços_utilizados:
  nutrição utilizada  → R$ 300,00 (integral, parcelado em 12x = R$ 25/mês × meses_vincendos)
  fisio utilizada     → R$ 150,00 (integral, parcelado em 12x = R$ 12,50/mês × meses_vincendos)

total_devido = valor_multa + serviços_vincendos_utilizados
```

#### Start+ / Power / Pro / Max — Parcelado em até 12x no cartão

**Lógica:** restituição proporcional com desconto (devolve parte do que pagou a mais).

```
meses_utilizados    = meses desde início até hoje
meses_restantes     = 12 - meses_utilizados
valor_proporcional_restante = (meses_restantes / 12) × valor_total_contrato

percentual_restituicao:
  mês 1–4  → 75% do valor proporcional restante
  mês 5–6  → 80%
  mês 7–12 → 85%

valor_restituicao_bruto = valor_proporcional_restante × percentual_restituicao

deducoes:
  serviços utilizados → valor integral deduzido da restituição
  (nutrição R$ 300 e/ou fisio R$ 150 por serviço usado)

valor_restituicao_final = valor_restituicao_bruto - deducoes_servicos
```

> Se `valor_restituicao_final < 0`, o aluno ainda deve a diferença.

### Exibição no sistema — Dialog de cancelamento

Ao clicar em "Cancelar contrato", abrir um `AlertDialog` com três seções:

**Seção 1 — Resumo do contrato**
```
Plano:          Power em Recorrência
Início:         01/01/2026
Fim previsto:   31/12/2026
Mês atual:      6º mês
Meses restantes: 6 meses (jul–dez/2026)
Valor mensal:   R$ 320,00 (inclui taxa recorrência R$ 20,00)
```

**Seção 2 — Cálculo rescisório detalhado**

*Para Recorrência:*
```
Mensalidades vincendas:    6 × R$ 320,00 = R$ 1.920,00
Percentual de multa:       20% (5º–6º mês)
Valor da multa:            R$ 384,00

Serviços complementares utilizados:
  ✓ Consulta nutricional   R$ 300,00 (usado em 15/03/2026)
    Parcelas vincendas:    6 × R$ 25,00 = R$ 150,00
  ✗ Consulta fisioterapia  R$ 0,00 (não utilizado)

Total a pagar para cancelar:  R$ 534,00
```

*Para Parcelado:*
```
Valor total do contrato:        R$ 3.600,00
Meses utilizados:               6 de 12
Valor proporcional restante:    R$ 1.800,00
Percentual de restituição:      80% (5º–6º mês)
Valor bruto a restituir:        R$ 1.440,00

Deduções — serviços utilizados:
  ✓ Consulta nutricional   R$ 300,00
  ✗ Consulta fisioterapia  R$ 0,00

Valor a restituir ao aluno:     R$ 1.140,00
(via estorno no cartão ou transferência, a critério da Fortem)
```

**Seção 3 — Condições pós-cancelamento**
```
✓ Acesso mantido até: [data fim do ciclo atual ou imediato]
✓ Cobranças futuras: interrompidas imediatamente
✓ Créditos restantes: [N créditos] — expiram ao fim do acesso
⚠ Serviços não utilizados: não reembolsáveis após o cancelamento
```

**Botões:**
- "Confirmar cancelamento" → registra no banco + gera cobrança de rescisão se houver multa
- "Voltar" → fecha sem ação

### Função SQL de cálculo rescisório

```sql
CREATE OR REPLACE FUNCTION public.fn_calcular_rescisao(p_contrato_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_contrato       public.contratos%ROWTYPE;
  v_mes_atual      int;
  v_meses_rest     int;
  v_perc_multa     numeric;
  v_perc_restit    numeric;
  v_valor_vincendo numeric;
  v_valor_multa    numeric;
  v_restit_bruto   numeric;
  v_servicos       numeric := 0;
  v_resultado      jsonb;
BEGIN
  SELECT * INTO v_contrato FROM public.contratos WHERE id = p_contrato_id;

  -- Mês atual (1-12)
  v_mes_atual  := EXTRACT(MONTH FROM age(CURRENT_DATE, v_contrato.data_inicio))::int + 1;
  v_mes_atual  := LEAST(v_mes_atual, 12);
  v_meses_rest := 12 - v_mes_atual;

  -- Start: sem multa
  IF v_contrato.vigencia_tipo = 'mensal' THEN
    RETURN jsonb_build_object(
      'tipo', 'start_sem_multa',
      'total_devido', 0,
      'total_restituir', 0,
      'descricao', 'Plano mensal sem fidelidade. Sem multa. Acesso mantido até fim do ciclo pago.'
    );
  END IF;

  -- Percentual por mês
  v_perc_multa := CASE
    WHEN v_mes_atual <= 4 THEN 0.25
    WHEN v_mes_atual <= 6 THEN 0.20
    ELSE 0.15
  END;
  v_perc_restit := CASE
    WHEN v_mes_atual <= 4 THEN 0.75
    WHEN v_mes_atual <= 6 THEN 0.80
    ELSE 0.85
  END;

  -- Serviços complementares utilizados (buscar em consumo_servicos)
  SELECT COALESCE(SUM(
    CASE tipo_servico
      WHEN 'nutricao'    THEN 300.00
      WHEN 'fisioterapia' THEN 150.00
      ELSE 0
    END
  ), 0) INTO v_servicos
  FROM public.consumo_servicos
  WHERE contrato_id = p_contrato_id AND utilizado = true;

  -- Recorrência: cobra multa sobre vincendas
  IF v_contrato.forma_pagamento = 'cartao_recorrencia' THEN
    v_valor_vincendo := v_meses_rest * v_contrato.valor_cobrado;
    -- Serviços parcelados em 12x: vincendas proporcionais
    v_valor_multa := (v_valor_vincendo * v_perc_multa)
                   + (v_servicos / 12.0 * v_meses_rest);

    RETURN jsonb_build_object(
      'tipo',               'recorrencia_com_multa',
      'mes_atual',          v_mes_atual,
      'meses_restantes',    v_meses_rest,
      'valor_mensalidade',  v_contrato.valor_cobrado,
      'valor_vincendo',     v_valor_vincendo,
      'percentual_multa',   (v_perc_multa * 100)::int,
      'multa_base',         ROUND(v_valor_vincendo * v_perc_multa, 2),
      'servicos_vincendos', ROUND(v_servicos / 12.0 * v_meses_rest, 2),
      'total_devido',       ROUND(v_valor_multa, 2),
      'total_restituir',    0
    );
  END IF;

  -- Parcelado: restitui com desconto
  v_restit_bruto := ((v_meses_rest::numeric / 12) * v_contrato.valor_cobrado * v_contrato.parcelas)
                    * v_perc_restit;

  RETURN jsonb_build_object(
    'tipo',                  'parcelado_com_restituicao',
    'mes_atual',             v_mes_atual,
    'meses_restantes',       v_meses_rest,
    'valor_total_contrato',  v_contrato.valor_cobrado * v_contrato.parcelas,
    'valor_proporcional',    ROUND((v_meses_rest::numeric / 12) * v_contrato.valor_cobrado * v_contrato.parcelas, 2),
    'percentual_restituicao',(v_perc_restit * 100)::int,
    'restituicao_bruta',     ROUND(v_restit_bruto, 2),
    'deducao_servicos',      v_servicos,
    'total_restituir',       ROUND(GREATEST(v_restit_bruto - v_servicos, 0), 2),
    'saldo_devedor',         ROUND(GREATEST(v_servicos - v_restit_bruto, 0), 2),
    'total_devido',          ROUND(GREATEST(v_servicos - v_restit_bruto, 0), 2)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_calcular_rescisao IS
  'Calcula o resumo financeiro completo de rescisão antecipada de um contrato. '
  'Retorna JSONB com tipo, valores detalhados e percentuais aplicados. '
  'Baseado nas cláusulas 13 de todos os contratos da Fortem (2026).';
```

---

## Régua de inadimplência automática (pg_cron — diário 07:00)

```
Todo dia às 07:00:
│
├── Cobranças vencidas hoje (status=pendente, data_vencimento=HOJE)
│   ├── contrato com cartao_token_id ativo
│   │   └── chamar rede-cobrar-token (recorrência automática)
│   └── demais → criar inadimplencia + notificar aluno (D+0)
│
├── Inadimplências abertas
│   ├── D+3  → notificação interna para admin/coord
│   ├── D+7  → suspender acesso (contrato.status='suspenso',
│   │          ciclos_credito.status='suspenso')
│   └── D+30 → cancelar contrato automaticamente
│              (fn_calcular_rescisao para registrar débito)
│
└── Contratos anuais próximos do fim
    └── 30 dias antes de data_fim → notificação ao aluno sobre renovação
        + possível reajuste (notificacao_30d_enviada = true)
```

---

## Regras especiais

### Start — inadimplência
- Falha na renovação → **acesso suspenso imediatamente** (D+0)
- Créditos **não expiram** — ficam congelados até regularização
- Sem multa de cancelamento

### Upgrade de frequência (dentro do mesmo plano)
```
créditos_adicionais = freq_nova - freq_atual (em créditos anuais)
dias_restantes      = data_fim - CURRENT_DATE
valor_proporcional  = (créditos_adicionais / créditos_anuais_novo)
                    × valor_anual_novo
                    × (dias_restantes / 365)
-- Aluno paga este valor antes de ativar
```

### Upgrade de categoria (ex: Power → Pro)
- Novo contrato criado
- Contrato anterior cancelado (sem multa neste caso específico)
- Serviços complementares já utilizados: valores vencidos permanecem exigíveis

### Downgrade de frequência
- Proibido durante a vigência
- Permitido apenas na renovação do próximo ciclo

### Transferência de plano para terceiro
- Admin registra manualmente
- Terceiro assina novo contrato
- Contrato original encerrado sem multa

---

## Visões financeiras

### Perfil do aluno — aba "Contrato & Pagamentos"
- Card do contrato ativo: plano, vigência, próxima cobrança, status
- Timeline de cobranças: pagas ✅ · pendentes ⏳ · atrasadas ❌
- Créditos do ciclo atual: usados / disponíveis
- Botão "Solicitar cancelamento" → abre dialog com cálculo rescisório completo
- Botão "Regularizar" se inadimplente

### Painel admin — aba "Contratos"
- Todos os contratos: ativos, suspensos, inadimplentes, cancelados
- Receita realizada vs. prevista no mês
- Lista de inadimplentes: nome, plano, dias de atraso, valor
- Projeção de renovações dos próximos 30 dias
- Filtros: plano, status, forma de pagamento, período

---

## Formas de pagamento × plano

| Forma | Start | Start+ | Power | Pro | Max |
|-------|-------|--------|-------|-----|-----|
| Cartão recorrência | ✅ | ✅ +R$20/mês | ✅ +R$20/mês | ✅ +R$20/mês | ✅ +R$20/mês |
| Cartão parcelado (2–12x) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Pix automático | ✅ | ✅ | ✅ | ✅ | ✅ |
| Boleto (futuro) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Máquina débito/crédito 1x | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dinheiro | ✅ | ✅ | ✅ | ✅ | ✅ |

> Taxa +R$20/mês na recorrência mensal dos planos anuais é embutida no
> `valor_cobrado`. Alguns alunos podem ter isenção desta taxa por condição
> especial — campo `taxa_recorrencia` em `contratos` permite 0 ou valor custom.

---

*Documento criado em 2026-06-24. Baseado na análise completa dos 9 contratos
da Fortem (Start, Start+ Recorrência, Start+ 12x, Power Recorrência, Power 12x,
Pro Recorrência, Pro 12x, Max Recorrência, Max 12x) e nas regras de negócio
coletadas em sessão com o gestor.*
