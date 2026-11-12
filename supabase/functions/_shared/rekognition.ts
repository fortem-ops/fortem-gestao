// Cliente mínimo do AWS Rekognition (JSON 1.1) com assinatura SigV4 própria. Só para funções do servidor.
// A selfie nunca é registrada: nenhum log deste módulo inclui o corpo da requisição.
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

export type Credenciais = { accessKeyId: string; secretAccessKey: string; region: string };

/** Cabeçalhos assinados (SigV4) para uma chamada JSON da AWS. Pura em relação à data recebida. */
export async function assinar(cred: Credenciais, servico: string, target: string, body: string, agora = new Date()) {
  const host = `${servico}.${cred.region}.amazonaws.com`;
  const amzDate = agora.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dia = amzDate.slice(0, 8);
  const payloadHash = await sha256(body);
  const headers: Record<string, string> = {
    "content-type": "application/x-amz-json-1.1",
    host, "x-amz-date": amzDate, "x-amz-target": target,
  };
  const nomes = Object.keys(headers).sort();
  const canon = ["POST", "/", "", nomes.map((n) => `${n}:${headers[n]}\n`).join(""), nomes.join(";"), payloadHash].join("\n");
  const escopo = `${dia}/${cred.region}/${servico}/aws4_request`;
  const aAssinar = ["AWS4-HMAC-SHA256", amzDate, escopo, await sha256(canon)].join("\n");
  let k = await hmac(enc.encode("AWS4" + cred.secretAccessKey), dia);
  k = await hmac(k, cred.region); k = await hmac(k, servico); k = await hmac(k, "aws4_request");
  const assinatura = hex(await hmac(k, aAssinar));
  return {
    url: `https://${host}/`,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${cred.accessKeyId}/${escopo}, SignedHeaders=${nomes.join(";")}, Signature=${assinatura}`,
    },
  };
}

export class ErroAws extends Error { constructor(public tipo: string, msg: string, public status: number) { super(msg); } }

export function credenciaisDoAmbiente(): Credenciais {
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID"), secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
  const region = Deno.env.get("AWS_REGION");
  if (!accessKeyId || !secretAccessKey || !region) throw new Error("aws_nao_configurada");
  return { accessKeyId, secretAccessKey, region };
}

export async function rekognition<T = Record<string, unknown>>(acao: string, params: Record<string, unknown>, cred = credenciaisDoAmbiente()): Promise<T> {
  const body = JSON.stringify(params);
  const { url, headers } = await assinar(cred, "rekognition", `RekognitionService.${acao}`, body);
  const { host: _h, ...h } = headers;
  const r = await fetch(url, { method: "POST", headers: h, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const tipo = String(j.__type ?? "Erro").split("#").pop() ?? "Erro";
    throw new ErroAws(tipo, String(j.message ?? j.Message ?? r.statusText), r.status);
  }
  return j as T;
}

export function base64(bytes: Uint8Array): string {
  let s = ""; const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) s += String.fromCharCode(...bytes.subarray(i, i + passo));
  return btoa(s);
}
