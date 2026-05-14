## Diagnóstico resumido

- O backend hospedado está saudável e respondeu normalmente.
- Os logs recentes de autenticação mostram login bem-sucedido no servidor, então o problema provavelmente não é senha, usuário ou indisponibilidade global.
- Como o erro aparece em redes Wi‑Fi diferentes, a hipótese mais forte é uma falha de conectividade entre navegador e endpoint de autenticação/dados em algumas redes: DNS, firewall, proxy corporativo/roteador, inspeção HTTPS, bloqueio de domínios ou bloqueio de WebSocket/realtime.
- O app hoje só mostra uma mensagem genérica de “Falha de conexão” e sugere extensão/anônimo, o que não ajuda quando a causa é rede Wi‑Fi.

## Plano de correção

1. **Adicionar diagnóstico real de conectividade no frontend**
   - Criar um pequeno utilitário de saúde de rede que testa, com timeout curto:
     - acesso ao próprio app;
     - acesso ao endpoint de autenticação do backend;
     - acesso ao endpoint REST do backend.
   - Classificar o erro como: app indisponível, backend bloqueado, timeout, offline, ou erro desconhecido.

2. **Integrar o diagnóstico ao login**
   - Antes/depois de falhas de `Failed to fetch`, rodar o diagnóstico automaticamente.
   - Mostrar uma mensagem específica quando a rede Wi‑Fi bloqueia o backend, em vez de “email ou senha incorretos”.
   - Manter a tentativa de login normal quando a rede está OK.

3. **Evitar travamento e melhorar recuperação**
   - Garantir timeout controlado nas verificações para a tela não ficar presa em “Entrando...”.
   - Centralizar o tratamento de erro de autenticação para `Login` e `PortalLogin`, evitando divergência entre os dois fluxos.

4. **Adicionar painel discreto de ajuda na tela de login quando houver bloqueio de rede**
   - Exibir instruções objetivas para o usuário testar/liberar no Wi‑Fi:
     - trocar DNS da rede/dispositivo;
     - desativar proxy/VPN/firewall com inspeção HTTPS;
     - liberar domínios do app e do backend;
     - testar no mesmo navegador via 4G/5G para confirmar.
   - Incluir botão “Testar conexão novamente”.

5. **Validação**
   - Testar no preview se a tela de login carrega sem erros.
   - Conferir console e network após a mudança.
   - Confirmar que a mensagem exibida diferencia erro de credenciais de erro de rede.

## Arquivos previstos

- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/pages/portal/PortalLogin.tsx`
- Novo utilitário em `src/lib/` para diagnóstico e mensagens de rede