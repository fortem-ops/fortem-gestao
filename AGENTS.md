# Decisões técnicas

## Regras de trabalho

- Toda correção de bug vem acompanhada de um teste de regressão que reproduz o bug (falha antes da correção e passa depois), entregue no mesmo commit. Por quê: o mesmo bug não pode voltar sem ser detectado.
- Antes de concluir qualquer mudança de código, rodar `bunx vitest run` e informar no resumo quantos arquivos e testes rodaram e se todos passaram; se algum falhar, a tarefa não está concluída — corrigir ou reportar a falha. Testes `.test.ts` rodam em ambiente node; se um precisar de DOM, usar `// @vitest-environment jsdom` na primeira linha. Por quê: a suíte só protege o sistema se rodar sempre.
- Código novo ou alterado não usa `any` (usar tipos de `src/integrations/supabase/types.ts`, `unknown` + validação, ou tipos próprios) e não pode deixar erro de lint: rodar `bunx eslint <arquivos alterados>` antes de concluir. Os `any` antigos saem aos poucos, quando o arquivo for mexido. Por quê: tipos corretos pegam erros de dado nulo ou campo errado antes de chegarem à equipe ou aos alunos.

## Decisões

### Onde estão as demais regras (ler o arquivo da área ANTES de mexer, inclusive em SQL, RPCs, migrações e edge functions)
- Planos, contratos, vendas, descontos, créditos, Recovery e serviços pagos: `src/components/planos/AGENTS.md`.
- Financeiro (despesas, Pix, conciliação, encargos, "Cliente desde"): `src/lib/AGENTS.md`.
- Clube, Comunidade, Indicações e pagamentos/desafios do portal: `src/components/clube/AGENTS.md`.
- Site público, rastreamento, fotos e Festa: `src/site/AGENTS.md`.
- Disparo de Mensagens e WhatsApp: `src/components/disparos/AGENTS.md`.
- Avaliações: `src/components/student/assessment/AGENTS.md`.

- Facial: checked RPCs, service-only queue/import, 120s photos, portal flag. Guardian links: staff-issued, hash-only, atomic service consumption, no public tracking. Desk shares app/guardian terms; team keeps its own. Why: protect minors and consistent consent.
- Read scoped AGENTS.md before editing (also src/lib/AGENTS.md, which holds the despesas/Pix payout rules). Consultation F2: `supabase/functions/planos-consultas-previa/AGENTS.md`; monthly card cron: `supabase/functions/planos-recorrencia-diario/AGENTS.md`.
- Checkout /planos rules live in `supabase/functions/planos-checkout/AGENTS.md`.
- Recorrência automática só em planos 2027 (cron `planos-recorrencia-diario`); legado nunca, e `cobrar-recorrencias-diario` fica active=false sem enxergar vendas 2027. Por quê: regra permanente do dono.
