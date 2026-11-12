// Fotos de eventos — ações da equipe: coleção, upload, indexação, moderação, leads e original.
// Gerir (admin/coordenador): coleção, upload, indexação, CSV, original. Moderar (+ professor): aprovar/rejeitar.
import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";
import { BUCKET, papelEquipe } from "../_shared/fotos-evento-srv.ts";
import { rekognition, ErroAws, base64 } from "../_shared/rekognition.ts";
import {
  arquivoValido, colecaoValida, orientacao, LOTE_INDEXACAO, type FaceRecord,
} from "../_shared/fotos-evento.ts";
import { indexarFila, indexarFoto as indexarFotoComDeps, type DepsIndexacao } from "../_shared/fotos-evento-indexacao.ts";

const MAX_INDEXAR_NA_HORA = 60;

type Sb = ReturnType<typeof admin>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
const ext = (tipo: string) => (tipo === "image/png" ? "png" : "jpg");

async function evento(sb: Sb, id: unknown) {
  if (!ehUuid(id)) return null;
  const { data } = await sb.from("eventos_fotos").select("*").eq("id", id).maybeSingle();
  return data;
}

async function garantirColecao(sb: Sb, ev: { id: string; collection_id: string; colecao_criada_em: string | null }) {
  if (!colecaoValida(ev.collection_id)) throw new Error("colecao_invalida");
  if (ev.colecao_criada_em) return;
  try { await rekognition("CreateCollection", { CollectionId: ev.collection_id }); }
  catch (e) { if (!(e instanceof ErroAws && e.tipo === "ResourceAlreadyExistsException")) throw e; }
  await sb.from("eventos_fotos").update({ colecao_criada_em: new Date().toISOString() }).eq("id", ev.id);
}

async function apagarRostos(sb: Sb, colecao: string, fotoId: string) {
  const { data } = await sb.from("rostos_foto").select("face_id_rekognition").eq("foto_id", fotoId);
  const ids = (data ?? []).map((r) => r.face_id_rekognition);
  for (let i = 0; i < ids.length; i += 1000) {
    await rekognition("DeleteFaces", { CollectionId: colecao, FaceIds: ids.slice(i, i + 1000) });
  }
  await sb.from("rostos_foto").delete().eq("foto_id", fotoId);
}

function deps(sb: Sb): DepsIndexacao {
  return {
    baixar: async (caminho) => {
      const { data: blob, error } = await sb.storage.from(BUCKET).download(caminho);
      if (error || !blob) throw new Error("arquivo_nao_encontrado");
      return new Uint8Array(await blob.arrayBuffer());
    },
    indexFaces: (colecao, bytes, fotoId) => rekognition<{ FaceRecords?: FaceRecord[] }>("IndexFaces", {
      CollectionId: colecao, Image: { Bytes: base64(bytes) }, ExternalImageId: fotoId,
      MaxFaces: 100, QualityFilter: "AUTO", DetectionAttributes: [],
    }),
    apagarRostos: (colecao, fotoId) => apagarRostos(sb, colecao, fotoId),
    inserirRostos: async (fotoId, faceIds) => {
      const { error } = await sb.from("rostos_foto").insert(faceIds.map((face_id_rekognition) => ({ foto_id: fotoId, face_id_rekognition })));
      if (error) throw new Error(`falha_gravar_rostos: ${error.message}`);
    },
    atualizarFoto: async (fotoId, patch) => { await sb.from("fotos_evento").update(patch).eq("id", fotoId); },
    pendentes: async (eventoId, limite, ids) => {
      let q = sb.from("fotos_evento").select("id, storage_path, storage_path_preview")
        .eq("evento_id", eventoId).eq("upload_concluido", true).eq("status_moderacao", "aprovada").eq("status_indexacao", "pendente");
      if (ids) q = q.in("id", ids);
      const { data } = await q.order("criado_em").limit(limite);
      return data ?? [];
    },
  };
}

/** Indexa na hora as fotos recém-aprovadas/enviadas; o que sobrar fica pendente e o painel mostra. */
async function indexarAgora(sb: Sb, eventoId: string, ids: string[]) {
  if (!ids.length) return null;
  const ev = await evento(sb, eventoId);
  if (!ev) return null;
  try {
    await garantirColecao(sb, ev);
    return await indexarFila(deps(sb), ev, { ids, maximo: MAX_INDEXAR_NA_HORA, lote: LOTE_INDEXACAO });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "erro";
    await sb.from("fotos_evento").update({ status_indexacao: "erro", erro_indexacao: msg }).in("id", ids).eq("status_indexacao", "pendente");
    return { processadas: 0, resultado: { indexada: 0, sem_rosto: 0, erro: ids.length } };
  }
}

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const papel = await papelEquipe(req);
    if (!papel) return jsonResponse({ error: "nao_autenticado" }, 401);
    const body = await req.json().catch(() => ({}));
    const acao = body?.acao;
    const sb = admin();
    const precisaGerir = acao !== "moderar" && acao !== "previas";
    if (precisaGerir ? !papel.gerir : !papel.moderar) return jsonResponse({ error: "sem_permissao" }, 403);

    if (acao === "criar_colecao") {
      const ev = await evento(sb, body.evento_id);
      if (!ev) return jsonResponse({ error: "evento_nao_encontrado" }, 404);
      await garantirColecao(sb, ev);
      return jsonResponse({ ok: true, collection_id: ev.collection_id });
    }

    if (acao === "upload_urls") {
      const ev = await evento(sb, body.evento_id);
      if (!ev) return jsonResponse({ error: "evento_nao_encontrado" }, 404);
      const arquivos = Array.isArray(body.arquivos) ? body.arquivos.slice(0, 50) : [];
      const saida = [];
      for (const a of arquivos) {
        const largura = Number(a?.largura), altura = Number(a?.altura);
        if (!arquivoValido({ tipo: a?.tipo, tamanho: a?.tamanho }) || !(largura > 0 && altura > 0) || a?.tipo === "image/heic" || a?.tipo === "image/heif") {
          saida.push({ nome: a?.nome ?? null, error: "arquivo_invalido" }); continue;
        }
        const id = crypto.randomUUID();
        const original = `${ev.id}/fotografo/original/${id}.${ext(a.tipo)}`;
        const previa = `${ev.id}/fotografo/preview/${id}.jpg`;
        const [u1, u2] = await Promise.all([
          sb.storage.from(BUCKET).createSignedUploadUrl(original), sb.storage.from(BUCKET).createSignedUploadUrl(previa),
        ]);
        if (u1.error || u2.error) { saida.push({ nome: a?.nome ?? null, error: "falha_url" }); continue; }
        const { error } = await sb.from("fotos_evento").insert({
          id, evento_id: ev.id, storage_path: original, storage_path_preview: previa, largura, altura,
          orientacao: orientacao(largura, altura), origem: "fotografo", status_moderacao: "aprovada",
          moderado_por: papel.userId, moderado_em: new Date().toISOString(),
        });
        if (error) { saida.push({ nome: a?.nome ?? null, error: "falha_registro" }); continue; }
        saida.push({ nome: a?.nome ?? null, foto_id: id, original: { path: original, token: u1.data.token }, previa: { path: previa, token: u2.data.token } });
      }
      return jsonResponse({ arquivos: saida });
    }

    if (acao === "concluir_upload") {
      const ids = (Array.isArray(body.foto_ids) ? body.foto_ids : []).filter(ehUuid).slice(0, 50);
      const { data: fotos } = await sb.from("fotos_evento").select("id, storage_path, storage_path_preview").in("id", ids).eq("origem", "fotografo");
      const ok: string[] = [];
      for (const f of fotos ?? []) {
        const pasta = f.storage_path.split("/").slice(0, -1).join("/");
        const nome = f.storage_path.split("/").pop()!;
        const { data: lista } = await sb.storage.from(BUCKET).list(pasta, { search: nome, limit: 1 });
        if (lista?.some((o) => o.name === nome)) { await sb.from("fotos_evento").update({ upload_concluido: true }).eq("id", f.id); ok.push(f.id); }
      }
      const evId = fotos?.[0] ? (await sb.from("fotos_evento").select("evento_id").eq("id", fotos[0].id).maybeSingle()).data?.evento_id : null;
      const indexacao = evId ? await indexarAgora(sb, evId, ok) : null;
      return jsonResponse({ concluidas: ok, indexacao });
    }

    if (acao === "indexar" || acao === "reprocessar_erros") {
      const ev = await evento(sb, body.evento_id);
      if (!ev) return jsonResponse({ error: "evento_nao_encontrado" }, 404);
      await garantirColecao(sb, ev);
      if (acao === "reprocessar_erros") {
        await sb.from("fotos_evento").update({ status_indexacao: "pendente", erro_indexacao: null }).eq("evento_id", ev.id).eq("status_indexacao", "erro");
      }
      const { data: lote } = await sb.from("fotos_evento").select("id, storage_path, storage_path_preview")
        .eq("evento_id", ev.id).eq("upload_concluido", true).eq("status_moderacao", "aprovada").eq("status_indexacao", "pendente")
        .order("criado_em").limit(LOTE_INDEXACAO);
      const resultado: Record<string, number> = { indexada: 0, sem_rosto: 0, erro: 0 };
      const d = deps(sb);
      for (const f of lote ?? []) resultado[await indexarFotoComDeps(d, ev.collection_id, f)]++;
      const { count } = await sb.from("fotos_evento").select("id", { count: "exact", head: true })
        .eq("evento_id", ev.id).eq("upload_concluido", true).eq("status_moderacao", "aprovada").eq("status_indexacao", "pendente");
      return jsonResponse({ processadas: lote?.length ?? 0, resultado, restantes: count ?? 0 });
    }

    if (acao === "moderar") {
      const decisao = body.decisao;
      if (decisao !== "aprovar" && decisao !== "rejeitar") return jsonResponse({ error: "decisao_invalida" }, 400);
      const ids = (Array.isArray(body.foto_ids) ? body.foto_ids : []).filter(ehUuid).slice(0, 200);
      const { data: fotos } = await sb.from("fotos_evento").select("id, evento_id, storage_path, storage_path_preview, origem, status_moderacao")
        .in("id", ids).eq("origem", "convidado").eq("status_moderacao", "pendente");
      const agora = new Date().toISOString();
      const aprovadas = new Map<string, string[]>();
      for (const f of fotos ?? []) {
        if (decisao === "aprovar") {
          await sb.from("fotos_evento").update({ status_moderacao: "aprovada", status_indexacao: "pendente", moderado_por: papel.userId, moderado_em: agora }).eq("id", f.id).eq("status_moderacao", "pendente");
          aprovadas.set(f.evento_id, [...(aprovadas.get(f.evento_id) ?? []), f.id]);
        } else {
          const ev = await evento(sb, f.evento_id);
          if (ev && colecaoValida(ev.collection_id) && ev.colecao_criada_em) await apagarRostos(sb, ev.collection_id, f.id);
          await sb.storage.from(BUCKET).remove([f.storage_path, f.storage_path_preview].filter((x): x is string => !!x));
          await sb.from("fotos_evento").update({ status_moderacao: "rejeitada", moderado_por: papel.userId, moderado_em: agora }).eq("id", f.id);
          await sb.from("eventos_fotos").update({ capa_foto_id: null }).eq("capa_foto_id", f.id);
        }
      }
      const indexacao = { indexada: 0, sem_rosto: 0, erro: 0 };
      for (const [evId, ids] of aprovadas) {
        const r = await indexarAgora(sb, evId, ids);
        if (r) for (const k of Object.keys(indexacao) as (keyof typeof indexacao)[]) indexacao[k] += r.resultado[k];
      }
      return jsonResponse({ moderadas: fotos?.length ?? 0, indexacao });
    }

    if (acao === "erros_indexacao") {
      if (!ehUuid(body.evento_id)) return jsonResponse({ error: "evento_invalido" }, 400);
      const { data } = await sb.from("fotos_evento").select("id, origem, erro_indexacao, criado_em")
        .eq("evento_id", body.evento_id).eq("status_indexacao", "erro").order("criado_em").limit(100);
      return jsonResponse({ erros: data ?? [] });
    }

    if (acao === "previas") {
      const ids = (Array.isArray(body.foto_ids) ? body.foto_ids : []).filter(ehUuid).slice(0, 200);
      const { data: fotos } = await sb.from("fotos_evento").select("id, storage_path, storage_path_preview").in("id", ids).neq("status_moderacao", "rejeitada");
      const caminhos = (fotos ?? []).map((f) => f.storage_path_preview ?? f.storage_path);
      const { data: urls } = caminhos.length ? await sb.storage.from(BUCKET).createSignedUrls(caminhos, 600) : { data: [] };
      const mapa = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
      return jsonResponse({ previas: Object.fromEntries((fotos ?? []).map((f) => [f.id, mapa.get(f.storage_path_preview ?? f.storage_path) ?? null])) });
    }

    if (acao === "limpar_incompletos") {
      if (!ehUuid(body.evento_id)) return jsonResponse({ error: "evento_invalido" }, 400);
      const limite = new Date(Date.now() - 2 * 3600_000).toISOString();
      const { data: fotos } = await sb.from("fotos_evento").select("id, storage_path, storage_path_preview")
        .eq("evento_id", body.evento_id).eq("upload_concluido", false).lt("criado_em", limite).limit(500);
      if (fotos?.length) {
        await sb.storage.from(BUCKET).remove(fotos.flatMap((f) => [f.storage_path, f.storage_path_preview]).filter((x): x is string => !!x));
        await sb.from("fotos_evento").delete().in("id", fotos.map((f) => f.id));
      }
      return jsonResponse({ removidas: fotos?.length ?? 0 });
    }

    if (acao === "leads_csv") {
      if (!ehUuid(body.evento_id)) return jsonResponse({ error: "evento_invalido" }, 400);
      const { data } = await sb.from("leads_fotos").select("*").eq("evento_id", body.evento_id).order("criado_em");
      const cab = ["nome", "whatsapp", "email", "aceite_biometria_em", "aceite_publicacao_em", "qtd_buscas", "qtd_fotos_encontradas", "qtd_fotos_enviadas", "criado_em"];
      const linhas = (data ?? []).map((l) => cab.map((c) => csv((l as Record<string, unknown>)[c])).join(";"));
      return jsonResponse({ csv: [cab.join(";"), ...linhas].join("\n") });
    }

    if (acao === "definir_capa") {
      if (!ehUuid(body.evento_id)) return jsonResponse({ error: "evento_invalido" }, 400);
      if (body.foto_id === null) {
        await sb.from("eventos_fotos").update({ capa_foto_id: null }).eq("id", body.evento_id);
        return jsonResponse({ ok: true });
      }
      if (!ehUuid(body.foto_id)) return jsonResponse({ error: "foto_invalida" }, 400);
      const { data: f } = await sb.from("fotos_evento").select("id").eq("id", body.foto_id).eq("evento_id", body.evento_id)
        .eq("status_moderacao", "aprovada").eq("upload_concluido", true).maybeSingle();
      if (!f) return jsonResponse({ error: "foto_nao_aprovada" }, 400);
      await sb.from("eventos_fotos").update({ capa_foto_id: f.id }).eq("id", body.evento_id);
      return jsonResponse({ ok: true });
    }

    if (acao === "url_original") {
      if (!ehUuid(body.foto_id)) return jsonResponse({ error: "foto_invalida" }, 400);
      const { data: f } = await sb.from("fotos_evento").select("storage_path, status_moderacao").eq("id", body.foto_id).maybeSingle();
      if (!f || f.status_moderacao === "rejeitada") return jsonResponse({ error: "foto_nao_encontrada" }, 404);
      const { data: u } = await sb.storage.from(BUCKET).createSignedUrl(f.storage_path, 600, { download: true });
      return jsonResponse({ url: u?.signedUrl ?? null });
    }

    return jsonResponse({ error: "acao_invalida" }, 400);
  } catch (e) {
    console.error("fotos-evento-admin", e instanceof Error ? e.message : "erro");
    return jsonResponse({ error: "erro_interno" }, 500);
  }
});
