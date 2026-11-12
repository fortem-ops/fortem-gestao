// Indexação de rostos com dependências injetadas (testável no vitest e usada pela função da equipe).
// Regra: toda foto aprovada, de qualquer origem, entra na fila e é indexada logo após a aprovação/envio.
import { resultadoIndexacao, MAX_BYTES_REKOGNITION, type FaceRecord } from "./fotos-evento.ts";

export type FotoIdx = { id: string; storage_path: string; storage_path_preview: string | null };
export type StatusIdx = "indexada" | "sem_rosto" | "erro";

export interface DepsIndexacao {
  baixar(caminho: string): Promise<Uint8Array>;
  indexFaces(colecao: string, bytes: Uint8Array, fotoId: string): Promise<{ FaceRecords?: FaceRecord[] }>;
  apagarRostos(colecao: string, fotoId: string): Promise<void>;
  inserirRostos(fotoId: string, faceIds: string[]): Promise<void>;
  atualizarFoto(fotoId: string, patch: { status_indexacao: StatusIdx; qtd_rostos?: number; erro_indexacao: string | null }): Promise<void>;
  /** Fotos aprovadas, upload concluído e status pendente; filtra por ids quando informado. */
  pendentes(eventoId: string, limite: number, ids?: string[]): Promise<FotoIdx[]>;
}

export async function indexarFoto(d: DepsIndexacao, colecao: string, f: FotoIdx): Promise<StatusIdx> {
  try {
    const bytes = await d.baixar(f.storage_path_preview ?? f.storage_path);
    if (bytes.length > MAX_BYTES_REKOGNITION) throw new Error("previa_maior_que_5mb");
    await d.apagarRostos(colecao, f.id);
    const r = await d.indexFaces(colecao, bytes, f.id);
    const { status, faceIds } = resultadoIndexacao(r.FaceRecords);
    if (faceIds.length) await d.inserirRostos(f.id, faceIds);
    await d.atualizarFoto(f.id, { status_indexacao: status, qtd_rostos: faceIds.length, erro_indexacao: null });
    return status;
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 300) : "erro";
    await d.atualizarFoto(f.id, { status_indexacao: "erro", erro_indexacao: msg });
    return "erro";
  }
}

/** Indexa as fotos pendentes do evento (ou só as dos ids), em lotes, até `maximo`. */
export async function indexarFila(d: DepsIndexacao, ev: { id: string; collection_id: string }, opcoes: { ids?: string[]; maximo: number; lote: number }) {
  const resultado: Record<StatusIdx, number> = { indexada: 0, sem_rosto: 0, erro: 0 };
  const vistos = new Set<string>();
  let processadas = 0;
  while (processadas < opcoes.maximo) {
    const lote = (await d.pendentes(ev.id, Math.min(opcoes.lote, opcoes.maximo - processadas), opcoes.ids)).filter((f) => !vistos.has(f.id));
    if (!lote.length) break;
    for (const f of lote) { vistos.add(f.id); resultado[await indexarFoto(d, ev.collection_id, f)]++; processadas++; }
  }
  return { processadas, resultado };
}
