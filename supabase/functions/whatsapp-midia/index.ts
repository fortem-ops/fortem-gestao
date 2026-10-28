import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { baixarMidia } from '../_shared/whatsapp-entrada.ts';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Não autenticado' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', u.user.id);
    if (!(roles ?? []).some((r: any) => r.role === 'admin' || r.role === 'coordenador')) return json({ error: 'Sem permissão' }, 403);

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 100) : [];
    if (!ids.length) return json({ urls: {} });

    const { data: rows } = await admin.from('whatsapp_mensagens').select('id, media_id, media_path, media_mime').in('id', ids);
    const urls: Record<string, string> = {};
    for (const r of rows ?? []) {
      let path = r.media_path as string | null;
      if (!path && r.media_id) {
        path = await baixarMidia(admin, r.media_id, r.media_mime);
        if (path) await admin.from('whatsapp_mensagens').update({ media_path: path }).eq('id', r.id);
      }
      if (!path) continue;
      const { data: s } = await admin.storage.from('whatsapp-midia').createSignedUrl(path, 3600);
      if (s?.signedUrl) urls[r.id] = s.signedUrl;
    }
    return json({ urls });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
