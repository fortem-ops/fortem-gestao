// Regras puras da verificação por código (identificação pública /planos).
// Sem dependências do Deno para poder ser testado no Vitest.

export const VALIDADE_CODIGO_MIN = 10;
export const MAX_TENTATIVAS_CODIGO = 5;

export function cpfDigitosValidos(cpf: string | null | undefined): boolean {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** n*****@gmail.com — mostra só a primeira letra do usuário e o domínio. */
export function mascararEmail(email: string): string {
  const [u, dom] = email.trim().toLowerCase().split("@");
  if (!u || !dom) return "e-mail cadastrado";
  return `${u[0]}*****@${dom}`;
}

export function gerarCodigo(rand: (n: number) => number = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n): string {
  return String(rand(1_000_000)).padStart(6, "0");
}

export async function hashCodigo(verificacaoId: string, codigo: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${verificacaoId}:${codigo.trim()}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Remove qualquer sequência de 11 dígitos (CPF) antes de ir para log. */
export function semCpf(texto: string): string {
  return texto.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "***");
}

export type Envio = { enviado: true; verificacao_id: string; email_mascarado: string } | { enviado: false; motivo: "sem_email" | "limitado" | "indisponivel" };

/** Só envia e-mail a quem está na lista de teste, enquanto o envio não for liberado. */
export function podeEnviarCodigo(alunoId: string, liberado: boolean, idsTeste: unknown): boolean {
  if (liberado) return true;
  return Array.isArray(idsTeste) && idsTeste.includes(alunoId);
}

export function corpoEmailCodigo(codigo: string): { assunto: string; html: string } {
  const assunto = `Seu código FORTEM: ${codigo}`;
  const html = `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Archivo,Arial,sans-serif;color:#111111">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<div style="font-weight:900;font-size:22px;letter-spacing:1px;text-transform:uppercase;border-bottom:4px solid #E21C1C;padding-bottom:12px">FORTEM</div>
<p style="font-size:16px;line-height:1.5;margin:24px 0">Use o código abaixo para confirmar que é você e continuar a compra do seu plano.</p>
<div style="font-size:36px;font-weight:900;letter-spacing:8px;background:#111111;color:#ffffff;padding:16px 20px;display:inline-block">${codigo}</div>
<p style="font-size:15px;line-height:1.5;margin:24px 0 8px">Ele vale por 10 minutos.</p>
<p style="font-size:14px;line-height:1.5;color:#555555;margin:0 0 8px">Se você não pediu este código, ignore esta mensagem.</p>
<p style="font-size:14px;line-height:1.5;color:#555555;margin:0">Ninguém da FORTEM pede esse código por telefone ou WhatsApp.</p>
</div></body></html>`;
  return { assunto, html };
}

/** Resposta pública do envio: igual para CPF com e sem cadastro (anti-enumeração). Só "limitado" difere. */
export type EnvioPublico = { enviado: true; verificacao_id: string } | { enviado: false; motivo: "limitado" };
export function respostaEnvioPublica(r: Envio, idFalso: string): EnvioPublico {
  if (!r.enviado && r.motivo === "limitado") return { enviado: false, motivo: "limitado" };
  return { enviado: true, verificacao_id: r.enviado ? r.verificacao_id : idFalso };
}

/** Validação pública: verificação inexistente responde como código errado. */
export function respostaValidacaoPublica(r: { ok?: boolean; motivo?: string; restantes?: number } | null) {
  if (r?.ok) return { ok: true };
  if (!r || r.motivo === "invalido" || r.motivo === "usado") return { ok: false, motivo: "errado", restantes: 4 };
  return { ok: false, motivo: r.motivo, ...(typeof r.restantes === "number" ? { restantes: r.restantes } : {}) };
}
