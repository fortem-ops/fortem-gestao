# Diagnóstico: proposta 6e325c45 caiu em "A equipe FORTEM entra em contato"

## O que foi confirmado

- A proposta foi criada às 14:31:13 com `previa=true`, `tipo_identificacao='aluno'`, `aluno_id` preenchido e código de e-mail validado (`verificacao_id` presente). Ou seja, o cadastro foi ligado pelo caminho do código, não pelo "siga com os seus dados".
- Criar uma proposta de prévia exige admin logado (`fn_proposta_plano_2027_criar` confere `is_admin(auth.uid())`). Como a criação passou, a sessão de admin do dono existia no domínio da prévia e foi usada nessa chamada.
- A função `planos-checkout` iniciou às 14:31:14, um segundo depois. Isso indica que o "iniciar" foi chamado.
- O "iniciar" não gravou nada: sem `chave_sessao_hash`, `etapa_checkout` nula, `teste_admin=false` e `criado_por` vazio. Logo, a marcação de teste não aconteceu, `fn_checkout_2027_liberado` deu falso e `fn_checkout_2027_iniciar` recusou com "Checkout indisponível no momento".
- Essa recusa é tratada como mensagem esperada, por isso a função não registra nada no log.
- Na página (`PlanosPublico2027.tsx`, depois de criar a proposta), qualquer erro do "iniciar" é engolido pelo `catch { }`, e a tela segue para "A equipe FORTEM entra em contato". É essa a condição que pula o checkout.

## O que não dá para confirmar só com o que existe hoje

Não sei por que a marcação de admin falhou. A função não guarda se recebeu token, se `getUser` aceitou o token nem o resultado de `fn_checkout_2027_marcar_teste_admin`. Os registros de requisição da função também não estão disponíveis na consulta.

Causas possíveis, da mais provável para a menos:

1. A chamada `supabase.functions.invoke` saiu sem o token de admin, ou com um token que `admin.auth.getUser` recusou. No meu teste de ontem eu enviei o token direto e funcionou.
2. A chamada de marcação deu erro, que o código ignora sem registrar.

A regra do banco não é a causa: a proposta tinha menos de 30 minutos e `criado_por` estava vazio.

## Resposta à pergunta 3

Pelo plano aprovado:

- **Aluno com código validado** (este caso): o vínculo fica confirmado e a pessoa segue para Revisão e Contrato, desde que a proposta seja de teste (agora, por `teste_admin`).
- **"Siga com os seus dados"** (vínculo não confirmado): a proposta segue como cliente novo, com `aluno_suspeito_id` para a equipe conferir. O checkout continua igual e o cadastro não é ligado.

Os dois caminhos deveriam chegar ao checkout na prévia com admin logado.

## Menor correção proposta (não implementada)

1. **`src/lib/checkoutSite2027.ts`:** no `checkout()`, quando for prévia, pegar a sessão com `supabase.auth.getSession()` e enviar `Authorization: Bearer <token>` explicitamente no `invoke`. Assim não dependemos do token anexado automaticamente.
2. **`planos-checkout`:** no "iniciar" de prévia, registrar só sinais sem dado pessoal:
   - se veio token;
   - se `getUser` aceitou;
   - se é admin (pelo mesmo `is_admin` da criação);
   - se marcou a proposta;
   - o erro da marcação, se houver.

   Nada de token, CPF, e-mail ou telefone no registro.
3. **Página:** na prévia, quando o "iniciar" falhar, mostrar a mensagem neutra do servidor para o admin em vez de cair em silêncio em "equipe entra em contato". O público continua com o fluxo atual.
4. **Validação:** o dono repete o caminho "Aluno + código" na prévia. Conferimos no banco `teste_admin=true`, `etapa_checkout='identificada'`, e o registro mostra token recebido e admin confirmado. Depois, uma chamada sem sessão continua recusada.

Não haverá mudança em dados, catálogo, cron, Rede, Inter nem pix-webhook. A proposta 6e325c45 fica como está.
