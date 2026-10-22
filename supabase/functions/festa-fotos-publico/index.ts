// Festa 10 anos: lista pública das fotos da linha do tempo, com links temporários.
// Leitura feita no servidor; o público não lê a tabela nem o armazenamento diretamente.
import { corsHeaders, jsonResponse, admin } from "../_shared/inter.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sup = admin();
    const { data, error } = await sup.from("festa_fotos").select("id, ano, url, caminho, alt, ordem");
    if (error) throw error;
    const fotos = data ?? [];
    // Fotos com link fixo (10 anos) gravado são usadas como estão; só as antigas são assinadas aqui.
    const caminhos = fotos.filter((f) => f.caminho && !/^https?:\/\//.test(f.url)).map((f) => f.caminho as string);
    if (caminhos.length) {
      const { data: assinadas } = await sup.storage.from("festa-fotos").createSignedUrls(caminhos, 60 * 60 * 24);
      const mapa = new Map((assinadas ?? []).map((s) => [s.path, s.signedUrl]));
      for (const f of fotos) if (f.caminho && mapa.get(f.caminho)) f.url = mapa.get(f.caminho)!;
    }
    const { data: cfgAjuste } = await sup.from("sistema_config").select("valor").eq("chave", "festa_autor_foto_ajuste").maybeSingle();
    return jsonResponse({ fotos: fotos.map(({ caminho: _c, ...f }) => ({ ...f, caminho: null })), ajusteAutor: cfgAjuste?.valor ?? null });
  } catch (e) {
    console.error("festa-fotos-publico", e);
    return jsonResponse({ error: "erro_interno" }, 500);
  }
});
