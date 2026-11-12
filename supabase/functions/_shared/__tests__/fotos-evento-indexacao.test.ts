import { describe, expect, it } from "vitest";
import { indexarFila, type DepsIndexacao, type FotoIdx } from "../fotos-evento-indexacao";

type Linha = FotoIdx & { status_moderacao: string; status_indexacao: string; upload_concluido: boolean; qtd_rostos: number; erro_indexacao: string | null };

function banco(fotos: Linha[], rostosPorFoto: Record<string, number>, falhar: string[] = []) {
  const rostos: { foto_id: string; face: string }[] = [];
  const deps: DepsIndexacao = {
    baixar: async (c) => { if (falhar.some((id) => c.endsWith(`/${id}.jpg`))) throw new Error("arquivo_nao_encontrado"); return new Uint8Array(10); },
    indexFaces: async (_c, _b, id) => ({ FaceRecords: Array.from({ length: rostosPorFoto[id] ?? 0 }, (_, i) => ({ Face: { FaceId: `${id}-f${i}` } })) }),
    apagarRostos: async (_c, id) => { for (let i = rostos.length - 1; i >= 0; i--) if (rostos[i].foto_id === id) rostos.splice(i, 1); },
    inserirRostos: async (id, faces) => { rostos.push(...faces.map((face) => ({ foto_id: id, face }))); },
    atualizarFoto: async (id, p) => { Object.assign(fotos.find((f) => f.id === id)!, p); },
    pendentes: async (_e, limite, ids) => fotos.filter((f) => f.status_moderacao === "aprovada" && f.upload_concluido && f.status_indexacao === "pendente" && (!ids || ids.includes(f.id))).slice(0, limite),
  };
  return { deps, rostos };
}
const foto = (id: string, mod = "pendente"): Linha => ({ id, storage_path: `ev/convidado/original/${id}.jpg`, storage_path_preview: `ev/convidado/preview/${id}.jpg`, status_moderacao: mod, status_indexacao: "pendente", upload_concluido: true, qtd_rostos: 0, erro_indexacao: null });

describe("indexação após aprovação (regressão: aprovadas ficavam pendentes)", () => {
  it("aprovar foto de convidado → entra na fila e é indexada com os rostos gravados", async () => {
    const fotos = [foto("a"), foto("b"), foto("c")];
    const { deps, rostos } = banco(fotos, { a: 2, b: 0 });
    // moderação aprova a e b; c segue pendente de moderação
    for (const f of fotos.slice(0, 2)) f.status_moderacao = "aprovada";
    const r = await indexarFila(deps, { id: "ev", collection_id: "fortem-evento-10anos" }, { ids: ["a", "b"], maximo: 30, lote: 5 });
    expect(r.processadas).toBe(2);
    expect(fotos[0]).toMatchObject({ status_indexacao: "indexada", qtd_rostos: 2 });
    expect(fotos[1]).toMatchObject({ status_indexacao: "sem_rosto", qtd_rostos: 0 });
    expect(fotos[2].status_indexacao).toBe("pendente");
    expect(rostos.map((x) => x.face)).toEqual(["a-f0", "a-f1"]);
  });
  it("foto não aprovada nunca é indexada", async () => {
    const fotos = [foto("p")];
    const { deps } = banco(fotos, { p: 1 });
    const r = await indexarFila(deps, { id: "ev", collection_id: "fortem-x" }, { maximo: 30, lote: 5 });
    expect(r.processadas).toBe(0);
    expect(fotos[0].status_indexacao).toBe("pendente");
  });
  it("erro fica gravado com a mensagem e não trava a fila", async () => {
    const fotos = [foto("e", "aprovada"), foto("ok", "aprovada")];
    const { deps } = banco(fotos, { ok: 1 }, ["e"]);
    const r = await indexarFila(deps, { id: "ev", collection_id: "fortem-x" }, { maximo: 30, lote: 1 });
    expect(r.resultado).toEqual({ indexada: 1, sem_rosto: 0, erro: 1 });
    expect(fotos[0]).toMatchObject({ status_indexacao: "erro", erro_indexacao: "arquivo_nao_encontrado" });
  });
});
