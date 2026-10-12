# Fase 4G — Go-live dos planos 2027

## Estado verificado antes do plano
- `planos_catalogo.vendavel_desde/vendavel_ate` e `servicos_catalogo.vendavel_*` são **date**, não timestamptz. A regra atual (`itemVendavel2027` e `fn_planos_publico_2027`) é: vende se `vendavel_desde <= hoje` e `vendavel_ate >= hoje`, com "hoje" no fuso de São Paulo. Por isso:
  - 2027: `vendavel_desde = '2026-10-13'` (passam a vender a partir de 13/10 às 00:00 BRT).
  - Legado: `vendavel_ate = '2026-10-12'` (último dia de venda 12/10). Usar 13/10 deixaria o legado vendendo durante o dia 13 inteiro.
- 5 templates 2027 (versao 1, inativos). Menções a "PIX Automático": Start recorrência 1, Power recorrência 2, Pro recorrência 2; os dois de 12x/Pix à vista têm 0. Nenhum dos 5 menciona boleto.
- Pontos de venda que listam planos:
  - `VendaDialog` (aba atual): busca `planos_catalogo` e `servicos_catalogo` só por `ativo = true`. **Não respeita `vendavel_ate` e não exclui itens versionados.** Ao ativar os 2027, eles apareceriam também na aba legada e o legado continuaria listado.
  - `Venda2027Steps` (botão "Vender plano 2027", só admin): respeita `ativo/vendavel_*` via `itemVendavel2027`.
  - `/planos-atual` (página legada): preços fixos em `src/data/planosPricing.ts`, não lê o catálogo, e continuaria mostrando os preços antigos.
  - `CorridaConfigurator` e `corrida-criar-pedido`: só corrida, intocados.
  - `renovar-planos-mensais`, `rede-cobrar-*`, `venda-pos-aprovacao`, `contratosDocumentos`: leem o catálogo por id ou por `ativo` para renovar e cobrar. Como `ativo` do legado não muda, seguem iguais.
- O ramo legado de renovação já ignora itens versionados.

## Passo 1 — Backup (snapshot)
Uma migration cria `public._golive_2027_backup` (tabela, coluna, id, ativo, vendavel_desde, vendavel_ate, conteudo, capturado_em), com RLS ligada, só admin lendo e sem acesso anon. Em seguida, via run_sql:
- copia os 20 planos 2027 + 27 planos legados de treinamento (`versao is null and atividade <> 'corrida'`) + 5 serviços 2027 + 5 templates 2027 (incluindo o `conteudo` original);
- grava as contagens de referência numa tabela `_golive_2027_contagens`: planos de alunos por `ativo`, contratos por status, cobranças pendentes, créditos ativos, crons ativos (renovação ligada, cartão desligado).

## Passo 2 — Contratos
Substituição só nos 3 templates de recorrência:

```text
Start recorrência §1º
- "...cobrança recorrente automática por cartão de crédito ou PIX Automático, conforme escolha do ALUNO no momento da contratação"
+ "...cobrança recorrente automática por cartão de crédito"

Power e Pro recorrência — cláusula do valor §1º
- "...recorrente mensal automática por cartão de crédito ou PIX Automático, conforme a forma de pagamento cadastrada pelo ALUNO, não se caracterizando..."
+ "...recorrente mensal automática por cartão de crédito, não se caracterizando..."

Power e Pro recorrência — rescisão §1º
- "...de forma recorrente mensal por cartão de crédito ou PIX Automático, a rescisão antecipada..."
+ "...de forma recorrente mensal por cartão de crédito, a rescisão antecipada..."
```

O trecho da escolha do aluno no Start precisa de ajuste gramatical na frase: o texto final exato será mostrado antes/depois na execução. Após a troca, verificar 0 ocorrências de "pix autom" e de "boleto" nos 5 templates e então `ativo = true` nos 5. Templates legados não são tocados.

## Passo 3 — Ativar 2027
`ativo = true`, `vendavel_desde = '2026-10-13'` (já gravado), `vendavel_ate = null` nos 20 planos e 5 serviços 2027. Com isso `/planos` passa sozinha para a página nova.

## Passo 4 — Legado
- `vendavel_ate = '2026-10-12'` nos 27 planos legados de treinamento, mantendo `ativo = true`. Corrida não muda.
- Correção mínima no `VendaDialog`, aba atual: listar só itens com `versao is null` que estejam vendáveis hoje (`vendavel_ate` nulo ou >= hoje). Resultado: após o go-live a aba atual mostra só corrida e serviços legados ainda vendáveis; planos 2027 só no "Vender plano 2027". Ponto ainda em aberto: os serviços legados (pergunta 2).
- A página `/planos-atual` passa a redirecionar para `/planos` quando houver itens 2027 vendáveis, para não exibir preços antigos (pergunta 3).
- Sem mudança em funções de banco legadas (`fn_processar_venda` segue aceitando qualquer plano por id; a trava é na tela). Opcional: trava no servidor (pergunta 4).

## Passo 5 — Garantias antes/depois
Rodar as mesmas consultas do backup depois da execução e comparar linha a linha:
- planos de alunos por `ativo` e por `catalogo_id`; contratos por status; cobranças pendentes (quantidade e soma); créditos ativos;
- crons: renovação diária ativa, cobrança do cartão inativa (leitura via função existente, sem alterar);
- nenhum `updated_at` de `contratos`, `planos`, `cobrancas` alterado durante a janela;
- simulação em transação com rollback da renovação legada de um plano mensal legado (mesmo snapshot antes/depois).

## Passo 6 — Reversão em um comando
Função `fn_golive_2027_reverter()` (admin-only, criada na migration do backup) que, numa única transação, restaura `ativo`, `vendavel_desde`, `vendavel_ate` e `conteudo` de todos os ids do backup. Uso: `select public.fn_golive_2027_reverter();`. A correção do `VendaDialog` continua correta mesmo após a reversão, porque só filtra por datas.

## Passo 7 — Verificação pós-execução
- 2027 ativos: 20 planos / 5 serviços / 5 templates; 0 menções a Pix Automático e boleto.
- Legado: 27 com `vendavel_ate = '2026-10-12'` e `ativo = true`; 21 de corrida sem mudança.
- Anon: `fn_planos_publico_2027(false)` devolve 20 planos e 4 pacotes sem `custo_repasse`/`custo_pro`; leitura direta de `planos_catalogo` (não corrida) e de `servicos_catalogo` continua vazia.
- `/planos` sem login mostra a página nova; envio público cria proposta, lead e aviso (com um teste marcado "TESTE GOLIVE" no aluno de teste).
- Venda de teste 2027 pelo `fn_venda_2027_criar` no aluno NICOLAS TESTE com `origem='teste_2027'`, sem cobrar cartão; contrato gerado pelo template 2027 ativo e sem Pix Automático.
- VendaDialog (Playwright, admin): aba atual sem planos de treinamento legados nem 2027; "Vender plano 2027" lista os 20.
- Testes unitários passando, incluindo novo teste do filtro de vendáveis do VendaDialog.

## Riscos
- Venda 2027 é só admin (`fn_venda_2027_criar` e botão). Coordenadores/consultores ficam sem poder vender planos de treinamento após o go-live (pergunta 1).
- Alunos legados que tentarem comprar novamente o mesmo plano antigo deixam de conseguir pela tela (esperado).
- Contratos 2027 sem revisão jurídica final.
- Reabilitação 2027 sem validação clínica dos pacotes.
- Grupo de corrida: catálogo R$ 170/160/150 por mês vs R$ 180 do protótipo; segue o catálogo.
- Renovação de Start legado continua criando ciclos antigos (correto, não é venda nova).

## Perguntas para o dono
1. Liberar a venda 2027 também para coordenadores, ou manter só admin no início?
2. Serviços legados ativos (avulsos atuais) continuam vendáveis ou recebem `vendavel_ate` também?
3. `/planos-atual` redireciona para `/planos` após o go-live (proposta) ou continua acessível com os preços antigos?
4. Adicionar trava no servidor para impedir venda de plano legado com `vendavel_ate` vencido (pequena checagem no início do `fn_processar_venda`, com prova de rollback do legado)?
5. Revisão jurídica dos 5 contratos e validação da Reabilitação já feitas, ou o go-live espera?

## Detalhes técnicos
- Migration: `_golive_2027_backup`, `_golive_2027_contagens`, `fn_golive_2027_reverter` (SECURITY DEFINER, `is_admin`), grants só service_role/authenticated com RLS admin.
- Dados (run_sql, nesta ordem): backup e contagens; `UPDATE contrato_templates` com `replace` exato dos 5 trechos; checagem; ativar templates; ativar 2027; `vendavel_ate` no legado.
- Código: `VendaDialog.tsx` (filtro `versao is null` e `vendavel_ate`), `PlanosRota.tsx`/`App.tsx` (redirecionar `/planos-atual`), teste unitário do filtro.
- Sem mudança em crons, edge functions, corrida, contratos e planos existentes.
