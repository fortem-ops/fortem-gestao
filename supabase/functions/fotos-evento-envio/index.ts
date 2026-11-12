// Fotos de eventos — envio de fotos por convidados (até 30), com moderação assistida (só sinaliza).
import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";
import { BUCKET, ipHash } from "../_shared/fotos-evento-srv.ts";
import { rekognition, base64 } from "../_shared/rekognition.ts";
import { avaliarTurnstile } from "../_shared/planos-turnstile.ts";
import {
  alertaModeracao, arquivoValido, normalizarWhatsapp, orientacao, LIMITE_ENVIOS_HORA, MAX_BYTES_ARQUIVO,
  MAX_BYTES_REKOGNITION, MAX_FOTOS_ENVIO, MIN_CONFIANCA_MODERACAO, TIPOS_ACEITOS, type RotuloModeracao,
} from "../_shared/fotos-evento.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const sb = admin();
    const slug = typeof body?.slug === "string" ? body.slug : "";
    const { data: ev } = await sb.from("eventos_fotos").select("id, ativo").eq("slug", slug).maybeSingle();
    if (!ev?.ativo) return jsonResponse({ error: "evento_nao_encontrado" }, 404);

    if (body.acao === "iniciar") {
      const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 120) : "";
      const whatsapp = normalizarWhatsapp(body.whatsapp);
      if (nome.length < 2 || !whatsapp) return jsonResponse({ error: "dados_invalidos" }, 400);
      if (body.aceite_publicacao !== true) return jsonResponse({ error: "aceite_obrigatorio" }, 400);
      const arquivos = Array.isArray(body.arquivos) ? body.arquivos : [];
      if (!arquivos.length || arquivos.length > MAX_FOTOS_ENVIO) return jsonResponse({ error: "quantidade_invalida", max: MAX_FOTOS_ENVIO }, 400);
      for (const a of arquivos) {
        if (!arquivoValido({ tipo: a?.tipo, tamanho: a?.tamanho }) || a.tipo === "image/heic" || a.tipo === "image/heif" || !(Number(a?.largura) > 0 && Number(a?.altura) > 0)) {
          return jsonResponse({ error: "arquivo_invalido", nome: a?.nome ?? null }, 400);
        }
      }
      const { data: cfg } = await sb.from("sistema_config").select("valor").eq("chave", "planos_turnstile_ativo").maybeSingle();
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
      if (await avaliarTurnstile(cfg?.valor, Deno.env.get("TURNSTILE_SECRET_KEY"), body.turnstile, ip) === "recusado") return jsonResponse({ error: "verificacao_necessaria" }, 403);
      const { data: liberado } = await sb.rpc("fn_fotos_rate_limit", { p_ip_hash: await ipHash(req), p_acao: "envio", p_limite: LIMITE_ENVIOS_HORA });
      if (liberado !== true) return jsonResponse({ error: "limite_envios" }, 429);
      const { data: leadId, error: le } = await sb.rpc("fn_fotos_lead_registrar", { p_evento: ev.id, p_nome: nome, p_whatsapp: whatsapp, p_email: "", p_biometria: false, p_publicacao: true });
      if (le || !leadId) throw new Error("lead");
      const envioId = crypto.randomUUID();
      const saida = [];
      for (const a of arquivos) {
        const id = crypto.randomUUID();
        const original = `${ev.id}/convidados/original/${envioId}/${id}.${a.tipo === "image/png" ? "png" : "jpg"}`;
        const previa = `${ev.id}/convidados/preview/${envioId}/${id}.jpg`;
        const [u1, u2] = await Promise.all([sb.storage.from(BUCKET).createSignedUploadUrl(original), sb.storage.from(BUCKET).createSignedUploadUrl(previa)]);
        if (u1.error || u2.error) throw new Error("url");
        const largura = Number(a.largura), altura = Number(a.altura);
        const { error } = await sb.from("fotos_evento").insert({
          id, evento_id: ev.id, storage_path: original, storage_path_preview: previa, largura, altura, orientacao: orientacao(largura, altura),
          origem: "convidado", enviado_por: leadId, envio_id: envioId, status_moderacao: "pendente", status_indexacao: "pendente",
        });
        if (error) throw new Error("registro");
        saida.push({ foto_id: id, original: { path: original, token: u1.data.token }, previa: { path: previa, token: u2.data.token } });
      }
      return jsonResponse({ envio_id: envioId, arquivos: saida });
    }

    if (body.acao === "concluir") {
      if (typeof body.envio_id !== "string" || !UUID.test(body.envio_id)) return jsonResponse({ error: "envio_invalido" }, 400);
      const { data: fotos } = await sb.from("fotos_evento").select("id, storage_path, storage_path_preview, enviado_por, upload_concluido")
        .eq("envio_id", body.envio_id).eq("evento_id", ev.id).eq("upload_concluido", false);
      let recebidas = 0; let leadId: string | null = null;
      for (const f of fotos ?? []) {
        leadId = f.enviado_por;
        const pasta = f.storage_path.split("/").slice(0, -1).join("/"); const nomeArq = f.storage_path.split("/").pop()!;
        const { data: lista } = await sb.storage.from(BUCKET).list(pasta, { search: nomeArq, limit: 1 });
        const obj = lista?.find((o) => o.name === nomeArq);
        const meta = (obj?.metadata ?? {}) as { size?: number; mimetype?: string };
        const tipoOk = typeof meta.mimetype === "string" && (TIPOS_ACEITOS as readonly string[]).includes(meta.mimetype);
        const { data: prev } = f.storage_path_preview ? await sb.storage.from(BUCKET).download(f.storage_path_preview) : { data: null };
        const bytes = prev ? new Uint8Array(await prev.arrayBuffer()) : null;
        const jpeg = !!bytes && bytes[0] === 0xff && bytes[1] === 0xd8;
        if (!obj || !tipoOk || !(Number(meta.size) > 0 && Number(meta.size) <= MAX_BYTES_ARQUIVO) || !bytes || !jpeg || bytes.length > MAX_BYTES_REKOGNITION) {
          await sb.storage.from(BUCKET).remove([f.storage_path, f.storage_path_preview].filter((x): x is string => !!x));
          await sb.from("fotos_evento").delete().eq("id", f.id);
          continue;
        }
        let alerta = { alerta: false, rotulos: [] as { nome: string; pai: string; confianca: number }[] };
        try {
          const r = await rekognition<{ ModerationLabels?: RotuloModeracao[] }>("DetectModerationLabels", { Image: { Bytes: base64(bytes) }, MinConfidence: MIN_CONFIANCA_MODERACAO });
          alerta = alertaModeracao(r.ModerationLabels);
        } catch { alerta = { alerta: true, rotulos: [{ nome: "Verificação automática indisponível", pai: "", confianca: 0 }] }; }
        await sb.from("fotos_evento").update({ upload_concluido: true, alerta_moderacao: alerta.alerta, rotulos_moderacao: alerta.rotulos }).eq("id", f.id);
        recebidas++;
      }
      if (leadId && recebidas) await sb.rpc("fn_fotos_lead_contar", { p_lead: leadId, p_buscas: 0, p_encontradas: 0, p_enviadas: recebidas });
      return jsonResponse({ recebidas });
    }

    return jsonResponse({ error: "acao_invalida" }, 400);
  } catch (e) {
    console.error("fotos-evento-envio", e instanceof Error ? e.message : "erro");
    return jsonResponse({ error: "erro_interno" }, 500);
  }
});
