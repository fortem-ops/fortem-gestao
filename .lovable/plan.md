# Novos planos 2027 — Fase 1: catálogo e modelo de dados

Só planejamento. Nada é executado até você aprovar. Contratos, planos e créditos que já existem não mudam: tudo é feito por acréscimo.

## 1. O que existe hoje (conferido no banco)

- `planos_catalogo`: os itens se identificam só pelo `nome` ("Start", "Power", "Pro", "Start+", "Max"), junto com `frequencia` (1x/2x/3x/livre), `periodo_meses`, `quantidade_creditos`, `ilimitado`, `valor`, `atividade` e `plano_base_requerido`. Não há código interno, versão nem regras (fidelidade, licença, brindes).
- `planos` (plano do aluno): `tipo` guarda o **nome em texto** ("Pro", "Power"...), sem referência ao item do catálogo.
- `contratos.plano_tipo` tem uma regra que só aceita `start, start_plus, power, pro, max, corrida, gympass, wellhub, totalpass, outro`.
- `servicos_catalogo`: nome, atividade, quantidade de sessões e valor. Não guarda custo de repasse, validade nem composição (exemplo: consultas + avaliação no mesmo pacote).
- `creditos_aluno`: atividades em uso são Treino, Nutrição, Reabilitação e Avaliação Funcional. Já tem `data_validade`, `ilimitado` e `origem_tipo` (plano/serviço).
- `aluno_licencas`: licenças do tipo plano ou médica. Os limites (10/15/20/30 dias) estão fixos no código (`src/lib/licencas.ts`) e são escolhidos pelo nome do plano.
- `clube_recompensas`: tem `custo_start`, `custo_start_plus`, `custo_power`, `custo_pro`, `custo_max` e `custo_agregador`. O nível do Clube (`fn_clube_nivel_por_plano`) é decidido procurando "max", "pro" ou "power" dentro do nome do plano.
- `treino_horarios_fixos` já existe (serve para "fixar horários").
- `loja_promocao_brinde` é uma promoção da loja e não serve para os brindes do plano.

**Risco principal:** como tudo hoje se apoia no nome, um "Pro" de 2027 seria tratado como o Pro antigo (licença, serviços bônus, Clube, renovação automática). A solução é ter um código interno estável em cada item.

## 2. Como separar as versões sem afetar os planos antigos

- Novas colunas em `planos_catalogo`, todas opcionais ou com valor padrão:
  - `codigo` (text, único quando preenchido): por exemplo `start_2027_2x_mensal`.
  - `familia`: start_2027, power_2027 ou pro_2027.
  - `versao`: 2027.
  - `nome_exibicao`: Start, Power ou Pro.
  - `modalidade_cobranca`: recorrencia_mensal ou anual.
  - `taxa_recorrencia` (numeric).
  - `fidelidade_meses`.
  - `licenca_dias`.
  - `avaliacoes_funcionais_meses` (int[]): por exemplo `{1}` ou `{1,6}`.
  - `permite_fixar_horario` (boolean).
  - `bota_compressao_mes` (int).
  - `nivel_clube`: start, power ou pro.
  - `reposicao_saldo_pct` (int, padrão 0).
  - `brindes` (jsonb).
  - `vendavel_ate` / `vendavel_desde` (date).
- Os itens antigos ficam com `versao` vazia e todos os campos novos vazios. Nada no comportamento deles muda.
- Novas colunas opcionais em `planos`: `catalogo_id` e `plano_codigo`. Elas só são preenchidas nas vendas de 2027. `planos.tipo` continua recebendo o nome mostrado ao aluno, para as telas atuais seguirem funcionando.
- `contratos.plano_tipo`: a regra passa a aceitar também `start_2027`, `power_2027` e `pro_2027`. É só um acréscimo, com `NOT VALID` desnecessário porque as linhas atuais já cumprem a regra. Também entra uma coluna opcional `contratos.catalogo_id`.
- Proteção: uma trigger impede mudar `codigo`, `familia` e `versao` de um item do catálogo que já tenha plano vendido.

## 3. Linhas a cadastrar (seed)

São 3 famílias × 4 frequências × 2 períodos (mensal e anual), menos o anual do Start. O Start é só recorrência mensal, então ficam **20 itens**.

| Família | 1x | 2x | 3x | Livre | Mensal | Anual (×12) | Fidelidade | Licença | Taxa recorrência |
|---|---|---|---|---|---|---|---|---|---|
| Start | 399 | 499 | 599 | 699 | sim | não | 0 | 0 | 0 |
| Power | 329 | 429 | 529 | 629 | sim | sim | 12 | 10 | 24,90 (mensal) |
| Pro | 399 | 499 | 599 | 699 | sim | sim | 12 | 20 | 24,90 (mensal) |

- **Créditos de treino:** no anual são 52, 104 ou 156; no Livre, `ilimitado = true`. No mensal, a pergunta 1 decide entre 4, 8 ou 12 por mês, ou o total anual liberado de uma vez.
- **Power:** avaliações funcionais `{1}`, brindes `[camiseta]`, nível Clube power, reposição 0.
- **Pro:** avaliações funcionais `{1,6}`, `permite_fixar_horario = true`, bota de compressão 4 por mês, brindes `[camiseta, garrafinha]`, nível Clube pro. Reposição de 50% nas frequências 1x/2x/3x e 0 no Livre.
- **Start:** nível Clube start, sem benefícios extras.
- Os itens antigos do catálogo não são desativados nesta fase (fica para quando vocês decidirem, veja a pergunta 6).

## 4. Serviços e nova atividade

Novas colunas em `servicos_catalogo`:
- `codigo`, `versao`;
- `custo_repasse_unitario` (jsonb por atividade, por exemplo `{"Nutrição":200,"Avaliação Composição Corporal":100}`);
- `validade_meses` (padrão vazio; 12 nos itens de 2027);
- `sobrevive_cancelamento` (boolean);
- `composicao` (jsonb com a lista de atividade e quantidade);
- `gera_pendencia_comissao` (boolean, padrão true).

Itens novos:
- Nutrição 4 consultas + 2 Avaliações de Composição Corporal: R$ 1.620. Composição: Nutrição 4 e Composição Corporal 2.
- Nutrição 8 consultas (avaliação inclusa): R$ 2.400. A composição depende da pergunta 3.
- Reabilitação 4 sessões: R$ 600, repasse de 80 por sessão.
- Reabilitação 8 sessões: R$ 1.200, repasse de 80 por sessão.
- Avaliação Física de Composição Corporal avulsa: R$ 200, repasse de 100, `gera_pendencia_comissao = false`.

Nova atividade "Avaliação Composição Corporal":
- Ela é texto livre em `creditos_aluno.atividade`, `agenda_servicos.atividade` e `consumo_servicos.tipo_servico`, então não precisa de novo tipo no banco.
- Precisa ser incluída nas listas do código e nas funções de débito e estorno de crédito (`fn_creditos_atividade_de_servico`). Isso fica para a fase 2.

O Grupo de Corrida não muda.

Os custos de repasse ficam só nas telas internas. Nada voltado ao aluno mostra repasse ou comissão.

## 5. Reposição de 50% do saldo

- Nova tabela `creditos_transferencias`. Ela registra:
  - o crédito de origem e o crédito de destino;
  - o aluno;
  - o saldo que restava, o percentual aplicado e a quantidade transferida, com `ceil(saldo × pct / 100)`;
  - a regra usada, a data e quem transferiu (ou se foi automático);
  - um campo único `(credito_origem_id)` para a mesma transferência nunca acontecer duas vezes.
- Nova coluna `creditos_aluno.reposicao_pct` (cópia da regra do plano no momento da venda). Ela não é calculada de novo depois.
- A transferência acontece quando o crédito vence e existe um novo plano em vigor. O crédito novo segue a validade do plano novo. Vira um movimento `ajuste` nos dois lados, de saída e de entrada.
- O Livre fica de fora porque não tem saldo. Os créditos antigos ficam com `reposicao_pct` vazio e nunca recebem transferência.
- A execução (rotina diária ou feita na hora da renovação) fica para a fase 2. Nesta fase entra só a estrutura.

## 6. Licença, brindes e avaliações

- **Licença:** o limite passa a vir de `licenca_dias` do catálogo, buscado por `planos.catalogo_id`. Sem `catalogo_id`, vale a tabela antiga do código. A licença médica continua como é hoje.
- **Brindes:** nova tabela `plano_brindes_entregas`, com plano, aluno, item, quem entregou e data. Ela controla a entrega, sem estoque nesta fase.
- **Avaliações funcionais do Pro:** créditos de Avaliação Funcional liberados na venda, com a quantidade de `avaliacoes_funcionais_meses`. O agendamento no 6º mês vira uma tarefa na fase 2.
- **Bota de compressão:** proposta de nova atividade "Bota de Compressão", com crédito de 4 por mês (veja a pergunta 4).

## 7. Clube Fortem

- `fn_clube_nivel_por_plano`: incluir **antes** da busca pelo nome uma checagem de `planos.plano_codigo` ou da família do catálogo:
  - start_2027 → prata;
  - power_2027 → ouro;
  - pro_2027 → diamante.
- Sem isso, um Start de 2027 já cai em prata e um Pro em diamante pelo nome, mas não há garantia.
- Custo das recompensas: start_2027 usa `custo_start`, power_2027 usa `custo_power` e pro_2027 usa `custo_pro`. O ajuste é na função ou tela que escolhe a coluna de custo, também pela família. `custo_start_plus` e `custo_max` continuam só para os planos antigos.

## 8. Migrations (ordem)

1. `catalogo_versionamento`: colunas novas em `planos_catalogo`, `planos` e `contratos`, a regra ampliada de `plano_tipo` e a trigger de proteção.
2. `servicos_catalogo_2027`: colunas novas em `servicos_catalogo`.
3. `creditos_reposicao`: `creditos_aluno.reposicao_pct`, a tabela `creditos_transferencias` com permissões, RLS e políticas (coordenador/admin escreve; staff e o próprio aluno leem).
4. `plano_brindes_entregas`: tabela, permissões, RLS e políticas.
5. Ajuste em `fn_clube_nivel_por_plano`.

Os 20 itens de plano e os 5 de serviço são cadastrados depois, como dados e fora das migrations, com os itens inativos até a liberação.

## 9. Impacto nos contratos atuais

- Nenhum UPDATE ou DELETE em `contratos`, `planos`, `creditos_aluno`, `alunos` ou `aluno_licencas`.
- Todas as colunas novas aceitam vazio ou têm valor padrão neutro, então o comportamento antigo continua.
- A checagem pelo nome continua existindo como plano B para os registros antigos.

## 10. Riscos

- Códigos que comparam o nome (`licencas.ts`, `vendas-servicos.ts`, `planTipo.ts` com "start" como renovação automática, `LABEL_PLANO`, relatórios por `plano_tipo`) podem tratar o Start/Power/Pro de 2027 como os antigos se a fase 2 não usar `catalogo_id`. O Start de 2027 seria marcado como renovação automática, e isso está correto. O Pro de 2027 receberia os serviços bônus do Pro antigo, e isso está errado.
- Relatórios de vendas agrupados por nome misturariam as versões. É preciso agrupar por `familia` ou `versao`.
- Renovação mensal (`renovar-planos-mensais`): precisa respeitar a fidelidade de 12 meses do Power e Pro mensais, para não tratar como Start sem fidelidade.
- Multa de rescisão: `calcRescisao` usa `vigencia_tipo = mensal` como "sem multa", mas o Power e o Pro mensais têm fidelidade. É preciso olhar `fidelidade_meses`.
- Crédito que continua válido depois do cancelamento: as rotinas que desativam créditos no cancelamento precisam poupar os créditos de serviço de 2027.

## 11. Consultas para conferir depois

```sql
-- 20 planos 2027, preços e anual = mensal x 12
select familia, frequencia, periodo_meses, valor, taxa_recorrencia, fidelidade_meses, licenca_dias, reposicao_saldo_pct
from planos_catalogo where versao = 2027 order by familia, frequencia, periodo_meses;

select a.familia, a.frequencia from planos_catalogo a
join planos_catalogo m on m.familia=a.familia and m.frequencia=a.frequencia and m.periodo_meses=1
where a.versao=2027 and a.periodo_meses=12 and a.valor <> m.valor*12;   -- esperado: 0 linhas

-- Start sem anual; Pro Livre sem reposição
select count(*) from planos_catalogo where familia='start_2027' and periodo_meses=12;  -- 0
select count(*) from planos_catalogo where familia='pro_2027' and frequencia='livre' and reposicao_saldo_pct<>0; -- 0

-- Planos antigos intocados
select count(*) from planos_catalogo where versao is null and (codigo is not null or licenca_dias is not null); -- 0
select count(*) from planos where catalogo_id is not null and created_at < '<data da migration>'; -- 0
select count(*) from contratos where updated_at >= '<data da migration>' and plano_tipo not like '%_2027'; -- comparar com o movimento normal

-- Serviços 2027
select nome, valor, validade_meses, sobrevive_cancelamento, composicao, custo_repasse_unitario, gera_pendencia_comissao
from servicos_catalogo where versao = 2027;

-- Transferências nunca duplicadas e arredondadas para cima
select * from creditos_transferencias where quantidade_transferida <> ceil(saldo_origem*percentual/100.0);
```

## 12. Perguntas em aberto

1. Créditos de treino no plano **mensal** 2027: liberar 4, 8 ou 12 por mês, ou 52/104/156 de uma vez com validade de 12 meses?
2. A taxa de R$ 24,90 vale também para o Start, que é só recorrência? O pedido cita apenas Power e Pro.
3. "Nutrição 8 consultas (avaliação inclusa)": são quantas Avaliações de Composição Corporal (1 ou 2)? E qual é o repasse do pacote de 8?
4. A bota de compressão do Pro vira crédito agendável na agenda ou é só controle manual? E as 4 por mês acumulam de um mês para outro?
5. "Reposição de 50%" vale também para os créditos de serviço (Nutrição e Reabilitação) ou só para os de treino? E se o aluno não renovar, o saldo some?
6. Quando desativar a venda dos itens antigos (Start+, Max, Power/Pro atuais)? Na data de início de 2027?
7. "Mais vantagens no Clube" para o Pro é só o `custo_pro` menor, ou também um nível diferente (diamante)?
8. Os créditos do serviço continuam válidos se o plano for cancelado. Isso vale também para serviço comprado fora de pacote, como a avaliação avulsa?
