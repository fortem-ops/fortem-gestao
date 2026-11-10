# Pix Automático para contratos atuais e 2027 (análise, sem alterações)

Nada foi alterado. Todas as leituras foram somente consulta.

## A) O que existe hoje

Tela Meios de Pagamento > Pix Automático (`src/components/student/financeiro/PixAutomaticoSection.tsx`, `AtivarPixDialog.tsx`):
- "Ativar": admin digita um "valor mínimo" e as datas. Chama `pix-criar-recorrencia` (POST `/pix/v2/rec`) e depois `pix-solicitar-confirmacao` (POST `/pix/v2/solicrec`). Fica salvo em `pix_recorrencias` como CRIADA, depois AGUARDANDO_AUTORIZACAO.
- Lista a recorrência e as `pix_cobrancas` do aluno, e tem "Cancelar" (`pix-cancelar-recorrencia`).
- Limites do código atual (`_shared/pix-rec.ts`):
  - `vinculo.contrato` = id do **aluno** (linha 20), e não o do contrato. Hoje existe uma autorização por aluno e nada a liga a contratos.
  - Envia `valorMinimoRecebedor` (linha 24) e `politicaRetentativa: PERMITE_3R_7D` (linha 25).
  - `pix_recorrencias.contrato_id` existe, mas a tela não o preenche.
- **Nenhum código envia a cobrança mensal ao Inter** (busca por `/pix/v2/cobr` em `supabase/functions` sem resultado). Ou seja, a autorização funciona, mas nada debita o aluno todo mês. Para planos atuais, o fluxo não cobra.
- `pix-webhook` (`eventos.ts`): atualiza o status da recorrência (APROVADA→AUTORIZADA) e das cobranças (CONCLUIDA→LIQUIDADA) sem repetir a mesma atualização. A baixa de uma cobrança Pix Automático hoje só toca `pix_cobrancas`, vendas de Corrida e pedidos. Não dá baixa em `cobrancas` de contrato.
- 2027: `fn_pix_automatico_2027_*` só funcionam com `proposta_id` / `origem='site_2027'` (por exemplo, `fn_pix_automatico_2027_aviso` filtra `origem = 'site_2027'` e atualiza `propostas_planos_2027.pix_aut_estado`). Estão desligadas por `planos_pix_automatico_ativo=false`, lista de planos vazia e `rotina_pausada=true`. Isso é decisão anterior sua (Pix Automático só Power/Pro, taxa R$ 24,90, ainda não liberado).
- Na Nova Venda já existe a opção "Pix Automático" (`PagamentoStep.tsx:59`), mas sem cobrança automática por trás.

Fluxo completo hoje: autorização (funciona) → cobrança mensal (**não existe**) → baixa (só no webhook, sem ligar a contrato) → falha e retentativa (só a política declarada no Inter) → cancelamento (funciona por admin e pelo webhook).

## B) Regras do Inter/BCB
Vieram do código: `valorMinimoRecebedor`, periodicidade MENSAL, `PERMITE_3R_7D` e código de autorização válido por 7 dias (`pix-rec.ts:58`).
**Precisam ser confirmadas na documentação do Inter/BCB antes de implementar (não verifiquei agora):**
- Valor fixo ou variável. Pelo que sei do regulamento: no valor variável o **pagador** pode definir um teto (`valorMaximo`), e o recebedor só define o mínimo. Se a cobrança passar do teto, o débito não acontece. Sua premissa ("autoriza um máximo e o mês varia até ele") está quase certa, mas o teto é escolha do aluno no app do banco, não nossa.
- A cobrança precisa ser enviada entre 2 e 10 dias antes do vencimento.
- `PERMITE_3R_7D`: até 3 novas tentativas em 7 dias, combinando com o seu D0/D+1/D+3.
- O pagador pode cancelar a qualquer momento no app do banco, e o aviso chega pelo webhook.

## C) Contratos atuais
- As mensalidades ficam em `cobrancas`, **uma por contrato e ciclo** (`contrato_id`, `numero_ciclo`, `valor`, `data_vencimento`, `status`, `forma_pagamento`, `gateway`, `tid`). A baixa é manual ou pelo cartão. Os planos 2027 usam `planos_2027_mensalidades`, ligadas a `cobrancas.mensalidade_2027_id`.
- Proposta de vínculo: tabela nova com 1 recorrência para N contratos (recorrência, contrato, ativo desde, ativo até). `vinculo.contrato` passa a ser o id da recorrência.
- Cobrança do mês: soma as `cobrancas` pendentes dos contratos ligados que vencem no período, gera uma `pix_cobranca` com a composição e trava cada `cobranca` (marcada como reservada para o Pix).
- Rateio: um débito total dá baixa em todas as `cobrancas` da composição. Débito falho mantém todas pendentes. O Pix Automático debita o valor inteiro ou nada, então não há débito parcial. Se houver valor diferente por alguma exceção, a cobrança fica para conferência manual, sem baixa automática.
- Ao trocar: `contratos.forma_pagamento='pix_automatico'` só depois de AUTORIZADA. `cartao_token_id` é mantido, mas o contrato sai da cobrança no cartão.
- Contra cobrança dupla:
  - (1) a cobrança no cartão e a geração Pix olham a mesma marca da `cobranca`, com bloqueio de linha;
  - (2) um contrato só pode ter um vínculo ativo;
  - (3) a cobrança no cartão ignora contratos com `forma_pagamento='pix_automatico'`;
  - (4) nenhuma `cobranca` com Pix em andamento pode ser cobrada no cartão de um clique.
- O cartão automático dos planos atuais segue desligado: `cobrar-recorrencias-diario` fica inativo e não é tocado.

## D) Tela em Plano & Financeiro
Na aba Meios de Pagamento (`StudentPlanoFinanceiro.tsx`), substituir a seção atual por "Pix Automático":
- marcar os contratos (com valor e soma), dia de débito, teto sugerido, botão "Gerar código/QR" e opção de copiar o link para WhatsApp;
- estados: rascunho, aguardando autorização (com validade e "gerar novo código", até 3), ativa, falha no mês, cancelada (pelo aluno ou pela equipe);
- "Voltar para cartão": só admin. Cancela no Inter, volta `forma_pagamento` e as pendências viram cobrança no cartão sem cobrança automática para os atuais.
- Permissões: criar e cancelar só admin, conferido no servidor. Coordenador só vê.

## E) App do aluno
- Existe: push (`send-push-notification`, `check-push-triggers`, `portal_push_subscriptions` com 1 aluno inscrito), `PortalHome`/`PortalNotificacoes`, aviso interno de inadimplência 2027 (`fn_recorrencia_2027_inadimplente_aviso`, só para a equipe), `send-whatsapp` e e-mails transacionais.
- Falta:
  - "Alterar forma de pagamento" no portal, para o aluno escolher os contratos, gerar o QR e ver o status;
  - um aviso na tela inicial quando houver cobrança falha ou vencida, com o texto de encargos.
- Envio dos avisos: primeiro o aviso na tela inicial (sempre aparece), depois e-mail e, por último, push se o aluno tiver ativado.
- Hoje a regra 2027 é "sem WhatsApp nem e-mail ao aluno" na inadimplência. **Avisar o aluno muda essa regra e precisa da sua decisão.**
- Encargos: `src/lib/encargosAtraso.ts`, linhas 7–8, com multa de 2% única e juros de 1% ao mês proporcional aos dias, corrigido pelo IPCA (linha 89). O aviso deve dizer "multa de 2%, juros de 1% ao mês e correção pelo IPCA".

## F) Riscos e testes
- Riscos:
  - cobrança dupla entre cartão e Pix (marca única com bloqueio de linha);
  - valor acima do teto do aluno (avisar antes de enviar se a soma mudou);
  - aluno cancela no banco (aviso aos admins e multa do contrato);
  - aluno com duas autorizações (bloquear: um contrato só pode estar em um vínculo ativo);
  - LGPD: CPF já sai só do servidor e o log já esconde o CPF;
  - contrato que termina ou é rescindido dentro de um vínculo (sai da soma);
  - o reajuste do contrato pode passar do teto.
- Testes sem cobrança real: testes de rateio e trava, ensaios SQL desfeitos depois, webhooks simulados com os nomes reais do Inter e o modo simulação do envio da cobrança. Teste real de R$ 1,00 só com sua autorização (NICOLAS TESTE ou Bruna Meyer, com estorno depois).

## G) Etapas (do caso do Enio primeiro)
1. P0 leitura: confirmar a documentação do Inter (teto, prazo de envio da cobrança, retentativa) e os contratos do Enio (**a busca por "Enio Frantz" não achou contratos dele; preciso confirmar o nome no cadastro**). Esforço: pequeno.
2. P1 banco: vínculo de N contratos e marca de reserva na `cobranca`, com testes. Médio.
3. P2 autorização feita pela equipe, ligando os contratos, na tela de Plano & Financeiro. Médio.
4. P3 cobrança mensal: envio da cobrança ao Inter com 2 a 10 dias de antecedência, baixa e rateio pelo webhook, retentativa e falha. Grande e de maior risco. Primeiro em simulação, depois um teste real autorizado.
5. P4 voltar para cartão e cancelamento pelo aluno, com aviso aos admins. Pequeno a médio.
6. P5 aviso no app do aluno e e-mail. Médio.
7. P6 o aluno autoriza sozinho no portal. Médio.
8. P7 juntar com o fluxo 2027 (`fn_pix_automatico_2027_*`) ou manter separado. Médio.

## Perguntas para você decidir
1. Taxa de R$ 24,90 também nos planos atuais com Pix Automático? E nos contratos somados, uma taxa só ou uma por contrato?
2. O Start entra? A decisão anterior era "nunca Start por ora", e o caso do Enio é Start + Corrida Start.
3. Débito único somado num só dia: qual dia, se os contratos vencem em dias diferentes?
4. Avisar o aluno por e-mail ou WhatsApp quando a cobrança falhar? Hoje a regra é só aviso interno.
5. Sugerir ao aluno um teto (por exemplo, a soma mais 10%) ou deixar livre?
6. Planos 2027 Power/Pro seguem pelo fluxo próprio do /planos ou passam a usar o mesmo vínculo?
7. Quem pode criar a autorização: só admin, como no cartão de um clique?
