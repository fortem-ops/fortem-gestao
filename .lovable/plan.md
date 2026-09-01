# Novos planos do funil /planos (sem nomes de tier)

Substituir a estrutura de 5 planos nomeados (Start, Start+, Power, Pro, Max) por duas opções por frequência: horário livre e horário ocioso (9h às 16h).

## Nova tabela de preços

| Frequência | Padrão | Horário ocioso (9h-16h) |
|---|---|---|
| 2x por semana | R$ 479 | R$ 419 |
| 3x por semana | R$ 599 | R$ 499 |

## O que muda no funil

- **Etapa 2 (Planos)**: passa a mostrar 2 cards — "PLANO 2X" e "PLANO 2X · HORÁRIO OCIOSO" (ou 3X, conforme a frequência escolhida na etapa 1). O card de horário ocioso exibe a faixa "Das 9:00 às 16:00" em destaque, e o card padrão fica marcado como recomendado (horário livre).
- **Benefícios**: os dois cards mostram o mesmo conjunto único de benefícios (baseado na lista atual, sem menção a tiers). A única diferença entre eles é preço e restrição de horário.
- **Upgrade inteligente**: o antigo upsell de plano (Power → Pro → Max) é removido. Mantém-se apenas o upsell de frequência (2x → 3x) na etapa 1.
- **Etapa 3 (Resumo)**: o toggle de recorrência mensal (+R$ 30) sai — preço único, sem adicional e sem menção a fidelidade.
- **Mensagem de WhatsApp**: passa a citar frequência + tipo de horário + valor, sem nome de plano e sem sufixo de recorrência.

## Detalhes técnicos

- `src/data/planosPricing.ts`: `PlanoId` vira `"padrao" | "ocioso"`; `PLANOS` reduzido a duas definições (com campo de restrição de horário e lista de benefícios compartilhada); `PRECOS` só com as linhas 2x/3x acima; remoção de `RECORRENCIA_EXTRA`, `PROXIMO_PLANO` e do flag `recorrenciaNativa`; `precoFinal` simplificado para `precoDe`.
- `StepPlans.tsx`: remove o bloco de upgrade de plano, renderiza os dois cards com rótulo dinâmico por frequência e badge de horário.
- `StepSummary.tsx`: remove Switch/Label de recorrência e a linha de adicional; mostra a restrição de horário quando aplicável.
- `Planos.tsx`: remove o estado `recorrencia` e a prop correspondente.
- `WhatsAppCta.tsx`: atualiza `montarMensagem` para a nova assinatura sem `recorrencia`.
- Sem mudanças de banco, SQL ou edge functions — tudo frontend.
