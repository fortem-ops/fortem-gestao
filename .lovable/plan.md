## Por que internet rápida e app que não funciona convivem

Speedtest mede banda até servidores do provedor (geralmente locais). Não diz nada sobre:
- DNS conseguir resolver `dmudgqedzeosfpehpgep.supabase.co`
- Firewall/proxy da rede permitir tráfego HTTPS para esse host
- Inspeção HTTPS (antivírus/empresa) não quebrar o certificado
- Bloqueio por categoria ("cloud storage", "developer tools") em controle parental ou rede corporativa

Ou seja: **438 Mbps de download não significa que o pacote consegue chegar ao backend**. O `Failed to fetch` do navegador acontece antes do app conseguir falar com o servidor.

## Plano

1. **Rodar diagnóstico automaticamente ao abrir o login** (não só após erro)
   - Hoje o `diagnoseNetwork()` só roda quando o usuário tenta logar e falha.
   - Mudar para rodar 1x ao montar a tela de login (`Login.tsx` e `PortalLogin.tsx`), em segundo plano.
   - Se detectar `backend_blocked` ou `backend_slow`, já mostrar o `NetworkHelpPanel` antes do usuário tentar.

2. **Mensagem específica para "internet rápida mas backend bloqueado"**
   - Em `networkDiagnostics.ts`, no caso `backend_blocked`, adicionar texto explicando que velocidade da internet não garante acesso ao servidor e que o bloqueio é de domínio, não de banda.
   - Listar o domínio exato que precisa ser liberado (`dmudgqedzeosfpehpgep.supabase.co`) para o usuário levar ao TI/admin da rede.

3. **Botão "Copiar domínio para liberar"** no `NetworkHelpPanel`
   - Facilita o usuário enviar para quem administra a rede.

4. **Indicador discreto de status da rede** no topo do card de login
   - Verde "Conexão com servidor OK" / vermelho "Servidor inacessível nesta rede".
   - Evita o usuário tentar logar várias vezes achando que a senha está errada.

## Arquivos afetados

- `src/lib/networkDiagnostics.ts` — refinar texto do `backend_blocked`, expor `SUPABASE_HOST`.
- `src/components/NetworkHelpPanel.tsx` — botão de copiar domínio + texto sobre velocidade ≠ acesso.
- `src/pages/Login.tsx` — rodar `diagnoseNetwork()` no `useEffect` inicial.
- `src/pages/portal/PortalLogin.tsx` — idem.

Nenhuma mudança de backend, RLS ou autenticação. Apenas frontend/UX.

## Validação

- Abrir login: diagnóstico roda em background, painel aparece se bloqueado.
- Em rede normal: nada muda visualmente (status OK fica oculto ou discreto).
- Em rede que bloqueia: usuário vê instruções e domínio antes de tentar logar.
