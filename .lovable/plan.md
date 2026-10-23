# E3 Consultoria Online — venda no servidor (plano detalhado)

Somente plano. Cada sub-etapa (E3a–E3d) tem migração e aprovação separadas. Serviços: pacote 4/6 meses recusa serviços (decisão mantida). Mensal segue o Start: hoje o Start aceita serviços **cobrados à parte** (Pix ou até 6x), nunca dentro da mensalidade.

## Regra que garante "Start/Power/Pro idênticos"
Toda mudança entra como condição nova só verdadeira para `familia = 'consultoria_2027'`. Para as outras famílias, cada expressão alterada devolve exatamente o mesmo valor de hoje (ex.: `c.atividade` vale `treinamento_funcional` em todos os itens Start/Power/Pro, conferido no E1). Prova por ensaio antes/depois (seção Testes).

## 1. O que muda, função por função

### Regras de tabela (E3a)
| Regra | Hoje | Mudança |
|---|---|---|
| `planos_atividade_check` (planos) | aceita `treinamento_funcional`, `corrida` | + `consultoria_online` |
| `contratos_plano_tipo_check` | lista com `start_2027`, `power_2027`, `pro_2027` | + `consultoria_2027` |
| `contratos_vigencia_tipo_check` | `mensal`, `semestral`, `anual` | + `quadrimestral` (4 meses); 6 meses usa `semestral`, Mensal usa `mensal` |
| `fn_planos_validar_tipo` | aceita nome do catálogo na mesma atividade | **sem mudança**: "Consultoria Online" + `consultoria_online` já casa com o catálogo novo; o legado continua na atividade `treinamento_funcional` |

### `fn_venda_2027_gravar` (E3b) — 248 linhas; troca cirúrgica, mesma assinatura
Hoje: Start = 1 ciclo, Power/Pro = 12 meses/12 parcelas; atividade gravada fixa `treinamento_funcional`; sempre cria crédito de Treino.
Mudanças (só afetam a família nova):
- `v_ciclo := v_ehstart OR familia = 'consultoria_2027'` substitui `v_ehstart` nos pontos de **ciclo mensal** (nº de cobranças, fim do ciclo, renovação automática, `vigencia_tipo`, `duracao_meses`, sem taxa). Para Start/Power/Pro `v_ciclo = v_ehstart`.
- `v_pacote := modalidade = 'pacote'`: forma só `cartao_parcelado`/`pix_vista`; parcelas `1..periodo_meses`; recusa serviços; total = valor; fim = início + `periodo_meses`; `duracao_meses = periodo_meses`; `renovacao_automatica = false`; `vigencia_tipo` 4→`quadrimestral`, 6→`semestral`. As parcelas usam o mesmo laço atual (sobra na última), igual ao cálculo da E2.
- Atividade do plano e do filtro de "substituir": `c.atividade` no lugar do texto fixo. Start/Power/Pro continuam `treinamento_funcional`; Consultoria vira `consultoria_online`, então **vender Consultoria não encerra o plano presencial** e vice-versa.
- Créditos: para `consultoria_2027` não cria crédito de Treino nem movimento (hoje criaria um crédito com 0). Avaliações e bota já não geram nada (itens com 0).
- `plano_tipo` do contrato = `c.familia` (já é assim) → `consultoria_2027`.

### `fn_venda_2027_criar` (E3b)
Hoje aplica desconto: mensal abate a 1ª cobrança; anual reparte nas parcelas (sobra na última); só Start grava `desconto_recorrente`.
Mudança: uma linha — `desconto_recorrente` vale para `start_2027` **ou** `consultoria_2027` (Mensal). Pacote cai no ramo "anual" já existente, que usa `contratos.parcelas` (N) e trava desconto ≥ valor. Nada muda para Power/Pro/Start.

### Mensal recorrente (E3c)
O Mensal manual segue o mesmo caminho do Start de balcão:
- `fn_mensalidade_manual_gerar` (linha `IF k.plano_tipo = 'start_2027'`) e `fn_mensalidade_manual_proximo` (`IS DISTINCT FROM 'start_2027'`): passam a aceitar `IN ('start_2027','consultoria_2027')`.
- `fn_renovar_start_2027` (filtro `familia = 'start_2027'` na linha do catálogo): passa a aceitar as duas famílias. As checagens de proposta do site (linhas 21/23) ficam como estão — Consultoria nunca tem proposta.
- Função de borda `renovar-planos-mensais`, **só no bloco 2027** (linha 282): `.eq("planos_catalogo.familia","start_2027")` vira `.in(..., ["start_2027","consultoria_2027"])`. Bloco legado intocado. Republicar.
- `fn_recorrencia_2027_inadimplente_aviso`: só o rótulo — `WHEN 'consultoria_2027' THEN 'Consultoria Online'` (hoje cairia no texto técnico).
- `planos-recorrencia-diario` e `fn_recorrencia_2027_devidas/_reservar/_resultado`: **sem mudança** (não olham família; cobram qualquer mensalidade válida com `meio='cartao'`).
- `fn_mensalidade_2027_validar`: **sem mudança** (confere contrato/token, não família).
- `fn_creditos_mensais_2027`: **sem mudança** (só Start e bota do Pro; Consultoria fica fora por construção). Confirmado por ensaio.

### Comissão (E3d)
- `fn_carteira_ativos_por_profissional` hoje conta qualquer aluno com plano ativo (fora agregadora/VIP) → Consultoria **entraria** na carteira ativa. Mudança: excluir planos com `atividade = 'consultoria_online'` (para quem só tem Consultoria). Start/Power/Pro iguais.
- Comissão de avaliação: depende de avaliação com mobilidade + força; não é afetada.

### Funções que NÃO mudam (citam famílias, mas só servem o site/propostas)
`fn_planos_publico_2027`, `fn_proposta_plano_2027_criar`, `fn_checkout_2027_calcular/_template/_email_dados`, `fn_consultas_2027_termo`, `fn_golive_2027_ativar/_snapshot`, `fn_mensalidade_2027_espelho`, `fn_mensalidade_2027_fim_contrato`, `fn_recorrencia_2027_proximo_ciclo`, `fn_recorrencia_2027_cronograma`, `fn_recorrencia_2027_cancelar`. Todas filtram por proposta do site, que a Consultoria nunca tem.

## 2. Venda sem contrato
- `contratos` (registro financeiro) é criado normalmente, com `plano_tipo = consultoria_2027`, vigência e cobranças. Não é contrato jurídico.
- Nenhum documento: o servidor não lê `contrato_templates`; o documento é gerado pela tela depois. Na E4 a tela pula essa geração para a família nova e mostra "plano sem contrato".
- Ativação do aluno: igual às outras vendas (plano ativo + cobranças); não depende de documento.
- Perfil (E4): contrato aparece como "Sem documento de contrato".

## 3. Vigência e parcelas
- 4 meses: plano e contrato de início até início + 4 meses; 1 a 4 cobranças mensais a partir do 1º vencimento (Pix = 1).
- 6 meses: idem com 6.
- Mensal: 1 cobrança de R$ 189,00 (− desconto), ciclo de 1 mês, `renovacao_automatica=true`, `proxima_renovacao` = fim do ciclo; depois do pagamento, `fn_mensalidade_manual_gerar` cria a próxima mensalidade em `planos_2027_mensalidades` e a rotina diária cobra no cartão, com as mesmas retentativas.

## 4. Conferências
- Créditos: nenhum crédito de treino → não agenda nem ocupa vaga.
- Clube: `fn_clube_nivel_por_plano` usa `nivel_clube` do catálogo → Bronze. Pontos de presença vêm de treino realizado → zero. Com plano presencial junto, `fn_plano_principal_ativo` prioriza o presencial (Consultoria fica como "outro").
- Resgates do Clube (`fn_clube_resgatar`): família nova não está em `planos_elegiveis` e cai no custo padrão — sem mudança (ver pergunta 2).
- Agregadoras: não envolvidas.
- Previsibilidade/LTV: leem `cobrancas` → contam os valores reais; vendas de teste (`teste_2027`) já ficam de fora.

## 5. Sub-etapas, testes e volta
1. **E3a** regras de tabela. Ensaio: inserir plano/contrato de Consultoria no NICOLAS TESTE e desfazer.
2. **E3b** `fn_venda_2027_gravar` + `fn_venda_2027_criar`.
3. **E3c** mensal (3 funções + rótulo + bloco 2027 de `renovar-planos-mensais`).
4. **E3d** carteira ativa.

Ensaios (sempre com ROLLBACK, NICOLAS TESTE, nada gravado):
- Consultoria: Mensal sem/com desconto R$ 20 (1ª cobrança 169,00); 4 meses 4x (4×169,00); 6 meses 6x com R$ 10 (5×147,33 + 147,35); 4 meses 3x com R$ 0,01 (3×225,33); Pix à vista (1×894,00); recusas: 5x/7x, desconto ≥ valor, serviços no pacote. Conferir venda, plano, contrato, cobranças e ausência de créditos; Mensal: renovação e geração da 2ª mensalidade.
- Prova Start/Power/Pro: **antes** de cada migração, rodar vendas de ensaio (Start 1x com desconto recorrente, Power 3x anual 12x com serviços, Pro livre recorrência) e guardar uma impressão digital (md5 das linhas criadas sem ids/datas); **depois**, repetir e comparar — tem que ser igual. Mais: contagens e md5 do catálogo e das funções não tocadas; `renovar-planos-mensais` em ensaio com o Start.
- Testes do sistema (1.034) rodados ao fim.

Volta: um script por sub-etapa em `scripts/consultoria-online-e3x.rollback.sql`, com o corpo anterior de cada função (copiado do banco antes de aplicar) e as regras antigas; recusa rodar se já existir venda de Consultoria. Função de borda: republicar a versão anterior.

## 6. Riscos
- `fn_venda_2027_gravar` é grande: a troca é feita sobre o texto atual do banco, com diff mostrado linha a linha antes de aplicar.
- `quadrimestral` é valor novo de vigência: telas que traduzem esse campo podem mostrar o texto cru (tratado na E4).
- Aluno com Consultoria + presencial: planos com atividades diferentes não se substituem; renovação do Start não confunde porque compara a mesma atividade.

## O que NÃO será tocado
Bloco legado de `renovar-planos-mensais`, `planos-recorrencia-diario`, funções de cobrança do cartão, Pix Automático e liberações, flags, checkout e funções do site, `fn_mensalidade_2027_validar`, modelos de contrato, item legado (R$ 774), telas e app do aluno (E4/E5), dados reais.

## Perguntas (com recomendação)
1. Vigência de 4 meses: novo valor `quadrimestral` ou gravar `mensal`/outro já existente? **Recomendo `quadrimestral`** (fiel ao prazo, sem afetar os outros).
2. Aluno só Consultoria pode resgatar recompensas do Clube? **Recomendo: sim, com o custo padrão das recompensas**, sem mudança agora.
3. Na carteira ativa (comissão), aluno com Consultoria + presencial conta normalmente pelo presencial? **Recomendo: sim**; só quem tem apenas Consultoria fica fora.
4. Mensal pode ter serviços cobrados à parte, como o Start? **Recomendo: sim**, igual ao Start.
