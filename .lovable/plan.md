# E4 — Telas da Consultoria Online (plano para aprovação)

Escopo: só telas internas. Banco (E3a–E3c) já pronto. Nada de /planos, cron, edge, cartão, Pix Automático, ligar itens (E6) ou comissão (E3d).

## 1. Nova Venda > Planos 2027 > seletor Plano

- Hoje (`Venda2027Steps`): chips fixos Start, Power, Pro, Só serviços; item achado por `familia + frequencia + modalidade_cobranca`.
- Proposta: novo chip "Consultoria Online" entre Pro e Só serviços.
- Para Consultoria o item é achado por `familia = consultoria_2027 + periodo_meses` (1, 4 ou 6), não pela frequência.
- Itens desligados: a tela já tem o mecanismo de aluno de teste (`sistema_config.vendas_2027_teste_aluno_ids` + `itemVendavel2027`), que libera itens `ativo=false` só para os alunos dessa lista. Proposta: usar esse mesmo mecanismo.
  - O chip "Consultoria Online" só aparece se existir item ativo OU se o aluno estiver na lista de teste. Clientes comuns não veem o chip.
  - O site público não muda: ele lê só `fn_planos_publico_2027`, que filtra família e ativo.
  - Confirmar na E4a que NICOLAS TESTE está na lista (só leitura). Se não estiver, incluir é uma alteração de dado pequena e separada, que precisa de aprovação.
  - O servidor (`fn_venda_2027_criar`) continua sendo a trava final. Na E4a vou conferir se ele aceita item inativo para aluno de teste. Se não aceitar, o teste da venda inteira fica para a E6 ou para uma liberação específica.

## 2. Formulário da Consultoria

- Some: Frequência. Entra: Duração (Mensal / 4 meses / 6 meses).
- Forma de pagamento:
  - Mensal: só recorrência no cartão (fixa, como no Start).
  - 4 e 6 meses: "Cartão parcelado" (1 até 4 ou 1 até 6 parcelas, com padrão N) ou "Pix à vista". Recorrência não aparece.
- Serviços:
  - Mensal: igual ao Start (cobrados à parte).
  - Pacote: lista desabilitada e marcações limpas, com o aviso "Pacotes da Consultoria não aceitam serviços na mesma venda. Registre os serviços em uma venda separada (Só serviços)."
- Desconto: o mesmo campo de hoje. No Mensal aparece a opção "só 1ª / todas as mensalidades", igual ao Start. Esta é a única mudança na regra: `desconto_recorrente` passa a valer para Start OU Consultoria Mensal.
- 1º vencimento e data de início: iguais aos de hoje.
- Resumo, calculado por `calcularVenda2027` (E2):
  - Mensal: "R$189,00 por mês (recorrência no cartão)".
  - Pacote: "Total R$676,00 · 4x de R$169,00 · referência R$169,00/mês". 6 meses: R$894,00 · 6x R$149,00. Pix: "1x de R$…".
  - Com desconto, mostra a sobra na última parcela (ex.: 3x R$225,33 com a última diferente, se houver).
  - Linha fixa: "Sem créditos de treino · Sem contrato · Sem multa de cancelamento".
- Botão Confirmar: desabilitado quando não há item, o cálculo falha ou o item não está liberado. O erro do cálculo local aparece em texto abaixo do resumo. Erros do servidor seguem no aviso que já existe, com o texto em português que o servidor envia.

## 3. Depois da venda

- Em `Venda2027Steps`, quando a família for `consultoria_2027`, não chamar `gerarDocumentoContrato`. Aviso: "Venda registrada (plano sem contrato)". Não mostrar o aviso "Contrato 2027 ainda desligado".
- O `VendaDialog` legado não é usado pela Consultoria e não muda.
- Cobranças: as mesmas que o servidor já cria hoje (E3b).
  - Cartão parcelado / recorrência: cobranças pendentes, pagas pelo fluxo atual (link do cartão / baixa).
  - Pix à vista: uma cobrança de R$676/R$894 com desconto, gerada pelo mesmo caminho do Pix das vendas 2027 de hoje. Na E4a vou só conferir esse caminho, sem alterar.
- Perfil do aluno:
  - Plano/Serviços: "Consultoria Online · Mensal / 4 meses / 6 meses", sem créditos.
  - Pagamentos: sem mudança.
  - Contrato: o registro financeiro aparece com o selo "Sem documento de contrato", em vez de pendente/assinatura.

## 4. Telas que traduzem vigência e tipo

| Local | Hoje com os valores novos | Correção mínima | Risco Start/Power/Pro |
|---|---|---|---|
| `types/financeiro.ts` PlanoTipo/PLANO_LABELS | `consultoria_2027` sem rótulo (mostra o código) | adicionar tipo + rótulo "Consultoria Online" | nenhum (só adiciona) |
| `types/contratoTemplates.ts` PLANOS_ORDEM | ausente | NÃO adicionar (sem modelo de contrato) | nenhum |
| `ContratoFinanceiro` selo de vigência | quadrimestral vira "Mensal" | adicionar "4 meses"; rótulo do plano via LABEL_PLANO | nenhum |
| `CardContrato` | quadrimestral/semestral viram "Mensal"; a frequência sai vazia | mapa de vigência único (Mensal/4 meses/Semestral/Anual); esconder a frequência para Consultoria | baixo (o anual não muda) |
| `RescisaoDialog` | tudo que não é anual vira "Mensal"; o tipo vem de `fn_calcular_rescisao` (não conferido para Consultoria) | rótulo pelo mesmo mapa; para Consultoria forçar "Sem multa de cancelamento" e esconder o ajuste de multa | médio. Conferir na E4a o retorno da função; não alterar a função na E4 |
| `contratoValores.duracaoRealContrato` | usa as datas primeiro (o pacote acerta); sem datas, quadrimestral dá 1 | `quadrimestral → 4` | nenhum |
| `AlterarTipoCobrancaDialog` | quadrimestral conta como 1 parcela | bloquear para `consultoria_2027` com o aviso "Não disponível para Consultoria Online" | nenhum |
| `contratos-calc.ts` (legado) | tipo só mensal/semestral/anual | sem uso pela Consultoria. Só ampliar o tipo se o TS exigir | nenhum |
| `InadimplentesWidget`, relatórios que usam PLANO_LABELS | mostram o código | resolvido pelo rótulo | nenhum |

- Valor mensal de referência (R$169/R$149) aparece só no resumo da venda e no ContratoFinanceiro dos pacotes, nunca como cobrança.
- Antes de editar, a E4a faz uma varredura (`rg vigencia_tipo|plano_tipo|PLANO_LABELS`) e acrescenta à tabela qualquer outro local encontrado.

## 5. Aviso de inadimplência ("Consultoria Online livre")

- A palavra "livre" vem da frequência do item, que está como "livre". Proposta: nada no banco. Na tela que mostra o aviso, se o texto começar com "Consultoria Online livre", trocar por "Consultoria Online".
- Mais limpo, mas fica para outra etapa com aprovação: ajustar `fn_recorrencia_2027_inadimplente_aviso` para omitir a frequência na Consultoria (mudança no banco, fora da E4).
- Recomendação: o ajuste na tela agora e a correção no banco junto com a E3d.

## 6. Testes

- Unitários:
  - Seleção do item por duração.
  - Formas permitidas por duração.
  - Serviços bloqueados no pacote.
  - `desconto_recorrente` só para Start / Consultoria Mensal.
  - Pular o documento para `consultoria_2027`.
  - Mapa de vigência (quadrimestral → "4 meses" / 4 meses).
- Prova de Start/Power/Pro iguais: os testes atuais de `vendas2027`, `consultoria2027` e da seção continuam passando. Teste novo: para Start/Power/Pro, o objeto enviado ao `fn_venda_2027_criar` fica idêntico ao de hoje (snapshot do payload por caso).
- Roteiro manual no NICOLAS TESTE, sem pagamento real (só se o servidor aceitar a venda de teste):
  - Mensal sem desconto e com R$20.
  - 4 meses em 4x e em 3x com R$0,01.
  - 6 meses em 6x com R$10.
  - 6 meses Pix.
  - Pacote tentando serviço.
  - Em cada um: conferir o perfil (plano, selo sem documento, cobranças) e cancelar/estornar só nos dados de teste, com o roteiro de limpeza aprovado antes.
- /planos intacto: conferir com Playwright que a página e a prévia não listam Consultoria e que a contagem do catálogo público segue 20.

## 7. Sub-etapas (cada uma com aprovação própria)

- **E4a** — conferências somente leitura: lista de teste, servidor com item inativo, retorno de `fn_calcular_rescisao`, caminho do Pix, varredura de telas. Relatório, sem código.
- **E4b** — rótulos e mapas (tabela da seção 4, sem a Rescisão) + testes.
- **E4c** — formulário de venda (seções 1 e 2) + pular o documento (seção 3) + testes.
- **E4d** — Rescisão sem multa e bloqueio de Alterar tipo de cobrança para Consultoria + ajuste do aviso (seção 5).
- **E4e** — roteiro manual no NICOLAS TESTE e limpeza dos dados de teste.

Rollback: as mudanças são só de tela. Basta reverter os arquivos da sub-etapa (histórico do projeto). Nada no banco. Nada publicado até ordem do dono.

## Não será tocado

/planos e o checkout público, edge functions, crons, funções do banco, flags, cartão/Rede, Pix Automático, comissões (E3d), itens do catálogo (seguem `ativo=false`), VendaDialog legado, modelos de contrato, dados reais.

## Riscos

- O servidor pode recusar item inativo mesmo para aluno de teste. Nesse caso o teste de ponta a ponta só acontece na E6.
- `fn_calcular_rescisao` pode aplicar multa de recorrência ao Mensal. Na E4d a tela mostra "sem multa", mas o cálculo do servidor continuaria o mesmo até ser ajustado em outra etapa.
- O ajuste do aviso "livre" pela tela depende do texto exato. Por isso o teste usa o texto real.

## Perguntas (com recomendação)

1. Chip visível para toda a equipe com o aviso "em breve", ou só para aluno de teste até a E6? Recomendo: só para aluno de teste.
2. Pacote no cartão: padrão em N parcelas ou em 1? Recomendo: N (4x / 6x).
3. Se a rescisão do servidor calcular multa para a Consultoria, corrigir no banco antes da E6? Recomendo: sim, em etapa própria.
4. "livre" no aviso: só ajustar na tela agora? Recomendo: tela agora, banco junto com a E3d.
