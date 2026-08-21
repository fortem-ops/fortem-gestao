# Estado atual da cobertura de testes — 21/08/2026

Investigação somente. Nada foi alterado; a suíte foi executada em modo leitura (`vitest run --coverage`).

## 1. Arquivos de teste (11 arquivos, 2.071 linhas)

| Arquivo | Domínio |
|---|---|
| `src/lib/__tests__/contratos-calc.test.ts` | Financeiro — cálculo de contratos |
| `src/lib/__tests__/financeiro-edge-cases.test.ts` | Financeiro — casos de borda |
| `src/lib/__tests__/financeiro-queries.test.ts` | Financeiro — queries (Supabase mockado) |
| `src/test/vendas.test.ts` | Vendas |
| `src/test/vendasPaginacao.test.ts` | Vendas — paginação (`fetchAllPages`) |
| `src/test/creditos.test.ts` | Créditos |
| `src/test/comissionamentos.test.ts` | Comissionamentos |
| `src/test/useUserRoles.test.ts` | Permissões (papéis) |
| `src/hooks/__tests__/useUserRoles.test.ts` | Permissões (papéis) — duplicata do anterior, em outra pasta |
| `src/components/student/workout/exportWorkoutPDF.test.ts` | Técnico — exportação de PDF de treino |
| `src/test/example.test.ts` | Smoke test do setup |

Concentração: **financeiro/vendas/créditos/comissionamentos (6 arquivos)**, permissões (2, redundantes entre si), PDF de treino (1), scaffolding (1). Duas convenções de pasta convivem (`src/test/` e `__tests__/` ao lado do código). Zero testes em `supabase/functions/` — o `vitest.config.ts` só inclui `src/**`.

## 2. Execução da suíte (`vitest run`)

- **11 arquivos, 194 testes, 194 passando, 0 falhando, 0 pulados.**
- Duração total: **19,04s** (testes em si 4,49s; o resto é setup/ambiente jsdom).
- Testes mais lentos: `exportWorkoutPDF` (2,1s), `financeiro-queries` (1,1s), `useUserRoles` (0,67s).

## 3. Cobertura (`@vitest/coverage-v8` instalado, sem configuração no `vitest.config.ts`)

Não há bloco `coverage` configurado nem threshold; rodei via flags. Números do provider v8 sobre tudo que foi carregado:

| Métrica | Valor |
|---|---|
| Linhas / statements | **1,01%** (801 de 78.610) |
| Funções | 8,36% (47 de 562) |
| Branches | 21,12% (147 de 696) |
| Arquivos com qualquer cobertura | **7 de 535** |

Único conjunto realmente coberto:

| Arquivo | Linhas cobertas |
|---|---|
| `src/lib/contratos-calc.ts` | 100% |
| `src/lib/comissoes-calc.ts` | 100% |
| `src/lib/creditos-calc.ts` | 100% |
| `src/lib/vendas-paginacao.ts` | 100% |
| `src/hooks/useUserRoles.ts` | 100% |
| `src/components/student/workout/exportWorkoutPDF.ts` | 89,5% |
| `src/lib/vendas-calc.ts` | 69,8% |

Ressalva: o denominador inclui `src/integrations/supabase/types.ts` e as 55 edge functions (todas 0%), então o 1,01% subestima. Mesmo restringindo a lógica pura de `src/lib` (7.523 linhas), só 7 arquivos têm alguma cobertura — a ordem de grandeza continua de um dígito baixo.

## 4. Áreas críticas — com e sem teste

**Com teste (todas em nível unitário, lógica pura ou Supabase mockado):**
- Cálculo de contratos, incluindo edge cases (`contratos-calc`)
- Cálculo de vendas e paginação acima de 1000 linhas (`vendas-calc`, `vendas-paginacao`)
- Créditos (`creditos-calc`) e comissões (`comissoes-calc`)
- Queries financeiras com cliente mockado (`financeiro-queries`)
- Resolução de papéis no cliente (`useUserRoles`)

**Sem nenhum teste:**
- **Pagamentos e-Rede** — `rede-cobrar-cartao` (477 linhas), `rede-cobrar-token`, `rede-salvar-cartao` (453), `rede-webhook`, `rede-tokenizacao-webhook`, `rede-cancelar`, e o `_shared/rede-auth.ts`. Zero cobertura, inclusive nas rotinas de sanitização PCI.
- **PIX / Banco Inter** — as 5 functions `pix-*`, `inter-auth` e `_shared/inter.ts`.
- **Baixa de pagamento e inadimplência** — `src/lib/baixaVenda.ts` e `src/lib/formasRecebimento.ts`, exatamente os módulos criados nas correções desta semana, não têm teste.
- **RLS e permissões no servidor** — nenhuma verificação automatizada de policy, GRANT ou função `SECURITY DEFINER`. `useUserRoles` cobre só a leitura de papéis no cliente; o gate real (`is_staff()`, `has_role()`, 172 triggers) nunca é exercitado por teste.
- **WhatsApp** — nenhuma das 7 functions, e o `_shared/agenda-template.ts` (243 linhas, onde mora o fallback `'—'` do erro Meta 131008) não tem teste, apesar de ser código compartilhado por 18 functions.
- **Ponto** — nenhum teste de tolerância, jornada partida, banco de horas ou fechamento; `src/lib/ponto.ts` e `pontoTolerancia.ts` sem cobertura, e as regras pesadas estão em RPC no banco, fora do alcance do vitest atual.
- **Campanha Corrida** — as 8 functions e o rate limit compartilhado, sem teste, incluindo o dedupe por `cpf_hash`.
- **Avaliações** — `pollockCalculo.ts`, `avaliacaoFuncional.ts`, `bodyMapLogic`, percentis de mobilidade, `kinologyImport.ts` e `parse-kinology-pdf` (o parser que já quebrou duas vezes com layouts diferentes) — nenhum teste.
- **Protocolos de treino** — `m102.ts`, `planStrong.ts`, `wendler531.ts` e os exportadores 5-3-1/M102 sem teste (só o `exportWorkoutPDF` genérico é coberto).
- **Componentes React** — nenhum teste de render/interação: 370 arquivos `.tsx`, 0 testados.

## 5. Comparação com 30/07/2026

| | 30/07 | 21/08 | Variação |
|---|---|---|---|
| Testes | ~182 | 194 | +12 (+6,6%) |
| Arquivos de teste | — | 11 | — |
| Linhas em `src/` + functions | ~ metade do atual | 122.346 | ~+100% |
| Domínios cobertos | vendas, créditos, comissionamentos | os mesmos + contratos e PDF de treino | +2 |

Leitura direta: **não acompanhou**. O código praticamente dobrou (Corrida, Avaliações Premium por percentil, mapa corporal editável, ponto avançado, camada `_shared`, PIX/Inter, MCP), enquanto a suíte cresceu 6,6% e permaneceu ancorada no mesmo núcleo financeiro de julho. Em termos relativos, a cobertura caiu pela metade: o que era "7,5/10 no núcleo financeiro" hoje é "7,5/10 num núcleo que representa uma fatia bem menor do sistema".

Dois agravantes específicos do período: (a) todos os módulos novos de maior risco financeiro e regulatório — e-Rede, PIX, checkout Corrida, baixa de venda — nasceram sem teste; (b) a camada `_shared`, que por definição concentra risco de 18 functions, também nasceu sem teste, e foi justamente onde apareceu o bug Meta 131008 em produção.

Ponto positivo: a suíte está verde, é rápida (19s) e os módulos que ela cobre estão a 100% — a infraestrutura funciona, o que falta é alcance.
