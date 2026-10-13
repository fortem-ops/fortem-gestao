// Lógica compartilhada de criação de recorrência (POST /pix/v2/rec) e solicitação de confirmação (POST /pix/v2/solicrec).
// Usada pelas funções admin pix-criar-recorrencia / pix-solicitar-confirmacao e pelo modo interno de teste 3F.
import { interFetch, onlyDigits } from "./inter.ts";

type R = { ok: boolean; httpStatus: number; erro?: string; status?: number; detail?: unknown; [k: string]: unknown };

export async function criarRecorrencia(sup: any, p: {
  aluno_id: string; valor: number; data_inicio: string; data_fim?: string | null; objeto?: string | null; teste?: boolean; loc?: number | null;
}): Promise<R> {
  const { data: aluno, error: alunoErr } = await sup.from("alunos").select("id, nome").eq("id", p.aluno_id).maybeSingle();
  if (alunoErr || !aluno) return { ok: false, httpStatus: 404, erro: "Aluno não encontrado" };
  const { data: cpfRevealed, error: cpfErr } = await sup.rpc("fn_reveal_cpf_service", { p_aluno_id: p.aluno_id });
  if (cpfErr) return { ok: false, httpStatus: 500, erro: `Falha ao obter CPF: ${cpfErr.message}` };
  const cpf = onlyDigits(cpfRevealed);
  if (cpf.length !== 11) return { ok: false, httpStatus: 400, erro: "Aluno sem CPF válido" };

  const payload: any = {
    vinculo: {
      objeto: typeof p.objeto === "string" && p.objeto.trim() ? p.objeto.trim().slice(0, 140) : "Plano mensal FORTEM",
      contrato: p.aluno_id.replace(/-/g, "").substring(0, 35),
      devedor: { cpf, nome: aluno.nome },
    },
    calendario: { dataInicial: p.data_inicio, ...(p.data_fim ? { dataFinal: p.data_fim } : {}), periodicidade: "MENSAL" },
    valor: { valorMinimoRecebedor: p.valor.toFixed(2) },
    politicaRetentativa: "PERMITE_3R_7D",
    ...(p.loc != null ? { loc: p.loc } : {}),
  };
  console.log("[pix-rec] contrato:", payload.vinculo.contrato, "cpf final:", cpf.slice(-3));
  const { status, data, raw } = await interFetch("/pix/v2/rec", { method: "POST", json: payload });
  if (status >= 300) {
    console.error("Inter /rec error", status, raw.slice(0, 500));
    return { ok: false, httpStatus: 502, erro: "Falha ao criar recorrência no Inter", status, detail: data };
  }
  const idRec: string = data?.idRec;
  if (!idRec) return { ok: false, httpStatus: 502, erro: "idRec não retornado", status, detail: data };

  const { data: inserted, error: insErr } = await sup.from("pix_recorrencias").insert({
    aluno_id: p.aluno_id, id_rec: idRec, status: "CRIADA", valor_minimo: p.valor, periodicidade: "MENSAL",
    data_inicio: p.data_inicio, data_fim: p.data_fim ?? null, politica_retentativa: "PERMITE_3R_7D",
    raw_response: p.teste ? { ...data, _marcador: "teste_3F" } : data,
  }).select().single();
  if (insErr) return { ok: false, httpStatus: 500, erro: insErr.message, status, idRec };
  return { ok: true, httpStatus: 200, status, idRec, statusInter: data?.status ?? null, recorrencia: inserted };
}

export async function solicitarConfirmacao(sup: any, idRec: string): Promise<R> {
  const { data: rec } = await sup.from("pix_recorrencias").select("aluno_id, id_rec, data_inicio").eq("id_rec", idRec).maybeSingle();
  if (!rec) return { ok: false, httpStatus: 404, erro: "Recorrência não encontrada" };
  const { data: aluno } = await sup.from("alunos").select("nome").eq("id", rec.aluno_id).maybeSingle();
  if (!aluno) return { ok: false, httpStatus: 404, erro: "Aluno não encontrado" };
  const { data: cpfRevealed, error: cpfErr } = await sup.rpc("fn_reveal_cpf_service", { p_aluno_id: rec.aluno_id });
  if (cpfErr) return { ok: false, httpStatus: 500, erro: `Falha ao obter CPF: ${cpfErr.message}` };
  const cpf = onlyDigits(cpfRevealed);
  if (cpf.length !== 11) return { ok: false, httpStatus: 400, erro: "Aluno sem CPF válido" };

  // Expira em 7 dias ou antes do início da recorrência (00:00 de Brasília), o que vier primeiro.
  const seteDias = Date.now() + 7 * 24 * 3600 * 1000;
  const inicio = rec.data_inicio ? new Date(`${rec.data_inicio}T02:59:00Z`).getTime() : seteDias;
  const expira = new Date(Math.min(seteDias, inicio)).toISOString().replace(/\.\d{3}Z$/, "Z");

  const payload = { idRec, calendario: { dataExpiracaoSolicitacao: expira }, destinatario: { cpf, nome: aluno.nome } };
  const { status, data, raw } = await interFetch("/pix/v2/solicrec", { method: "POST", json: payload });
  if (status >= 300) {
    console.error("Inter /solicrec error", status, raw.slice(0, 500));
    return { ok: false, httpStatus: 502, erro: "Falha ao solicitar confirmação", status, detail: data };
  }
  const idSolicRec: string | undefined = data?.idSolicRec;
  await sup.from("pix_recorrencias").update({ status: "AGUARDANDO_AUTORIZACAO", id_solic_rec: idSolicRec ?? null }).eq("id_rec", idRec);
  return { ok: true, httpStatus: 200, status, idSolicRec, statusInter: data?.status ?? null, expiracao: expira };
}

/** Mascara CPF em qualquer estrutura (11 dígitos -> ***.***.*NN-NN só com os 3 finais). */
export function mascararCpf(v: unknown): unknown {
  return JSON.parse(JSON.stringify(v ?? null).replace(/\b\d{8}(\d{3})\b/g, "********$1"));
}
