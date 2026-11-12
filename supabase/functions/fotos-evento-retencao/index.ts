// Fotos de eventos — retenção: ao fim do prazo, apaga a coleção da AWS, os rostos, as fotos e os arquivos.
// Chamada pela rotina diária (chave de serviço) ou por admin/coordenador.
import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";
import { BUCKET, papelEquipe } from "../_shared/fotos-evento-srv.ts";
import { rekognition, ErroAws } from "../_shared/rekognition.ts";
import { colecaoValida, retencaoVencida } from "../_shared/fotos-evento.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const servico = auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (!servico) { const p = await papelEquipe(req); if (!p?.gerir) return jsonResponse({ error: "sem_permissao" }, 403); }
    const sb = admin();
    const { data: eventos } = await sb.from("eventos_fotos").select("id, data, retencao_dias, collection_id, colecao_criada_em").is("retencao_executada_em", null);
    const feitos: string[] = [];
    for (const ev of eventos ?? []) {
      if (!retencaoVencida(ev.data, ev.retencao_dias)) continue;
      if (ev.colecao_criada_em && colecaoValida(ev.collection_id)) {
        try { await rekognition("DeleteCollection", { CollectionId: ev.collection_id }); }
        catch (e) { if (!(e instanceof ErroAws && e.tipo === "ResourceNotFoundException")) throw e; }
      }
      for (;;) {
        const { data: fotos } = await sb.from("fotos_evento").select("id, storage_path, storage_path_preview").eq("evento_id", ev.id).limit(200);
        if (!fotos?.length) break;
        await sb.storage.from(BUCKET).remove(fotos.flatMap((f) => [f.storage_path, f.storage_path_preview]).filter((x): x is string => !!x));
        await sb.from("fotos_evento").delete().in("id", fotos.map((f) => f.id));
      }
      await sb.from("eventos_fotos").update({ retencao_executada_em: new Date().toISOString(), ativo: false, colecao_criada_em: null }).eq("id", ev.id);
      feitos.push(ev.id);
    }
    return jsonResponse({ eventos_limpos: feitos.length });
  } catch (e) {
    console.error("fotos-evento-retencao", e instanceof Error ? e.message : "erro");
    return jsonResponse({ error: "erro_interno" }, 500);
  }
});
