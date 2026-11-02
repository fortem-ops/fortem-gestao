// Rotina diária do feed da Comunidade: marca posts expirados (90 dias) como removidos
// e apaga do armazenamento as fotos de posts removidos, antigos ou de quem saiu do feed.
// Só aceita o cron (x-webhook-secret) ou a service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function autorizar(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-webhook-secret");
  if (provided) {
    const { data } = await admin.rpc("get_webhook_secret");
    if (typeof data === "string" && data && provided === data) return true;
  }
  return req.headers.get("Authorization") === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
}

Deno.serve(async (req) => {
  if (!(await autorizar(req))) return new Response("unauthorized", { status: 401 });
  const { data, error } = await admin.rpc("fn_comunidade_feed_expirar");
  if (error) return new Response(JSON.stringify({ ok: false, erro: error.message }), { status: 500 });
  const linhas = (data ?? []) as { post_id: string; foto_path: string }[];
  const apagados: string[] = [];
  for (let i = 0; i < linhas.length; i += 100) {
    const lote = linhas.slice(i, i + 100);
    const { error: e } = await admin.storage.from("comunidade-feed").remove(lote.map((l) => l.foto_path));
    if (!e) apagados.push(...lote.map((l) => l.post_id));
  }
  if (apagados.length) await admin.rpc("fn_comunidade_feed_fotos_apagadas", { p_posts: apagados });
  return new Response(JSON.stringify({ ok: true, fotos_apagadas: apagados.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
