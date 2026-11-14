# Promoções 10 anos — Fase 1 (banco e regras no servidor)

Só banco + funções + testes. Nada de página, e-mail, tela da equipe, alteração de dados existentes ou ativação de itens do catálogo.

## 1. Onde estão os dados hoje (conferido no banco)

- **Plano ativo**: `planos` (ativo, tipo, data_inicio, data_fim, catalogo_id). Todos os planos ativos de Start/Start+/Power/Pro (antigos e 2027) têm `data_fim` preenchida.
- **Planos atuais (sem catalogo_id)**: tipo por nome em `planos.tipo` ("Start+", "Power", "Pro", "Start"). Frequência está no contrato ativo (`contratos.frequencia_semanal`, 1/2/3/5=Livre), ligado por `contratos.plano_id`.
- **Planos 2027 (com catalogo_id)**: frequência e modalidade vêm de `planos_catalogo.frequencia` e `.modalidade_cobranca` (anual / recorrencia_mensal), família por `familia` (start_2027 / power_2027 / pro_2027).
- **Plano principal**: sempre via `fn_plano_principal_ativo(aluno)` (regra canônica); agregadoras por `planos.tipo` = "Gympass/Wellhub" / "Total Pass"; Corrida via `fn_tem_plano_corrida(aluno, hoje)`.
- **Regras Semestral já existentes**: reaproveitar `fn_semestral_elegivel` (bloqueio Wellhub+TotalPass e "uma contratação por CPF", que conta só vendas pagas e ativadas).
- **Leitura de frequência e início do ciclo**: frequência = catálogo (2027) ou contrato ativo do plano (antigo); início do ciclo = `planos.data_inicio`; fim = `planos.data_fim`.

## 2. Contagem atual (somente leitura, hoje)

| Segmento | Cadastros |
|---|---|
| Equipe (sem oferta) | 7 |
| Upgrade: Start+/Power/Pro ativos com data final | 99 (cerca de 95 depois de tirar os 4 que já estão no Livre) |
| Wellhub | 45 |
| TotalPass | 22 |
| Bloqueados (Wellhub + TotalPass juntos) | 0 |
| Agregador que também tem plano direto | 0 |
| Ex-aluno (tem histórico e nenhum plano ativo) | 57 |
| Corrida: cadastros sem Corrida ativa (somam oferta) | 237 |
| Só Corrida (Corrida vira principal, sem oferta de upgrade) | 5 |
| Fora: Start antigo 13, Start 2027 6, VIP 4, Consultoria 3 | — |

## 3. Riscos e casos que não se encaixam (preciso da sua decisão)

1. **Papel "consultor" não existe** no sistema (papéis: admin, coordenador, professor, nutricionista, fisioterapeuta, aluno). Proposta: leitura e mudança de status para **admin e coordenador**. Confirma?
2. **Start antigo (13 alunos)** é anual e tem data final, ao contrário do Start 2027. A regra de exclusão fala em "Start mensal". Proposta: **excluir** os 13 (lista de elegíveis = Start+, Power, Pro). Confirma ou inclui?
3. **Frequência divergente**: cerca de 25 alunos têm frequência no cadastro diferente da do contrato (ex.: cadastro 3x, contrato 2x). Proposta: valer o **contrato** (o que foi vendido). Lista será entregue para a equipe revisar.
4. **Data de início divergente**: cerca de 45 planos antigos têm `planos.data_inicio` diferente do `contratos.data_inicio` (renovações). Proposta: ciclo pelo **`planos.data_inicio`** (vigência atual). Confirma?
5. **Plano que termina no meio de um ciclo**: o último pedaço conta proporcional (dias até `data_fim` / dias reais desse ciclo), não como ciclo completo.
6. **Corrida para quem só tem Corrida (5)**: já tem Corrida ativa, então não recebe oferta nenhuma.
7. **Ex-aluno que era de agregadora**: entra como ex-aluno (oferta Power/Pro 2027 −R$ 400).
8. **Preço de Corrida 6 meses**: os itens são antigos (sem versão). Leitura por `nome` + `periodo_meses = 6` (Start/Start+ 960, Power 900, Pro 840, Sem Plano 1.080). Start 2027 usa "Corrida - Start".

## 4. O que será criado

**Tabela `promo10_interesses`**: aluno_id, segmento, oferta, detalhes (jsonb), valor_promocional, valor_sem_desconto, codigo_pedido único (P10-0001, sequência), status (novo/contatado/fechado/desistiu, padrão novo), observacao, created_at, atualizado_por, atualizado_em. Sem acesso anônimo; inserção só pelo servidor (service_role); leitura e atualização só para os papéis da decisão 1; gatilho que só deixa a equipe alterar status/observacao e grava quem/quando.

**Funções no servidor (search_path fixo, sem acesso de aluno/anônimo)**:
- `fn_promo10_ciclo(data_inicio, data_fim, hoje, degraus, valor_mes)` — cálculo puro do proporcional + ciclos completos (dia 29–31 vira fim de mês, como na recorrência).
- `fn_promo10_ofertas(aluno_id)` — devolve `{encerrada, segmento, principal[], corrida}` com valores já calculados, lendo preços do catálogo (inclusive inativos). Data limite 31/12/2026 23:59 Brasília. Prioridade: ativo direto > agregador > ex-aluno; Corrida soma.
  - Upgrade: R$ 80/R$ 100 por degrau por mês (valores da promoção definidos por você), todas as frequências acima da atual; valor, sem desconto e economia.
  - Agregador: Start e Pro Semestral da própria agregadora, comparação com Start 2027 3x mensal (economia/mês e 6 meses). Itens continuam inativos/fechados como hoje.
  - Ex-aluno: Power e Pro 2027 anuais 1x–Livre: total − 400 e parcela de 12x; recorrência (mensalidade + taxa) × 12 − 400.
  - Corrida: preço de 6 meses conforme o principal, 7 meses, valor equivalente por mês.
- Equipe (`is_equipe`) sem oferta.

## 5. Testes

- Espelho do cálculo em `src/lib/promo10.ts` (mesmas regras, usado só nos testes e na Fase 3 para exibir) + teste que roda a função do banco contra os mesmos casos em ensaio revertido.
- Casos: Exemplo 1 (R$ 40,00), Exemplo 2 (R$ 616,00 / 770,00 / economia 154,00), ciclo de 31 dias, início dia 30/31, dois degraus, plano que termina no meio do ciclo.
- Elegibilidade: upgrade, Livre fora, Start mensal fora, VIP/Consultoria fora, Wellhub, TotalPass (sem ver preço da outra), bloqueio Wellhub+TotalPass, Semestral já pago, ex-aluno, Corrida com/sem Corrida ativa, equipe, data após 31/12.
- Suíte completa (`bunx vitest run`) e lint nos arquivos alterados.

## Detalhes técnicos

- Migração única: tabela + grants (service_role ALL; authenticated SELECT/UPDATE) + RLS + gatilho + funções; `REVOKE EXECUTE` de anon/authenticated nas funções de ofertas (a edge function da Fase 2 chama com service_role).
- Arredondamento em centavos (round 2) na parte proporcional; total = proporcional + completos.
- Regra registrada em `src/components/planos/AGENTS.md`; roadmap.md com uma linha.
