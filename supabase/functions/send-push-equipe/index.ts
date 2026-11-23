// Push da equipe. Só servidor/cron (chave de serviço ou segredo das rotinas) envia gatilhos;
// staff autenticado só pode mandar o teste para si mesmo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { avaliarChamador } from "../_shared/chamador-push-srv.ts";
import { configurarVapid, webpush } from "../_shared/vapid.ts";
import {
  GATILHOS_EQUIPE, PAPEIS_EQUIPE, filtrarDestinatarios, inscricaoInvalida, momentoDeEnvio, validarMensagem,
  type Candidato,
} from "../_shared/push-equipe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const sup = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const Enviar = z.object({
  acao: z.literal("enviar"),
  gatilho: z.string().min(1).max(80),
  referencia: z.string().min(1).max(200),
  titulo: z.string().min(1).max(120),
  corpo: z.string().max(400).default(""),
  url: z.string().startsWith("/").max(300).default("/"),
  user_ids: z.array(z.string().uuid()).max(500).optional(),
  papel: z.enum(PAPEIS_EQUIPE).optional(),
}).refine((v) => !!v.user_ids?.length || !!v.papel, { message: "user_ids ou papel" });
const Corpo = z.union([Enviar, z.object({ acao: z.literal("teste") }), z.object({ acao: z.literal("enviar_pendentes") })]);

interface LinhaLog { id: string; user_id: string; gatilho: string; titulo: string; corpo: string; url: string | null }

async function candidatos(ids?: string[], papel?: string): Promise<Candidato[]> {
  let q = sup.from("user_roles").select("user_id, role");
  if (ids?.length) q = q.in("user_id", ids);
  else if (papel) q = q.eq("role", papel);
  const { data: roles } = await q;
  const porUser = new Map<string, string[]>();
  for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
    porUser.set(r.user_id, [...(porUser.get(r.user_id) ?? []), r.role]);
  }
  if (papel && !ids?.length) {
    const { data: todos } = await sup.from("user_roles").select("user_id, role").in("user_id", [...porUser.keys()]);
    porUser.clear();
    for (const r of (todos ?? []) as { user_id: string; role: string }[]) {
      porUser.set(r.user_id, [...(porUser.get(r.user_id) ?? []), r.role]);
    }
  }
  if (porUser.size === 0) return [];
  const { data: perfis } = await sup.from("profiles").select("user_id, ativo").in("user_id", [...porUser.keys()]);
  const ativo = new Map(((perfis ?? []) as { user_id: string; ativo: boolean | null }[]).map((p) => [p.user_id, p.ativo === true]));
  return [...porUser].map(([user_id, papeis]) => ({ user_id, papeis, ativo: ativo.get(user_id) ?? false }));
}

async function entregar(l: LinhaLog): Promise<void> {
  await sup.from("equipe_push_log").update({ status: "enviando" }).eq("id", l.id);
  const { data: subs } = await sup.from("equipe_push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", l.user_id);
  if (!subs?.length) {
    await sup.from("equipe_push_log").update({ status: "sem_inscricao", enviado_em: new Date().toISOString() }).eq("id", l.id);
    return;
  }
  const payload = JSON.stringify({
    app: "equipe", title: l.titulo, body: l.corpo, url: l.url ?? "/", gatilho: l.gatilho,
    icon: "/icon-equipe-192.png", timestamp: Date.now(),
  });
  let enviados = 0;
  const erros: string[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
      enviados++;
      await sup.from("equipe_push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const err = e as { statusCode?: number; body?: string; message?: string };
      erros.push(`${err.statusCode ?? "?"}: ${err.body ?? err.message ?? "erro"}`);
      if (inscricaoInvalida(err.statusCode)) await sup.from("equipe_push_subscriptions").delete().eq("id", s.id);
    }
  }
  await sup.from("equipe_push_log").update({
    status: enviados > 0 ? "enviado" : "falha", sucesso: enviados > 0,
    erro: erros.length ? erros.join("; ").slice(0, 1000) : null, enviado_em: new Date().toISOString(),
  }).eq("id", l.id);
}

/** Reserva no log (deduplicação pelo índice único) e entrega agora ou deixa pendente. */
async function registrar(p: z.infer<typeof Enviar>, destinos: string[]) {
  const quando = momentoDeEnvio(new Date(), GATILHOS_EQUIPE[p.gatilho].urgente);
  const agora = quando.getTime() <= Date.now();
  const linhas = destinos.map((user_id) => ({
    user_id, gatilho: p.gatilho, referencia: p.referencia, titulo: p.titulo, corpo: p.corpo, url: p.url,
    status: "pendente", enviar_apos: quando.toISOString(),
  }));
  const { data, error } = await sup.from("equipe_push_log")
    .upsert(linhas, { onConflict: "gatilho,referencia,user_id", ignoreDuplicates: true })
    .select("id, user_id, gatilho, titulo, corpo, url");
  if (error) throw new Error(error.message);
  const novas = (data ?? []) as LinhaLog[];
  if (agora) for (const l of novas) await entregar(l);
  return { novos: novas.length, duplicados: destinos.length - novas.length, pendente: !agora };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const { acesso, userId } = await avaliarChamador(req, sup);
  if (acesso === "negado") return json({ error: "Unauthorized" }, 401);

  let bruto: unknown;
  try { bruto = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const parsed = Corpo.safeParse(bruto);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const p = parsed.data;

  const vapidErro = await configurarVapid();
  if (vapidErro) return json({ error: vapidErro }, 500);

  try {
    if (p.acao === "teste") {
      if (!userId) return json({ error: "teste exige usuário" }, 400);
      const r = await registrar({
        acao: "enviar", gatilho: "teste", referencia: `teste:${Date.now()}`,
        titulo: "Teste de notificação", corpo: "As notificações da equipe estão funcionando neste aparelho.", url: "/",
        user_ids: [userId],
      }, [userId]);
      return json({ ok: true, ...r });
    }
    if (acesso !== "servidor") return json({ error: "Forbidden" }, 403);

    if (p.acao === "enviar_pendentes") {
      const { data } = await sup.from("equipe_push_log").select("id, user_id, gatilho, titulo, corpo, url")
        .eq("status", "pendente").lte("enviar_apos", new Date().toISOString()).limit(500);
      const ids = ((data ?? []) as LinhaLog[]).map((l) => l.user_id);
      const validos = new Set(filtrarDestinatarios(await candidatos([...new Set(ids)])));
      let enviados = 0;
      for (const l of (data ?? []) as LinhaLog[]) {
        if (!validos.has(l.user_id)) {
          await sup.from("equipe_push_log").update({ status: "falha", erro: "funcionario_inativo" }).eq("id", l.id);
          continue;
        }
        await entregar(l); enviados++;
      }
      return json({ ok: true, enviados });
    }

    const motivo = validarMensagem(p.gatilho, p.titulo, p.corpo);
    if (motivo) return json({ error: motivo }, 400);
    const destinos = filtrarDestinatarios(await candidatos(p.user_ids, p.papel), p.papel);
    if (!destinos.length) return json({ ok: true, novos: 0, duplicados: 0, pendente: false });
    return json({ ok: true, ...(await registrar(p, destinos)) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
