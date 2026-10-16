// Festa 10 anos: curtir/descurtir/comentar fotos (público, sem cadastro).
import { z } from "npm:zod@3";
import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}

const Schema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("curtir"), foto_id: z.string().uuid(), visitante_id: z.string().regex(/^[a-zA-Z0-9-]{16,64}$/), curtir: z.boolean() }),
  z.object({ acao: z.literal("comentar"), foto_id: z.string().uuid(), nome: z.string().trim().min(2).max(60), texto: z.string().trim().min(2).max(300) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: unknown;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalido" }, 400); }
  const p = Schema.safeParse(body);
  if (!p.success) return jsonResponse({ error: "invalido" }, 400);
  const d = p.data;
  const sup = admin();
  const { data: foto } = await sup.from("festa_fotos").select("id").eq("id", d.foto_id).maybeSingle();
  if (!foto) return jsonResponse({ error: "foto" }, 404);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sem-ip";
  const ipHash = await sha256(ip);

  if (d.acao === "curtir") {
    const chave = `curtir:${ipHash}`;
    const desde = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await sup.from("festa_rate_limit").select("chave", { count: "exact", head: true }).eq("chave", chave).gte("criado_em", desde);
    if ((count ?? 0) >= 120) return jsonResponse({ error: "limite" }, 429);
    await sup.from("festa_rate_limit").insert({ chave });
    if (d.curtir) await sup.from("festa_fotos_curtidas").upsert({ foto_id: d.foto_id, visitante_id: d.visitante_id }, { onConflict: "foto_id,visitante_id", ignoreDuplicates: true });
    else await sup.from("festa_fotos_curtidas").delete().eq("foto_id", d.foto_id).eq("visitante_id", d.visitante_id);
    return jsonResponse({ ok: true });
  }

  if (/https?:\/\/|www\.|\.com\b|\.br\b/i.test(d.texto + " " + d.nome)) return jsonResponse({ error: "link" }, 400);
  const chave = `comentar:${ipHash}`;
  const desde = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await sup.from("festa_rate_limit").select("chave", { count: "exact", head: true }).eq("chave", chave).gte("criado_em", desde);
  if ((count ?? 0) >= 5) return jsonResponse({ error: "limite" }, 429);
  const { count: rep } = await sup.from("festa_fotos_comentarios").select("id", { count: "exact", head: true }).eq("foto_id", d.foto_id).eq("ip_hash", ipHash).eq("texto", d.texto);
  if ((rep ?? 0) > 0) return jsonResponse({ error: "repetido" }, 400);
  await sup.from("festa_rate_limit").insert({ chave });
  const { data, error } = await sup.from("festa_fotos_comentarios").insert({ foto_id: d.foto_id, nome: d.nome, texto: d.texto, ip_hash: ipHash }).select("id, nome, texto, created_at").single();
  if (error) return jsonResponse({ error: "falha" }, 500);
  return jsonResponse({ ok: true, comentario: data });
});
