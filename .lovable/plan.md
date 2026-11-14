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
| Upgrade: Start+/Power/Pro ativos com data final | 99, sendo 95 elegíveis (4 já no Livre pelo contrato) |
| Wellhub | 45 |
| TotalPass | 22 |
| Bloqueados (Wellhub + TotalPass juntos) | 0 |
| Agregador que também tem plano direto | 0 |
| Ex-aluno (tem histórico e nenhum plano ativo) | 57 |
| Corrida: cadastros sem Corrida ativa (somam oferta) | 237 |
| Só Corrida (Corrida vira principal, sem oferta de upgrade) | 5 |
| Fora: Start antigo 13, Start 2027 6, VIP 4, Consultoria 3 | — |

## 3. Decisões confirmadas

1. Interesses: leitura e mudança de status **só admin** (coordenador não).
2. Start antigo (13) **fora** do upgrade. Elegíveis: Start+, Power e Pro (antigos e 2027) com data final.
3. Frequência: vale a do **contrato**. Divergentes hoje (16, cadastro → contrato):
   - Power: Julia Marchetti 2→1x; Marília Paz de Paiva 1→3; Nicolas Teste 3→2x (cadastro de teste); Paula Cerski Lavratti 2→3
   - Pro: Edna Weisheimer 3→Livre (fica sem upgrade); Mayara Squeff Janovik 1→2
   - Start+: Betina Schneider de Lima 2→1; Carlos Augusto Piccinini 2→3; Carolina Guerra Baião 1→2; Frederico Luiz Lanziotti Muller 3→2; Gabrieli Lazzari Vieira 2→3; Lisheng Zheng 3→2; Rafael Fernandes e Silva 2→3; Rosane Baur 3→2; Sofia Robin Ávila da Silva 3→2; Sonia Marchetti 2→1
4. Ciclo contado a partir de `planos.data_inicio`.
5. Último pedaço antes da data final conta proporcional.
6. Quem já tem Corrida ativa não recebe oferta de Corrida.
7. Ex-aluno de agregadora entra como ex-aluno.
8. Corrida 6 meses lida por nome + `periodo_meses = 6`; Start 2027 usa "Corrida - Start".

## 4. O que será criado

**Tabela `promo10_interesses`**: aluno_id, segmento, oferta, detalhes (jsonb), valor_promocional, valor_sem_desconto, codigo_pedido único (P10-0001, sequência), status (novo/contatado/fechado/desistiu, padrão novo), observacao, created_at, atualizado_por, atualizado_em. Sem acesso anônimo; inserção só pelo servidor (service_role); leitura e atualização só para admin (`is_admin(auth.uid())`); gatilho que só deixa a equipe alterar status/observacao e grava quem/quando.

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

- Migração única: tabela + grants (service_role ALL; authenticated SELECT/UPDATE, filtrado por RLS só admin) + RLS + gatilho + funções; `REVOKE EXECUTE` de anon/authenticated nas funções de ofertas (a edge function da Fase 2 chama com service_role).
- Arredondamento em centavos (round 2) na parte proporcional; total = proporcional + completos.
- Regra registrada em `src/components/planos/AGENTS.md`; roadmap.md com uma linha.
