## Problema

**1) Destinatários limitados para professores.** A RLS de `user_roles` só permite SELECT para o próprio usuário ou coordenadores/admins. O `RecipientPicker` carrega todos os profiles e filtra os que têm role; como a Vanessa (professor) só enxerga a própria role, a lista mostra apenas ela mesma. O mesmo acontece em `expandRecipients` ao escolher "Todos os professores" etc — retorna vazio para profissionais sem privilégio.

**2) Colar imagem no chat.** Hoje só há `<input type="file">`. Não há `onPaste`, e anexos de imagem são renderizados como link textual (`📎 Anexo`), exigindo download para visualizar.

## Solução

### Backend (migration)

Duas funções `SECURITY DEFINER` que qualquer profissional autenticado pode chamar:

- `fn_notificar_listar_profissionais()` → retorna `user_id, full_name, specialty, roles[]` de todos os usuários que tenham qualquer role em (`admin`,`coordenador`,`professor`,`nutricionista`,`fisioterapeuta`). Permissão de execução: `authenticated`. Internamente verifica que `auth.uid()` é profissional.
- `fn_notificar_expandir_destinatarios(p_grupos jsonb)` → recebe lista no mesmo formato de `RecipientGroup[]` e devolve `setof uuid` (ids únicos). Resolve `user`, `all_admins`, `all_coordenadores`, `all_professores`, `all_profissionais`, `role`.

Sem alterações em RLS existentes.

### Frontend

`src/components/notificar/RecipientPicker.tsx`
- Trocar as duas queries por `supabase.rpc("fn_notificar_listar_profissionais")`.
- Resultado já vem com `roles`, mantém o filtro/busca atual.

`src/lib/notificar.ts`
- `expandRecipients`: chamar `supabase.rpc("fn_notificar_expandir_destinatarios", { p_grupos: groups })` em vez de queries diretas em `user_roles`.

`src/components/notificar/NotificacaoChatWindow.tsx`
- Adicionar `onPaste` no `Input` de mensagem e no container do chat: percorrer `e.clipboardData.items`, se houver `kind === "file"` com tipo `image/*`, capturar via `getAsFile()`, transformar em `File` (`pasted-<timestamp>.png`) e setar em `setFile`. Toast "Imagem colada — pronta para enviar".
- Pré-visualização: se `file?.type.startsWith("image/")`, mostrar miniatura (`URL.createObjectURL`) acima do input, com botão X (já existe), liberando o objectURL no unmount.
- `ChatBubble`: quando `c.anexo_tipo?.startsWith("image/")` e `url` carregado, renderizar `<img src={url} className="mt-1 max-w-full max-h-48 rounded cursor-zoom-in" />` dentro de `<a target="_blank">` (clique abre tamanho real). Manter o link `📎 nome` apenas para não-imagens.

### Detalhes técnicos

```sql
create or replace function public.fn_notificar_listar_profissionais()
returns table(user_id uuid, full_name text, specialty text, roles text[])
language sql stable security definer set search_path = public as $$
  select p.user_id, p.full_name, p.specialty,
         array_agg(ur.role::text order by ur.role) as roles
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.user_id
  where ur.role in ('admin','coordenador','professor','nutricionista','fisioterapeuta')
    and exists (
      select 1 from public.user_roles me
      where me.user_id = auth.uid()
        and me.role in ('admin','coordenador','professor','nutricionista','fisioterapeuta')
    )
  group by p.user_id, p.full_name, p.specialty
  order by p.full_name;
$$;
grant execute on function public.fn_notificar_listar_profissionais() to authenticated;
```

`fn_notificar_expandir_destinatarios(jsonb)` segue o mesmo padrão, com gate idêntico de "caller é profissional".

Para colar imagem:
```ts
const onPaste = (e: React.ClipboardEvent) => {
  for (const it of Array.from(e.clipboardData.items)) {
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) {
        const ext = it.type.split("/")[1] || "png";
        setFile(new File([f], `pasted-${Date.now()}.${ext}`, { type: it.type }));
        toast.success("Imagem colada");
        e.preventDefault();
        return;
      }
    }
  }
};
```

## Arquivos

- `supabase/migrations/<timestamp>_notificar_recipients_rpc.sql` (novo)
- `src/lib/notificar.ts` (editar `expandRecipients`)
- `src/components/notificar/RecipientPicker.tsx` (trocar fonte de dados)
- `src/components/notificar/NotificacaoChatWindow.tsx` (paste + preview + render inline de imagem)

Nenhuma alteração de RLS, de outras telas, ou de comportamento de upload por arquivo.
