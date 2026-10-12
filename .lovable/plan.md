# Fase 4 — Página pública /planos (2027)

## O que existe hoje (verificado)
- `/planos` já é rota pública (fora do layout autenticado) e renderiza `src/pages/Planos.tsx` com preços fixos em `src/data/planosPricing.ts` e componentes `src/components/planos/*`.
- `planos_catalogo`: anon só lê itens de `atividade='corrida'`; demais leituras exigem staff/aluno. `servicos_catalogo`: sem leitura anônima. Ou seja, hoje o público não consegue ler os itens 2027 — bom, e não vamos abrir as tabelas.
- Leads/CRM: leads são linhas em `alunos` + `pipeline_metadata` (origem_lead, plano_interesse, valor_estimado_plano, notas) + estágio "Novo lead" em `pipeline_stages`. Não há leitura/escrita anônima nessas tabelas.
- `src/lib/vendas2027.ts` exporta `calcularVenda2027`, `calcularServicos2027`, `itemVendavel2027`.

## Decisão sobre a página atual
A página atual de `/planos` é a vitrine legada em uso. Proposta: o arquivo novo `PlanosPublico2027.tsx` assume a rota `/planos`; a página legada continua no código, intocada, acessível em `/planos-atual` até o go-live (pergunta 1). Nenhuma outra rota/tela/cron muda.

## Fluxo (5 passos, mobile first)
```text
1 Frequência + plano  ->  2 Vantagens  ->  3 Turbine  ->  4 Acompanhamento  ->  5 Pagamento + resumo + cadastro  ->  Confirmação
```
1. Frequência 1x/2x/3x/Livre e cartões Start, Power, Pro com preço mensal vindo do catálogo.
2. Comparativo: reposição 50%, fixar horário, bota, avaliações (Pro 2, Power 1), Licença, Clube — tudo derivado das colunas do catálogo; itens não incluídos aparecem como "não incluso".
3. Turbine: Nutrição (Jéssica Elkfury), Reabilitação (Júlia Assis Brasil), Corrida (Yasmim Ávila), fotos placeholder geradas.
4. Acompanhamento: Nutri 4 + 2 avaliações, Nutri 8, Reabilitação 4, Reabilitação 8, Grupo de corrida ou nenhum (valores do `servicos_catalogo`).
5. Pagamento conforme regras: Start só recorrência mensal no cartão; Power/Pro cartão até 12x, Pix à vista ou recorrência mensal no cartão (+ taxa do catálogo); serviços nas 12 parcelas do plano ou até 6x no cartão / Pix à vista. Sem boleto, sem descontos. Resumo com valor exato (calcularVenda2027/calcularServicos2027) e cadastro: nome, WhatsApp, e-mail, CPF opcional, aceite LGPD, honeypot.
- Confirmação: "A equipe FORTEM entra em contato".
- Identidade: Archivo, vermelho da marca, cantos retos, títulos em caixa alta, voz "você", sem exclamação; tokens novos com escopo só nesta página (não altera o tema do sistema). Textos usam "Licença" e "Reabilitação".

## Dados e segurança
- Leitura pública: nova função `fn_planos_publico_2027(previa boolean)` (SECURITY DEFINER, executável por anon) que retorna só campos de venda (codigo, familia, frequencia, preço, parcelas, taxa, créditos, flags de vantagens, nomes de serviço, valor). Nunca retorna `custo_repasse`, `custo_pro`, comissões ou ids internos de configuração.
  - Público: só itens com `ativo` e dentro de `vendavel_desde/ate`. Hoje retorna vazio -> página mostra "Planos 2027 disponíveis em breve" com contato pelo WhatsApp.
  - `previa=true`: só funciona se `is_admin(auth.uid())`; retorna os itens 2027 inativos. Não ativa nada.
- Nenhuma policy nova em `planos_catalogo`/`servicos_catalogo`.
- Lead: nova tabela `propostas_planos_2027` (nome, whatsapp, email, cpf_final só 3 dígitos + cpf cifrado pelo mecanismo existente, configuracao jsonb, valor_total_centavos, parcelas, origem 'site_planos', status, previa boolean, created_at).
  - Insert só via RPC `fn_proposta_plano_2027_criar` (anon), que recalcula o valor no servidor a partir do catálogo, rejeita item indisponível, aplica rate limit por IP/WhatsApp (padrão de `rate_limit_loja_publico`) e grava. Select/update só staff; delete só admin.
  - A mesma RPC cria o lead no CRM existente (`alunos` como lead + `pipeline_metadata` com origem_lead='Site /planos', plano_interesse, valor_estimado_plano, nota com a configuração) no estágio "Novo lead", reaproveitando um lead existente com mesmo WhatsApp/e-mail. Propostas de prévia não criam lead.
- Notificação da equipe: registro em `notificacoes` (categoria comercial) para coordenadores/admin com link para o lead; e-mail/WhatsApp opcional (pergunta 3).
- Interno: aba "Propostas do site" em Leads (somente leitura + abrir VendaDialog); a venda segue sendo feita pelo admin.

## Prévia admin
`/planos?previa=1`: se houver sessão admin, chama a função com previa e mostra faixa "PRÉVIA — itens ainda não estão à venda"; cadastro grava com `previa=true` e não gera lead nem notificação. Sem sessão admin, o parâmetro é ignorado.

## Itens indisponíveis
- Nenhum item vendável: tela "em breve" (sem formulário).
- Combinação sem item (ex.: frequência inexistente numa família) ou serviço inativo: opção desabilitada com "indisponível".
- Item que ficou indisponível entre a escolha e o envio: a RPC recusa e a página pede para revisar.

## Arquivos
- Novo: `src/pages/PlanosPublico2027.tsx`, `src/components/planos2027/*` (Stepper, PassoPlano, PassoVantagens, PassoTurbine, PassoAcompanhamento, PassoPagamento, Resumo, Cadastro, Confirmacao), `src/hooks/useCatalogoPublico2027.ts`, `src/lib/planosPublico2027.ts` (mapeia catálogo -> opções e formas permitidas), imagens placeholder em `src/assets/planos2027/`.
- Interno: componente de propostas na página de Leads.
- `src/App.tsx`: só troca o elemento de `/planos` e adiciona `/planos-atual`.
- Migration: função de leitura, tabela + RLS + grants, RPC da proposta.

## Testes
- Unidade: mapeamento de formas permitidas por família (Start só recorrência; Power/Pro 12x, Pix, recorrência + taxa; serviços 12 parcelas ou até 6x/Pix); resumo bate com calcularVenda2027 em todos os 20 itens.
- SQL: anon não lê `planos_catalogo`/`servicos_catalogo` direto; função pública não retorna custos; previa sem admin retorna vazio; RPC recalcula valor e ignora valor enviado pelo navegador; rate limit.
- Playwright: público vê "em breve"; admin em prévia percorre os 5 passos em 390px e 1280px, envia cadastro e vê confirmação; proposta gravada com previa=true; nenhum lead/notificação criado. Dados de teste marcados, não apagados.

## Riscos
- Trocar a vitrine atual antes do go-live deixa o público sem preços até 13/10 (pergunta 1).
- CPF opcional: dados pessoais — armazenar cifrado e mostrar só final.
- Spam: honeypot + rate limit.
- Lead duplicado no CRM: busca por WhatsApp/e-mail antes de criar.

## Perguntas em aberto
1. Até o go-live, o público em `/planos` vê a página atual (legada) ou o aviso "em breve"? Proposta: manter a legada até o go-live e trocar automaticamente quando houver itens 2027 vendáveis.
2. Grupo de corrida: qual item do catálogo representa (serviço 2027 de corrida ou plano corrida existente)?
3. Além do aviso no sistema, enviar e-mail ou WhatsApp para a equipe a cada proposta?
4. Textos e fotos definitivos dos três profissionais — usar placeholders até você enviar.
