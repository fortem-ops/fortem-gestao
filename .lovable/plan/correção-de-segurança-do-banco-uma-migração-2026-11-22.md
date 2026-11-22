# Correção de segurança do banco (uma migração)

## O que conferi antes (somente leitura)
- **Views:** as 9 views críticas estão sem `security_invoker` e o `anon` tem SELECT. As outras 9 já têm `security_invoker`, mas ainda dão SELECT ao `anon`. `parceiros_publico` é usada em `components/clube/PartnersList.tsx` e fica como está.
- **Tabelas de base das views:** vendas, alunos, planos, profiles, cancelamento_motivos, contratos, cobrancas, cartoes_salvos, pedidos, adquirentes_config, adquirentes_taxas e meios_pagamento_config. Todas já têm policy de SELECT para coordenador/admin, por `is_coordenador_ou_admin`, `is_coordinator_or_admin`, `is_admin_role` ou `is_staff`. Com `security_invoker`, coordenador/admin continuam vendo tudo, e um aluno logado só vê as próprias linhas.
- **Telas que usam as views:**
  - `v_vendas_resumo`: relatórios Vendas e Início dos relatórios.
  - `v_cancelamentos`: relatório Cancelamentos.
  - `vw_contratos_vencendo` e todas as `vw_recebiveis_previstos_*`: Financeiro > Previsibilidade.
  - `v_financeiro_*`, `v_planos_base`, `v_servicos_agenda` e `v_tecnico_alertas`: relatórios.
  - `inadimplencias_view`: `useContratos`.
  - `v_crm_pipeline`, `v_equipe_produtividade` e `v_funil_conversao`: nenhuma tela usa.
- **Funções:** o banco tem 535 funções SECURITY DEFINER no schema public, e **104** delas podem ser executadas pelo `anon`. O motivo é a regra padrão de permissões das funções criadas pelo papel `postgres`, que concede EXECUTE ao `anon` de forma explícita.
- **Quem chama cada função:** procurei cada uma das 104 em `src/` e `supabase/functions/` (chamada direta e indireta pelo nome), nas policies das tabelas e do storage, e no código de outras funções do banco.
- **`rede_tokenizacoes`:** confirmado que tem uma única policy, `staff_all_rede_tokenizacoes` (ALL, `is_staff()`, sem WITH CHECK). O app só lê essa tabela em `useCartoesCobranca` e `VendaSemestral`, que fazem parte da Nova Venda (coordenador/admin).

## Mudanças

### 1. Views
- Ativar `security_invoker = on` nas 9 views críticas: v_cancelamentos, v_vendas_resumo, vw_contratos_vencendo e as seis vw_recebiveis_previstos_*.
- Retirar todas as permissões do `anon` e do PUBLIC nessas 9 views e também em: inadimplencias_view, v_crm_pipeline, v_equipe_produtividade, v_financeiro_aberto, v_financeiro_recebimentos, v_funil_conversao, v_planos_base, v_servicos_agenda e v_tecnico_alertas.
- Manter SELECT para `authenticated` e `service_role`.
- `parceiros_publico`, `v_audit_resumo` e `vw_recebidos_periodo` não mudam.

### 2. Funções críticas
| Função | Quem chama hoje | Depois |
|---|---|---|
| `fn_clube_adicionar_pontos` | tela Clube FORTEM (ajuste manual) e outras funções internas de pontuação | Só `service_role` e chamadas internas. Nova função `fn_clube_ajuste_manual_pontos`, que exige coordenador/admin e só faz ajuste manual. A tela Clube FORTEM passa a chamar a nova função. |
| `fn_agendar_servico` (5 parâmetros) | só `fn_agendar_servico_equipe`, interna | Só `service_role`. A versão de 2 parâmetros, usada no portal, continua para `authenticated`. |
| `fn_agenda_estornar_credito_por_agenda` | nenhum lugar do app | Só `service_role` |
| `fn_clube_conceder_badge` | só funções internas de conquistas | Só `service_role` |
| `fn_desafio_atualizar_progresso` | tela Clube FORTEM | `authenticated`, com checagem interna: staff ou chamada sem usuário (rotina do servidor) |
| `fn_auditoria_fiscal_pagamentos`, `_creditos`, `_pipeline` | rotina do servidor, com chave de serviço | Só `service_role` |
| `fn_gerar_tarefas_relatorio_tecnico` | nenhum lugar do app | Só `service_role` |
| `fn_treino_concluir_sessao` | nenhum lugar do app | `authenticated`, com checagem: o aluno só registra para si mesmo, a equipe registra para qualquer aluno e os demais recebem erro |
| `fn_plano_principal_ativo` | só funções internas | Só `service_role` |
| `fn_listar_profissionais` | Carteira de Alunos, Carteira Consultor, Central de Tarefas | `authenticated`, com checagem `is_staff`; para quem não é da equipe devolve vazio |
| `aluno_user_id` | policy de `aluno_calendar_tokens` (authenticated) | Tirar só do `anon`; continua para `authenticated` porque a policy depende dela |

### 3. `rede_tokenizacoes`
- Remover a policy `staff_all_rede_tokenizacoes`.
- Criar uma policy de SELECT só para coordenador/admin (`is_coordinator_or_admin(auth.uid())`).
- Sem policy de escrita: só as rotinas do servidor (`service_role`) gravam.
- `authenticated` fica só com permissão de leitura; `service_role` mantém acesso total.

### 4. Endurecimento geral
- Mudar a regra padrão (`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon`). A regra padrão do papel `supabase_admin` não é alterável pelo projeto.
- Retirar o EXECUTE do `anon` e do PUBLIC em todas as 104 funções, exceto as listadas abaixo.
- Funções de gatilho (38) e as que só as rotinas do servidor usam: retirar também do `authenticated`. Gatilho não precisa dessa permissão para disparar.
- Demais funções usadas por telas logadas (portal, ponto, fichas, loja da equipe etc.): continuam para `authenticated`.
- Não mexer em `pgaudit_*`, que pertencem a uma extensão do banco.

**Ficam abertas ao `anon` (lista exata e motivo):**
- `fn_parceiro_login`: login de parceiro.
- `fn_validar_link_cartao`: página Cadastrar Cartão.
- `fn_validar_link_contrato`: página Aceitar Contrato.
- `fn_planos_publico_2027`: página /planos.
- `fn_proposta_plano_2027_criar`: página /planos.
- `fn_site_fotos_publico`: site público.
- `fn_site_foto_publicada`: regra de leitura pública das fotos do site, usada por visitante sem login.
- `fn_festa_total_confirmados`: página da Festa 10 anos.
- `fn_festa_fotos_interacoes`: fotos da Festa (curtidas de visitante).
- `fn_loja_estoque_disponivel`: Loja pública.
- Funções que respondem só sobre quem está logado e aparecem em policies aplicadas a todos os papéis: `is_staff()`, `is_staff(uuid)`, `is_admin_role`, `is_professor_staff`, `is_staff_or_aluno`, `has_role`, `is_admin`, `is_coordinator_or_admin` e `fn_current_aluno_id`. Se forem retiradas, consultas de visitante a tabelas públicas passam a dar erro em vez de voltar vazias.

**Sai do `anon`, embora a sua lista sugerisse manter:** `fn_inserir_inscricao_prova`. Ela só é chamada pela rotina `corrida-registrar-inscricao`, que usa a chave de serviço.

## Telas para testar depois (logado como coordenador/admin)
- **Relatórios:** Início, Vendas, Financeiro, Planos, Serviços, Cancelamentos e Técnicos.
- **Financeiro:** Previsibilidade (recebíveis e contratos a vencer) e a inadimplência na ficha do aluno.
- **Clube FORTEM:** ajuste manual de pontos e atualizar progresso de desafio.
- **Carteira de Alunos, Carteira Consultor e Central de Tarefas:** filtro de profissionais.
- **Nova Venda:** cartão salvo / Semestral (lê `rede_tokenizacoes`).
- **Portal do aluno:** agendar e cancelar serviço/treino, horário fixo e resgate no Clube.
- **Páginas públicas sem login:** /planos, Festa 10 anos, fotos do site, Loja, link de cartão, link de contrato, login de parceiro e inscrição de corrida.

## Detalhes técnicos
- Uma única migração, com blocos na ordem 1 a 4. As novas checagens dentro das funções mudam só o começo de cada uma, depois de ler a definição atual.
- `src/pages/ClubeFortem.tsx`: trocar a chamada de ajuste manual para `fn_clube_ajuste_manual_pontos`.
- Teste de regressão `src/test/segurancaAnon.test.ts`: confere na migração as views com `security_invoker`, a lista de funções abertas ao `anon`, a nova policy de `rede_tokenizacoes` e a checagem de aluno em `fn_treino_concluir_sessao`.
- Depois de aplicar: refazer como `anon` as consultas das views (esperado: sem acesso) e a contagem das funções executáveis por `anon` (esperado: 19).
- Rodar `bunx vitest run` e o eslint, e abrir as telas acima no navegador.
