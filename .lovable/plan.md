## Diagnóstico objetivo

- Testei a URL publicada `https://fortem-gestao.lovable.app` diretamente.
- A recuperação de senha para `nicolas.janovik@gmail.com` retornou sucesso no backend: `POST /auth/v1/recover` com status `200`.
- O login com `nicolas.janovik@gmail.com` + `Fortem@2026` também retornou sucesso: `POST /auth/v1/token` com status `200`, e a aplicação redirecionou para `/`.
- O backend está saudável.
- As contas de staff citadas existem, estão com e-mail confirmado, têm roles de funcionário e foram atualizadas com a senha temporária.
- A conta `fortemtreinamento@gmail.com` está corretamente marcada como `aluno`, não como funcionário.

## Problema provável

O erro “Failed to fetch” visto na tela publicada provavelmente não vem da API de autenticação em si, porque a chamada real de recuperação está respondendo `200`. O que precisa ser corrigido agora é:

1. A interface não deve exibir erro genérico quando a recuperação foi aceita pelo backend.
2. O fluxo de login deve tratar melhor o pós-login, evitando a sensação de falha caso o redirecionamento/checagem de permissões demore ou falhe parcialmente.
3. O app precisa limpar estados antigos de autenticação/cache local que podem manter o usuário preso em uma sessão inválida.
4. As mensagens precisam diferenciar erro real de credencial, erro de rede/local do navegador e erro de permissão.

## Plano de correção

### 1. Fortalecer o AuthContext

- Adicionar uma função `restoreSession()` explícita para revalidar a sessão inicial.
- Adicionar fallback seguro caso `getSession()` ou o evento inicial de auth não conclua.
- Garantir que `loading` sempre finalize, mesmo em erro.
- Normalizar o e-mail antes do login (`trim().toLowerCase()`).
- Em erro de login, limpar apenas estados inválidos de auth para evitar loop.

### 2. Corrigir o login de funcionários

- Ajustar `Login.tsx` para:
  - limpar espaços do e-mail;
  - mostrar mensagem específica quando o login foi aceito mas o perfil/role falha;
  - redirecionar imediatamente após sucesso com uma checagem robusta de role;
  - destravar o botão se a checagem demorar ou falhar;
  - evitar depender apenas do `useEffect` para o redirecionamento.

### 3. Corrigir recuperação de senha

- Ajustar `RecoverPassword.tsx` e `PortalRecoverPassword.tsx` para:
  - tratar `Failed to fetch` como instabilidade local/rede e orientar tentativa em janela anônima ou recarregamento;
  - não manter toast de erro quando o backend aceitou o pedido;
  - mostrar estado de sucesso sempre que a API retornar sem erro;
  - bloquear reenvios repetidos enquanto a chamada está em andamento.

### 4. Corrigir redefinição de senha

- Ajustar `ResetPassword.tsx` e `PortalResetPassword.tsx` para:
  - reconhecer token de recuperação em `hash` e `query string`;
  - exibir erro claro se o link expirou ou foi aberto sem token;
  - redirecionar para o destino correto após redefinir, de acordo com staff ou portal.

### 5. Validar rotas e permissões

- Manter `/login` para funcionários e `/portal/login` para alunos.
- Garantir que `fortemtreinamento@gmail.com` continue indo para `/portal`.
- Garantir que staff sem role nunca fique preso em loading infinito: redirecionar para `/portal` com feedback.

### 6. Validação pós-correção

- Testar na URL publicada/preview:
  - login com `nicolas.janovik@gmail.com` + `Fortem@2026`;
  - recuperação de senha em `/recuperar-senha`;
  - redirecionamento de funcionário para `/`;
  - redirecionamento de aluno para `/portal`;
  - ausência de toast falso “Failed to fetch” após resposta `200`.

## Observação importante

A senha temporária já foi aplicada no banco para as contas listadas. Se algum usuário ainda vê erro, a causa mais provável é cache/sessão antiga do navegador ou uma versão publicada anterior ainda aberta. Mesmo assim, vou tornar o fluxo mais resiliente para não depender dessa condição.