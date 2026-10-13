# /planos: cadastro único (fim da identificação duplicada)

Executar só depois de concluído o item em fila (isenção da prévia de admin nos limites). Não misturar.

## Fluxo novo

```text
Passos 1-4 (escolhas) -> Passo 5 REVISÃO do plano (sem formulário)
  -> CADASTRO DO CONTRATANTE (único formulário + busca por CPF)
     -> proposta criada aqui -> iniciar sessão -> contrato -> pagamento -> confirmação
```

Ponto que vale para o público hoje: o checkout só abre para prévia admin, lista de teste ou flag ligada. Com `planos_checkout_ativo=false`, o visitante comum preenche o cadastro único, a proposta é criada e ele vê "A equipe FORTEM entra em contato", como hoje. Nada de contrato ou pagamento aparece para o público.

## Respostas aos pontos

**a) Privacidade.** Sim, mantemos o código por e-mail. Tudo é reaproveitado: `planos-codigo` (enviar/validar), `fn_planos_resolver`, `planos_verificacoes`, `fn_planos_limite` com os mesmos limites (10/IP, 5/identificador, 5/e-mail, 40 validações/IP), Resend, e-mail mascarado.
- O banner no topo pede o CPF. O botão "Buscar meus dados" chama direto `planos-codigo` (enviar, tipo cpf). O passo `fn_planos_identificar`, que devolve as iniciais, sai deste fluxo. Assim nada é revelado antes do código, nem mesmo as iniciais.
- A resposta é sempre a mesma para o visitante: "Se este CPF tiver cadastro com e-mail, enviamos um código para o e-mail cadastrado." O e-mail mascarado só aparece se houver envio. Para não abrir enumeração, o servidor passa a responder a mesma coisa, com o mesmo tempo aproximado, quando não acha o CPF, acha 0 ou 2+ cadastros, ou o cadastro não tem e-mail. Mudança pequena em `planos-codigo`: o motivo "sem_email" deixa de ser diferente. Só "limitado" continua distinto.
- Código validado: o servidor devolve os dados para preencher por meio de uma ação nova `dados_verificados` em `planos-codigo`. Ela exige `verificacao_id` validado há menos de 30 min e ainda não consumido, e devolve os mesmos campos de `fn_checkout_2027_dados_contratante`: nome, e-mail, nascimento, endereço, RG e só os 3 últimos dígitos do CPF.
- Sem código, ou com CPF de 0/2+ cadastros ou sem e-mail: nada é preenchido e a pessoa segue como novo. A equipe confere o vínculo depois, como hoje (`aluno_suspeito_id`).
- Prévia admin: o CPF digitado preenche direto, sem código. O servidor confere has_role admin pelo token, como em 2D-1, e o cadastro precisa ser único.

**b) Criação da proposta.** `fn_proposta_plano_2027_criar` passa a rodar ao clicar "Continuar para o contrato", no fim do cadastro único. Ela recebe as escolhas, nome, WhatsApp, e-mail, CPF, consentimento e `verificacao_id` (se houver).
- O vínculo validado continua igual: o código é consumido pela função.
- Lead e notificação "Nova proposta do site" continuam nascendo na mesma função, no mesmo momento.
- O consentimento de contato (LGPD) vira uma caixa obrigatória no próprio cadastro e é gravado na proposta como hoje.
- Endereço, nascimento e RG continuam indo só para `gerar_contrato` (não vão para a proposta nem para o cadastro do aluno).
- No checkout liberado, o mesmo envio chama `iniciar` e em seguida `gerar_contrato` com os dados já digitados. A tela de dados do contrato deixa de existir como formulário separado e vira só a leitura do contrato.

**c) CPF obrigatório.** Ele é validado no navegador e no servidor, com máscara. O servidor só compara pelo `cpf_hash`, e o contrato confere o CPF contra o cadastro quando há vínculo. O CPF nunca vai para URL, log, console, sessionStorage ou mensagens de erro. A sessão guardada continua só com proposta_id e chave.

**d) Tipo Novo/Aluno/Ex-aluno.** Os botões saem da tela e o tipo passa a ser inferido:
- `aluno` ou `ex_aluno`: quando o vínculo foi confirmado por código. O servidor decide pelo status do cadastro em `fn_proposta_plano_2027_criar`, que já tem o aluno_id.
- `novo`: nos demais casos, inclusive quando o CPF bate com um cadastro sem confirmação. Esse caso continua marcando `aluno_suspeito_id` para a equipe.

A coluna `tipo_identificacao`, o contrato e a notificação seguem recebendo os mesmos valores.

**e) Impacto.**

| Arquivo | Mudança |
|---|---|
| `src/pages/PlanosPublico2027.tsx` | Passo 5 vira revisão. Abre o cadastro único, cria a proposta no envio e, na prévia, inicia o checkout |
| `src/components/planos/IdentificacaoPublica.tsx` | Substituído por `CadastroContratante2027.tsx` (banner CPF, código, campos completos, consentimento). O arquivo antigo é removido |
| `src/components/planos/CheckoutSite2027.tsx` | A etapa "dados" é removida. Recebe os dados do cadastro e gera o contrato direto. A retomada pelo servidor continua |
| `src/lib/checkoutSite2027.ts` | Helper para gerar o contrato com os dados em memória (nunca em storage) |
| `supabase/functions/planos-codigo` | Resposta única anti-enumeração. Ação `dados_verificados`. Ramo prévia admin |
| `supabase/functions/planos-checkout` | `dados_contratante` fica só para retomada. `iniciar` e `aceitar` sem mudança |
| `src/config/planosPublicoTextos.ts` | Banner "Aluno ou ex-aluno? Coloque o seu CPF para preenchimento automático dos seus dados.", textos do código e do consentimento |
| Migração `planos_cadastro_unico` | `fn_proposta_plano_2027_criar` passa a exigir CPF válido e a inferir o tipo. Nova `fn_planos_dados_verificados(p_verificacao_id)` (security definer, search_path fixo, EXECUTE só service_role). Os limites públicos ficam iguais e a isenção da prévia é mantida |
| Testes e `AGENTS.md` | Ver abaixo. A regra da identificação pública é atualizada para "cadastro único com CPF e código" |

O que não muda: `fn_checkout_2027_iniciar/aceitar/estado/revisar/alterar`, pagamentos P0–P2, `pix-webhook`, Rede, Inter, Loja, Corrida, catálogo, cron, dados de alunos e Turnstile (segue desligado). `planos_checkout_ativo` segue false e nenhuma cobrança é feita.

**f)** Confirmado: nenhum dos itens protegidos é tocado. Também não envio e-mail de código a ninguém fora do NICOLAS TESTE, porque a lista de teste continua valendo.

## Riscos e reversão
- **Risco:** visitante sem e-mail no cadastro perde o preenchimento automático e preenche à mão, o que é aceitável.
- **Risco:** as propostas passam a nascer mais tarde, então haverá menos propostas "abandonadas" com só WhatsApp. É um efeito esperado, e vale você saber.
- **Reversão:** o código antigo do formulário fica recuperável pelo histórico. A migração só substitui funções (CREATE OR REPLACE), e a versão anterior fica guardada para reaplicar.

## Testes
- Unitários: resposta idêntica (mesmas chaves e textos) para CPF existente, inexistente, duplicado e sem e-mail. Sem código validado, `dados_verificados` recusa. CPF inválido é recusado. O tipo é inferido corretamente.
- Reais (servidor):
  - visitante anônimo com o CPF do NICOLAS TESTE não recebe nenhum dado sem o código;
  - um CPF inexistente recebe a mesma resposta;
  - um novo aluno completa o cadastro sem busca e a proposta nasce com lead e notificação;
  - na prévia admin, o preenchimento é direto.
- Playwright (admin, prévia):
  - revisão, cadastro único, contrato, pagamento reservado e confirmação;
  - ao recarregar, a página continua na mesma etapa;
  - mobile e desktop.
- No fim, informo as contagens (pix 19, pagamentos 3, pagamentos_rede e vendas sem mudança, crons 34/33, docs 369) e listo as propostas de teste criadas.

## Decisão em aberto
- Antes do código, a tela pode mostrar as iniciais do nome, como hoje, para a pessoa confirmar que é ela. Isso também ajuda a enumerar CPFs. Recomendo não mostrar e responder sempre igual.
