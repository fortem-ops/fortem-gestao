## Diagnóstico

- O backend do Lovable Cloud está saudável.
- Um teste direto fora do navegador alcança o endpoint de autenticação e recebe resposta normal de credenciais inválidas, então não parece ser indisponibilidade do backend nem CORS básico.
- No preview do usuário, as requisições que falham são tentativas automáticas de renovar sessão (`grant_type=refresh_token`) com `Failed to fetch`, repetidas em loop.
- O fluxo atual mantém sessão persistida e `autoRefreshToken` ativo no cliente gerado; isso pode prender o app em uma sessão/refresh token inválido ou em falhas transitórias de renovação antes do usuário conseguir fazer login novamente.

## Plano de correção

1. **Endurecer a inicialização de auth**
   - Ajustar `AuthContext` para detectar falhas de sessão/refresh no carregamento inicial.
   - Se houver erro de refresh/token ou falha de rede durante `getSession`, limpar a sessão local de forma segura e liberar a tela de login, em vez de manter tentativas repetidas.
   - Manter a lógica de readiness para não causar redirecionamentos prematuros.

2. **Corrigir comportamento após login**
   - No login principal e no portal, evitar navegação manual imediata antes do estado de auth atualizar.
   - Centralizar o redirecionamento no estado real do contexto, como já ocorre parcialmente no login principal.
   - Garantir que, em erro de login, o botão volte ao estado normal e mostre mensagem clara.

3. **Adicionar ação de recuperação para sessão travada**
   - Na tela de login, quando houver erro de conexão/refresh, oferecer uma opção discreta para “limpar sessão e tentar novamente”.
   - Essa ação chamará o logout/limpeza local e recarregará o fluxo de autenticação sem depender de janela anônima ou troca de navegador.

4. **Validar sem mexer no cliente gerado**
   - Não editar `src/integrations/supabase/client.ts`, pois é arquivo gerado.
   - Validar com logs/rede após a implementação: a página de login deve parar de disparar refresh token em loop e permitir nova tentativa de login.

## Arquivos previstos

- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/pages/portal/PortalLogin.tsx`