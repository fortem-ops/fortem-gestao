# Novos planos 2027 — Fase 1: catálogo e modelo de dados

Somente planejamento. Tudo é feito por acréscimo. Contratos, planos, créditos e licenças que já existem não são alterados.

## 1. O que existe hoje (conferido no banco)

- **Catálogo de planos (`planos_catalogo`):** cada item é identificado só pelo `nome` (Start, Start+, Power, Pro, Max). Também tem `frequencia`, `periodo_meses`, `quantidade_creditos`, `ilimitado`, `valor`, `atividade` e `plano_base_requerido`. Não existe código interno, versão, regras de fidelidade/licença/brindes nem data de venda.
- **Plano do aluno (`planos`):** `tipo` guarda o nome em texto, sem referência ao catálogo.
- **Contratos:** `contratos.plano_tipo` tem uma regra que só aceita `start, start_plus, power, pro, max, corrida, gympass, wellhub, totalpass, outro`.
- **Catálogo de serviços (`servicos_catalogo`):** guarda nome, atividade, sessões e valor. Não tem custo de repasse, validade nem composição.
- **Créditos (`creditos_aluno`):** atividades em uso são Treino, Nutrição, Reabilitação e Avaliação Funcional (texto livre). Já existem `data_validade`, `ilimitado` e `origem_tipo`.
- **Licenças (`aluno_licencas`):** os limites estão fixos em `src/lib/licencas.ts` e são escolhidos pelo nome do plano.
- **Clube, nível do aluno:** `fn_clube_nivel_por_plano` procura no nome do plano principal: "max" → platina, "pro" → diamante, "power" → ouro. Qualquer outro plano → prata; agregadores e sem plano → bronze. O portal mostra nível, rótulo e tema por `src/lib/clube.ts` (Bronze/Prata/Ouro/Diamante/Platina).
- **Clube, custo do resgate:** `fn_clube_resgatar` pega o **plano ativo mais recente** e procura no nome: max → `custo_max`, pro → `custo_pro`, power → `custo_power`, start+ → `custo_start_plus`, demais → `custo_start`. `planos_elegiveis` também compara pelo nome.
- **Horário fixo:** a tabela `treino_horarios_fixos` já existe.

**Risco principal:** como tudo depende do nome, um "Pro 2027" seria tratado como o Pro antigo. A solução é cada item ter um código estável e cada plano vendido apontar para o item do catálogo.

## 2. Versionamento e janela de venda

Novas colunas em `planos_catalogo`, todas opcionais ou com valor padrão neutro:

| Coluna | Conteúdo |
|---|---|
| `codigo` | Único quando preenchido. Ex.: `pro_2027_3x_anual` |
| `familia` | start_2027 / power_2027 / pro_2027 |
| `versao` | 2027 |
| `nome_exibicao` | Start, Power ou Pro |
| `modalidade_cobranca` | recorrencia_mensal ou anual |
| `liberacao_creditos` | `mensal` ou `total_na_compra` |
| `taxa_recorrencia` | Valor numérico |
| `fidelidade_meses` | Número de meses |
| `licenca_dias` | Número de dias |
| `avaliacoes_funcionais_meses` | Lista de meses, ex.: `{1,6}` |
| `permite_fixar_horario` | Sim/não |
| `bota_compressao_mes` | Sessões por mês |
| `nivel_clube` | Nível do Clube Fortem |
| `reposicao_saldo_pct` | Percentual, padrão 0 |
| `brindes` | Lista de brindes |
| `vendavel_desde` / `vendavel_ate` | Datas da janela de venda |

**Janela de venda (resposta 6):**
- Um item só pode ser vendido se estiver `ativo` e se hoje estiver entre `vendavel_desde` (ou sem data) e `vendavel_ate` (ou sem data).
- Itens 2027: `vendavel_desde = 2026-10-13`.
- Itens antigos de treino (Start, Start+, Power, Pro, Max): recebem só `vendavel_ate = 2026-10-12`. Como não mudam `ativo` nem qualquer outro campo, quem já tem esses planos continua igual: renovação, telas, relatórios e Clube não mudam.
- Corrida, VIP e agregadores ficam fora dessa data.

**Outras colunas:**
- `planos`: novas colunas opcionais `catalogo_id` e `plano_codigo`, preenchidas só nas vendas 2027. `tipo` continua com o nome mostrado ao aluno.
- `contratos.plano_tipo`: a regra passa a aceitar também `start_2027`, `power_2027` e `pro_2027`, só como acréscimo. Entra também uma coluna opcional `catalogo_id`.
- Uma trigger impede alterar `codigo`, `familia`, `versao` e `liberacao_creditos` de um item que já tenha plano vendido.

## 3. Seed — 20 itens de plano

O Start é só mensal: 4 itens. Power e Pro têm mensal e anual: 8 cada.

| Família | 1x | 2x | 3x | Livre | Mensal | Anual (×12) | Fidelidade | Licença | Taxa recorrência |
|---|---|---|---|---|---|---|---|---|---|
| Start | 399 | 499 | 599 | 699 | sim | não | 0 | 0 | 0 |
| Power | 329 | 429 | 529 | 629 | sim | sim | 12 | 10 | 24,90 só no mensal |
| Pro | 399 | 499 | 599 | 699 | sim | sim | 12 | 20 | 24,90 só no mensal |

**Créditos de treino (resposta 1):**
- **Start:** `liberacao_creditos = mensal`, com 4, 8 ou 12 por mês. No Livre, `ilimitado`.
- **Power e Pro, mensal e anual:** `liberacao_creditos = total_na_compra`, com 52, 104 ou 156. No Livre, `ilimitado`. A validade vai até o fim do período do plano.
- `quantidade_creditos` guarda o valor por mês no Start e o total no Power e no Pro.

**Benefícios por plano:**
- **Power:** avaliações `{1}`, brindes `[camiseta]`, reposição de 50% (exceto no Livre, que fica com 0), nível ouro.
- **Pro:** avaliações `{1,6}`, `permite_fixar_horario`, bota de compressão 4 por mês, brindes `[camiseta, garrafinha]`, reposição de 50% (exceto no Livre, que fica com 0), nível diamante.
- **Start:** sem benefícios extras, reposição 0, nível prata.

A reposição no Power vem do texto "reposição de 50% do saldo" e precisa de confirmação (seção 11).

## 4. Serviços e novas atividades

**Novas colunas em `servicos_catalogo`:**
- `codigo` e `versao`;
- `custo_repasse_unitario`: valor por atividade (jsonb);
- `validade_meses`;
- `sobrevive_cancelamento`;
- `composicao`: lista de atividade e quantidade (jsonb);
- `gera_pendencia_comissao`, com padrão true.

**Seed — 5 serviços**, todos com validade de 12 meses e que continuam valendo depois do cancelamento do plano (resposta 8):

| Serviço | Valor | Composição | Repasse |
|---|---|---|---|
| Nutrição 4 + 2 Avaliações de Composição Corporal | 1.620 | Nutrição 4, Composição Corporal 2 | 4×200 + 2×100 = 1.000 |
| Nutrição 8 consultas | 2.400 | Nutrição 8 | 8×200 = 1.600 |
| Reabilitação 4 sessões | 600 | Reabilitação 4 | 4×80 = 320 |
| Reabilitação 8 sessões | 1.200 | Reabilitação 8 | 8×80 = 640 |
| Avaliação Física de Composição Corporal (avulsa) | 200 | Composição Corporal 1 | 100, sem pendência de comissão |

**Novas atividades, em texto livre e sem novo tipo no banco:**
- **"Avaliação Composição Corporal".**
- **"Bota de Compressão" (resposta 4):** agendável no portal em Agendamentos > Serviços > "Bota de compressão". A tela e a agenda ficam para a Fase 2.

O Grupo de Corrida não muda. O repasse aparece só nas telas internas e nunca é mostrado ao aluno.

## 5. Créditos que renovam por mês (Start e bota do Pro)

- O crédito ganha a nova coluna `competencia` (primeiro dia do mês, opcional). Um índice único em `(origem_id, atividade, competencia)` evita criar o mesmo crédito duas vezes.
- **Todo mês, dentro da vigência do plano:**
  - Cria um crédito com `quantidade_inicial` = 4/8/12 (treino do Start) ou 4 (bota do Pro) e `data_validade` = último dia do mês ou fim do plano, o que vier primeiro.
  - O crédito do mês anterior **não passa saldo adiante** e simplesmente vence. Não existe acúmulo.
- A criação acontece na compra (1º mês) e depois em uma rotina diária que só cria o mês corrente para planos ativos com `liberacao_creditos = mensal` ou `bota_compressao_mes > 0`.
- A rotina para no fim da vigência e quando o plano é cancelado.
- Ela só olha planos com `catalogo_id` de 2027. Planos antigos nunca são tocados.
- O código da rotina fica para a Fase 2. Na Fase 1 entram apenas a coluna e o índice.

## 6. Reposição de 50% (só treino)

- Nova coluna `creditos_aluno.reposicao_pct`. É uma cópia da regra no momento da venda e é preenchida **apenas** em créditos de atividade Treino com crédito total de Power ou Pro (não Livre).
- Nutrição, Reabilitação, Avaliações e Bota ficam sempre com 0 (resposta 5). Uma regra no banco garante que `reposicao_pct > 0` só existe quando `atividade = 'Treino'`.
- **Nova tabela `creditos_transferencias`:**
  - crédito de origem, crédito de destino, aluno;
  - saldo restante, percentual e `quantidade = ceil(saldo × pct / 100)`;
  - data, quem fez e se foi automático;
  - única por crédito de origem, para nunca repetir.
- O crédito de destino segue a validade do novo plano. Os movimentos são `ajuste` de saída e de entrada.
- Créditos antigos ficam com `reposicao_pct` vazio e nunca entram nessa regra. A execução fica para a Fase 2.

## 7. Licença, brindes e avaliações

- **Licença:** o limite vem de `licenca_dias` do catálogo, por `planos.catalogo_id`. Sem `catalogo_id`, vale a tabela antiga. A licença médica continua como é hoje.
- **Brindes:** nova tabela `plano_brindes_entregas` (plano, aluno, item, entregue por, data).
- **Avaliações funcionais:** créditos de Avaliação Funcional liberados na compra: 1 no Power, 2 no Pro. O lembrete do 6º mês fica para a Fase 2.

## 8. Clube Fortem (resposta 7)

Mapeamento proposto, usando os níveis que já existem no portal:

| Família | Nível | Custo do resgate |
|---|---|---|
| start_2027 | prata | `custo_start` |
| power_2027 | ouro | `custo_power` |
| pro_2027 | diamante | `custo_pro` (o mais baixo) |

- Em `fn_clube_nivel_por_plano` e `fn_clube_resgatar`, antes da busca pelo nome, verificar `planos.plano_codigo` ou `catalogo.nivel_clube`. Sem isso, o resultado continua igual ao atual.
- `fn_clube_resgatar` passa a usar o **plano principal ativo** (o mesmo de `fn_clube_nivel_por_plano`), e não o mais recente. Assim nível e custo nunca se contradizem, por exemplo quando o aluno tem plano de corrida mais novo.
- `planos_elegiveis` passa a aceitar também `start_2027`, `power_2027` e `pro_2027`.
- Platina continua reservado ao Max antigo.

## 9. Migrations (ordem)

1. `catalogo_versionamento`: colunas em `planos_catalogo`, `planos` e `contratos`; regra de `plano_tipo` ampliada; trigger de proteção.
2. `servicos_catalogo_2027`: colunas em `servicos_catalogo`.
3. `creditos_2027`: `competencia`, índice único, `reposicao_pct` com a regra "só Treino", tabela `creditos_transferencias` com permissões e RLS (coordenador/admin escreve; staff e o próprio aluno leem).
4. `plano_brindes_entregas`: tabela, permissões e RLS.
5. `clube_mapeamento_2027`: ajustes nas duas funções do Clube.

**Dados, fora das migrations:**
- 20 planos + 5 serviços com `vendavel_desde = 2026-10-13`.
- `vendavel_ate = 2026-10-12` nos itens antigos de treino.

## 10. Impacto nos dados atuais e riscos

- Nenhum UPDATE ou DELETE em `contratos`, `planos`, `creditos_aluno`, `alunos` ou `aluno_licencas`. A única escrita em itens antigos do catálogo é `vendavel_ate`.
- **Riscos para a Fase 2:**
  - As telas de venda precisam respeitar a janela de venda.
  - Códigos que comparam nome (`licencas.ts`, `vendas-servicos.ts`, `planTipo.ts`, `calcRescisao`, relatórios) precisam usar `catalogo_id`. Senão o Pro 2027 recebe os bônus do Pro antigo, e Power/Pro mensais com fidelidade seriam tratados como "sem multa".
  - As rotinas de cancelamento não podem desativar créditos de serviço 2027.
- **Datas:** se a configuração atrasar, basta ajustar as datas. O deploy precisa terminar até 12/10, senão no dia 13 nada fica vendável. Combinar `vendavel_ate` antigo com a data real de publicação.

## 11. Consultas de conferência

```sql
-- 20 planos 2027 e configuração
select familia, frequencia, periodo_meses, valor, liberacao_creditos, quantidade_creditos, ilimitado,
       taxa_recorrencia, fidelidade_meses, licenca_dias, reposicao_saldo_pct, nivel_clube, vendavel_desde
from planos_catalogo where versao = 2027 order by familia, frequencia, periodo_meses;

-- anual = mensal x 12 (esperado 0)
select a.codigo from planos_catalogo a join planos_catalogo m
  on m.familia=a.familia and m.frequencia=a.frequencia and m.periodo_meses=1
where a.versao=2027 and a.periodo_meses=12 and a.valor <> m.valor*12;

-- regras (cada uma esperado 0)
select count(*) from planos_catalogo where familia='start_2027' and (periodo_meses<>1 or taxa_recorrencia<>0 or liberacao_creditos<>'mensal');
select count(*) from planos_catalogo where familia in ('power_2027','pro_2027') and periodo_meses=12 and taxa_recorrencia<>0;
select count(*) from planos_catalogo where familia in ('power_2027','pro_2027') and periodo_meses=1 and taxa_recorrencia<>24.90;
select count(*) from planos_catalogo where versao=2027 and frequencia='livre' and (reposicao_saldo_pct<>0 or not ilimitado);
select count(*) from planos_catalogo where familia in ('power_2027','pro_2027') and frequencia<>'livre'
  and quantidade_creditos <> case frequencia when '1x' then 52 when '2x' then 104 else 156 end;

-- janela de venda: o que está vendável hoje
select nome, codigo, vendavel_desde, vendavel_ate from planos_catalogo
where ativo and (vendavel_desde is null or vendavel_desde<=current_date) and (vendavel_ate is null or vendavel_ate>=current_date);

-- legado intocado (esperado 0)
select count(*) from planos_catalogo where versao is null and (codigo is not null or licenca_dias is not null or reposicao_saldo_pct<>0);
select count(*) from planos where catalogo_id is not null and created_at < '2026-10-13';
select count(*) from creditos_aluno where reposicao_pct is not null and created_at < '2026-10-13';

-- serviços 2027
select nome, valor, validade_meses, sobrevive_cancelamento, composicao, custo_repasse_unitario, gera_pendencia_comissao
from servicos_catalogo where versao = 2027;

-- reposição só em Treino e arredondada para cima (esperado 0)
select count(*) from creditos_aluno where coalesce(reposicao_pct,0)>0 and atividade<>'Treino';
select count(*) from creditos_transferencias where quantidade <> ceil(saldo_origem*percentual/100.0);

-- créditos mensais sem duplicar e sem acúmulo (esperado 0)
select origem_id, atividade, competencia, count(*) from creditos_aluno where competencia is not null group by 1,2,3 having count(*)>1;
select count(*) from creditos_aluno where competencia is not null and data_validade > (competencia + interval '1 month - 1 day')::date;
```

## 12. Pendências antes de executar

Nada técnico impede a Fase 1. Faltam só duas confirmações rápidas:

1. A reposição de 50% vale também para o **Power**, ou só para o Pro? O pedido original cita a reposição só na lista do Pro.
2. Datas: `vendavel_ate = 12/10/2026` nos antigos e `vendavel_desde = 13/10/2026` nos 2027. Quer manter, ou alinhar com o horário real da publicação?
