# Planos 2027 — Fase 2: Contratos novos (templates)

Escopo: só templates novos em `contrato_templates` (ativo=false até o go-live) e a mudança mínima de seleção para que vendas 2027 usem esses templates. Nada muda nos 7 templates ativos de Start/Start+/Power/Pro, nem em `contratos` ou `contratos_documentos` existentes.

## 1. Como funciona hoje (verificado)

- A seleção NÃO usa `plano_tipo + forma_pagamento + versao + ativo`. Ela é feita em `src/lib/contratosDocumentos.ts` por um mapa fixo (`TEMPLATE_MAP`) de **nome do plano em minúsculas** + tipo (`recorrencia` ou `tradicional`) para um **id fixo** de template. Chamado só pelo `VendaDialog` com `planoNome: planoSelecionado.nome`.
- Templates ativos hoje (versao 2): Start mensal recorrência `5197281a`, Power 12x `dfb183d5`, Power recorrência `2bc0fdfc`, Pro 12x `ebafb20f`, Pro recorrência `a8daa4f7`, Start+ (2).
- Índice único `contrato_templates_ativo_unico (plano_tipo, forma_pagamento) WHERE ativo` — um único ativo por par. Não há regra limitando valores de `plano_tipo`.
- Variáveis preenchidas hoje: NOME, DATA_NASCIMENTO, CPF, RG, ENDERECO, BAIRRO, CIDADE, UF, CEP, EMAIL, NOME_CONTRATO, VALOR_FINAL_CONTRATO, DIA, MES, ANO; Corrida: VIGENCIA_TEXTO, PARCELAS, PLANO_BASE_VINCULADO; ASSINATURA/ACEITE/DATA_ACEITE/FORMATO_ACEITE/IP_ACEITE são preenchidas no aceite (portal e assinatura presencial).
- Textos atuais confirmados com "trancamento" e "260 créditos" nos Power/Pro/Max.

**Risco encontrado:** os itens 2027 do catálogo têm `nome = "Power"/"Pro"/"Start"`. Pelo mapa atual, uma venda 2027 cairia no template **legado**. A Fase 2 precisa trocar a seleção para planos 2027 antes do go-live.

## 2. Templates a criar (5, todos ativo=false, versao=1)

| # | plano_tipo | forma_pagamento | Base |
|---|---|---|---|
| 1 | start_2027 | cartao_recorrencia | Start mensal (5197281a) |
| 2 | power_2027 | cartao_parcelado | Power 12x (dfb183d5) |
| 3 | pro_2027 | cartao_parcelado | Pro 12x (ebafb20f) |
| 4 | power_2027 | cartao_recorrencia | Power recorrência (2bc0fdfc) |
| 5 | pro_2027 | cartao_recorrencia | Pro recorrência (a8daa4f7) |

Por que separar Power e Pro: o Pro tem cláusula inteira a mais (Reposição de Créditos) e benefícios diferentes; o índice único é por `plano_tipo`, e templates separados permitem revisão jurídica e versionamento independentes. Um template único com variáveis seria possível, mas esconderia cláusulas condicionais dentro de variáveis — pior para o jurídico.

Estrutura de cada template (texto-base copiado sem mudança: objeto, saúde, agendamento, horário, obrigações, sanções, pertences, imagem, foro, ANEXO I, Regulamento):
- Cl. 4 reescrita por variante (A/B/C do pedido).
- Nova cláusula "DOS SERVIÇOS COMPLEMENTARES" logo após a cl. 4 (nos 5), com a tabela de pacotes; no 12x, parágrafo de que parcelas de serviços continuam devidas na rescisão; na recorrência, pagos à parte em até 6x no cartão ou PIX à vista.
- Cl. 13: Start = cancelamento sem multa, acesso até fim do ciclo pago; Power/Pro = tabela atual mantida (75% / 80% / 85%); recorrência acrescenta "taxa de recorrência não restituível"; §3 antigo (R$ 300/R$ 150 por consulta) removido.
- Cl. 14/16 "DA LICENÇA": Start só doença/lesão com atestado até 30 dias, uma vez; Power/Pro `%LICENCA_DIAS%` dias, uma vez, + doença/lesão até 30 dias.
- Cl. 15 §3 créditos via `%CREDITOS_TEXTO%`; §4 upgrade cita só Start, Power e Pro; "260 créditos" removido.
- Nova "DA REPOSIÇÃO DE CRÉDITOS" só em pro_2027 (12x e recorrência), com texto que exclui o Livre ("exceto na frequência Livre") — ou via variável, ver pergunta 2.
- "trancamento" -> "licença" em todo o texto.

## 3. Variáveis novas

Preenchidas em `gerarDocumentoContrato` a partir do item do catálogo (`contratos.catalogo_id` -> `planos_catalogo`), nunca digitadas:

| Variável | Origem |
|---|---|
| %PLANO_EXIBICAO% | nome_exibicao + frequência ("Pro 3x") |
| %FREQUENCIA% | 1x/2x/3x/Livre |
| %VIGENCIA_TEXTO% | já existe (Corrida); reaproveitar: "12 (doze) meses" / "mensal" |
| %VALOR_MENSAL% | valor do item (recorrência inclui taxa) |
| %TAXA_RECORRENCIA% | taxa_recorrencia ("R$ 24,90") |
| %PARCELAS% | já existe; reaproveitar |
| %CREDITOS_TEXTO% | Start: "4 créditos por mês, não acumuláveis"; Power/Pro: "52 créditos liberados na contratação"; Livre: "acesso ilimitado" |
| %LICENCA_DIAS% | licenca_dias (10/20) |
| %BENEFICIOS_PLANO% | lista HTML montada de avaliacoes_funcionais_meses, licenca_dias, permite_fixar_horario, bota_compressao_mes, brindes, nivel_clube |
| %TABELA_SERVICOS% | tabela HTML montada dos 5 serviços 2027 de `servicos_catalogo` (nome + valor), para os preços ficarem sempre iguais ao catálogo |
| %SERVICOS_CONTRATADOS% | (opcional) serviços vendidos junto neste contrato |

Também acrescentar as novas chaves em `MERGE_FIELDS_EXEMPLO` (pré-visualização do editor de templates).

## 4. Garantias para legado

- Seleção nova em `contratosDocumentos.ts`: se o contrato tem `catalogo_id` com `versao = 2027`, buscar template por `plano_tipo = familia` + `forma_pagamento` + `ativo = true` (sem mapa fixo). Senão, segue o `TEMPLATE_MAP` atual sem mudança.
- `VendaDialog` passa a enviar o `catalogo_id` (já gravado no contrato na Fase 1).
- Se a venda for 2027 e não existir template ativo, a geração retorna erro claro em vez de cair no legado.
- Templates 2027 ficam `ativo=false`; o go-live só liga os 5. O índice único não conflita com os ativos atuais porque o `plano_tipo` é diferente.
- `contratos_documentos` existentes guardam `conteudo_gerado` próprio; nada é regerado.
- Tela de templates (`useContratoTemplates`) lista só ativos: os 2027 não aparecem até o go-live; adicionar filtro "Rascunhos 2027" para revisar/editar antes (edição de inativo = update direto, sem criar versão).
- `PLANOS_ORDEM` ganha start_2027, power_2027, pro_2027.

## 5. Migrations / dados

- Migration: nenhuma obrigatória (não há regra em `plano_tipo`). Opcional: `COMMENT` documentando os novos valores.
- Dados (INSERT apenas, via ferramenta de dados): 5 linhas em `contrato_templates` com `ativo=false`, `versao=1`, conteúdo gerado copiando o template-base e aplicando as substituições. Nenhum UPDATE em templates existentes.
- Código: `contratosDocumentos.ts`, `VendaDialog.tsx` (passar catalogo_id), `types/contratoTemplates.ts`, tela de templates; teste unitário para a seleção (2027 -> template 2027; legado -> mapa antigo; 2027 sem template -> erro) e para `%CREDITOS_TEXTO%`/`%BENEFICIOS_PLANO%` (52/104/156, 4/8/12, 10/20 dias).

## 6. Consultas de conferência

```sql
-- 5 templates 2027, todos inativos
select plano_tipo, forma_pagamento, versao, ativo, nome
from contrato_templates where plano_tipo like '%_2027' order by 1,2;

-- ativos legados intocados (devem continuar 7 e com updated_at antigo)
select id, plano_tipo, forma_pagamento, versao, updated_at
from contrato_templates where ativo and plano_tipo in ('start','start_plus','power','pro');

-- textos 2027 sem resíduos
select plano_tipo, forma_pagamento,
  conteudo ilike '%trancamento%' tranc, conteudo ilike '%260%' c260,
  conteudo ilike '%Start+%' startplus, conteudo ilike '%Max%' max,
  conteudo ilike '%REPOSIÇÃO DE CRÉDITOS%' reposicao,
  conteudo ilike '%SERVIÇOS COMPLEMENTARES%' servicos
from contrato_templates where plano_tipo like '%_2027';
-- esperado: tranc/c260/startplus/max = false; reposicao só pro_2027; servicos = true nos 5

-- nenhum documento existente usa template 2027
select count(*) from contratos_documentos d join contrato_templates t on t.id=d.template_id
where t.plano_tipo like '%_2027';
```

## 7. Perguntas em aberto

1. Formas de pagamento no texto de recorrência: o sistema hoje só tem `cartao_recorrencia` e `pix_automatico` como formas; boleto recorrente não existe. Template único por "recorrência" citando as opções escolhidas (variável) ou só cartão até boleto existir? (você decide depois)
2. Pro Livre: a cláusula de Reposição fica no texto com exceção "exceto Livre", ou some do contrato quando a frequência for Livre (variável %CLAUSULA_REPOSICAO%)?
3. Power/Pro 12x com PIX à vista: usa o mesmo template `cartao_parcelado` (texto cobre ambos) ou um sexto template `pix`?
4. Start: cl. 13 sem multa de nenhum tipo — confirmar.
5. Revisão jurídica do texto final antes do go-live (você decide depois).

Nada técnico impede a execução após essas respostas; o ponto obrigatório é a troca da seleção de template, sem a qual vendas 2027 gerariam contrato legado.
