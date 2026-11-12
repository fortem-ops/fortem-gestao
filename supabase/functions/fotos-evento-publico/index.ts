// Fotos de eventos — página pública: dados do evento, busca por selfie e galeria.
// A selfie fica só na memória desta requisição: nunca vai para storage, banco ou log.
import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";
import { BUCKET, ipHash } from "../_shared/fotos-evento-srv.ts";
import { rekognition, ErroAws, base64 } from "../_shared/rekognition.ts";
import { avaliarTurnstile } from "../_shared/planos-turnstile.ts";
import {
  colecaoValida, decodificarSelfie, fotosDosMatches, normalizarWhatsapp, LIMIAR_BUSCA, MAX_ROSTOS_BUSCA,
  LIMITE_BUSCAS_HORA, type FaceMatch,
} from "../_shared/fotos-evento.ts";

type Sb = ReturnType<typeof admin>;
const POR_PAGINA = 30;

async function eventoPublico(sb: Sb, slug: unknown) {
  if (typeof slug !== "string" || !/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const { data } = await sb.from("eventos_fotos").select("id, slug, nome, data, texto_assinatura, local, collection_id, colecao_criada_em, ativo").eq("slug", slug).maybeSingle();
  return data && data.ativo ? data : null;
}

type FotoRow = { id: string; storage_path: string; storage_path_preview: string | null; largura: number | null; altura: number | null; orientacao: string | null };
async function comUrls(sb: Sb, fotos: FotoRow[]) {
  const caminhos = fotos.flatMap((f) => [f.storage_path, f.storage_path_preview ?? f.storage_path]);
  const { data } = caminhos.length ? await sb.storage.from(BUCKET).createSignedUrls(caminhos, 600) : { data: [] };
  const mapa = new Map((data ?? []).map((s) => [s.path, s.signedUrl]));
  return fotos.map((f) => ({
    id: f.id, largura: f.largura, altura: f.altura, orientacao: f.orientacao,
    url_previa: mapa.get(f.storage_path_preview ?? f.storage_path) ?? null, url_original: mapa.get(f.storage_path) ?? null,
  }));
}
const filtroPublico = <T extends { eq: (c: string, v: unknown) => T; in: (c: string, v: unknown[]) => T }>(q: T) =>
  q.eq("upload_concluido", true).eq("status_moderacao", "aprovada").in("status_indexacao", ["indexada", "sem_rosto"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = admin();
    const ev = await eventoPublico(sb, body?.slug);
    if (!ev) return jsonResponse({ error: "evento_nao_encontrado" }, 404);

    if (body.acao === "evento") {
      return jsonResponse({ evento: { slug: ev.slug, nome: ev.nome, data: ev.data, texto_assinatura: ev.texto_assinatura, local: ev.local } });
    }

    if (body.acao === "galeria") {
      const pagina = Math.max(0, Math.min(10000, Number(body.pagina) || 0));
      const { data, count } = await filtroPublico(sb.from("fotos_evento").select("id, storage_path, storage_path_preview, largura, altura, orientacao", { count: "exact" }).eq("evento_id", ev.id))
        .order("criado_em").range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      return jsonResponse({ fotos: await comUrls(sb, (data ?? []) as FotoRow[]), total: count ?? 0, pagina, por_pagina: POR_PAGINA });
    }

    if (body.acao === "buscar") {
      const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 120) : "";
      const whatsapp = normalizarWhatsapp(body.whatsapp);
      const email = typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email.trim()) ? body.email.trim().slice(0, 200) : "";
      if (nome.length < 2 || !whatsapp) return jsonResponse({ error: "dados_invalidos" }, 400);
      if (body.aceite_biometria !== true) return jsonResponse({ error: "aceite_obrigatorio" }, 400);
      const selfie = decodificarSelfie(body.selfie);
      if (!selfie) return jsonResponse({ error: "selfie_invalida" }, 400);
      const { data: cfg } = await sb.from("sistema_config").select("valor").eq("chave", "fotos_eventos_turnstile").maybeSingle();
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      if (await avaliarTurnstile(cfg?.valor, Deno.env.get("TURNSTILE_SECRET_KEY"), body.turnstile, ip) === "recusado") return jsonResponse({ error: "verificacao_necessaria" }, 403);
      const { data: liberado } = await sb.rpc("fn_fotos_rate_limit", { p_ip_hash: await ipHash(req), p_acao: "busca", p_limite: LIMITE_BUSCAS_HORA });
      if (liberado !== true) return jsonResponse({ error: "limite_buscas" }, 429);
      const { data: leadId } = await sb.rpc("fn_fotos_lead_registrar", { p_evento: ev.id, p_nome: nome, p_whatsapp: whatsapp, p_email: email, p_biometria: true, p_publicacao: false });

      let ids: string[] = [];
      if (ev.colecao_criada_em && colecaoValida(ev.collection_id)) {
        try {
          const r = await rekognition<{ FaceMatches?: FaceMatch[] }>("SearchFacesByImage", {
            CollectionId: ev.collection_id, Image: { Bytes: base64(selfie) }, FaceMatchThreshold: LIMIAR_BUSCA, MaxFaces: MAX_ROSTOS_BUSCA, QualityFilter: "AUTO",
          });
          ids = fotosDosMatches(r.FaceMatches);
        } catch (e) {
          if (e instanceof ErroAws && e.tipo === "InvalidParameterException") {
            selfie.fill(0);
            return jsonResponse({ error: "rosto_nao_detectado" }, 422);
          }
          throw e;
        }
      }
      selfie.fill(0);
      let fotos: FotoRow[] = [];
      if (ids.length) {
        const { data } = await filtroPublico(sb.from("fotos_evento").select("id, storage_path, storage_path_preview, largura, altura, orientacao").eq("evento_id", ev.id).in("id", ids));
        const ordem = new Map(ids.map((id, i) => [id, i]));
        fotos = ((data ?? []) as FotoRow[]).sort((a, b) => (ordem.get(a.id)! - ordem.get(b.id)!));
      }
      await sb.from("fotos_buscas_log").insert({ evento_id: ev.id, lead_id: leadId ?? null, qtd_encontradas: fotos.length });
      if (leadId) await sb.rpc("fn_fotos_lead_contar", { p_lead: leadId, p_buscas: 1, p_encontradas: fotos.length, p_enviadas: 0 });
      return jsonResponse({ fotos: await comUrls(sb, fotos), total: fotos.length });
    }

    return jsonResponse({ error: "acao_invalida" }, 400);
  } catch (e) {
    console.error("fotos-evento-publico", e instanceof ErroAws ? e.tipo : "erro_interno");
    return jsonResponse({ error: "erro_interno" }, 500);
  }
});
