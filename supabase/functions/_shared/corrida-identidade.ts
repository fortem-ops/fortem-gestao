// Lógica pura de identidade da Campanha Corrida (CPF, tier, rota, nome).
// Sem I/O: pode ser testada diretamente com Vitest.

export const CPF_TESTE_HASH =
  "9d4b1135d02aa574942b053143c2c76ceb5d4d472be2c04138b314d179482ee3";
export const VALOR_TESTE = 10;

export type Rota = "aluno" | "somente_corrida" | "prospect" | "somente_provas";
export type Tier = "start" | "start_plus" | "power" | "pro" | "max";

/** Mapa de tipo de plano (como gravado no banco) → tier da campanha. */
export const TIER_MAP: Record<string, Tier> = {
  "start": "start",
  "start+": "start_plus",
  "power": "power",
  "pro": "pro",
  "max": "max",
};

// Alunos de agregadoras não têm plano/contrato direto com a Fortem:
// devem ser tratados como Prospect (preço cheio, sem cortesia, até 12x).
export const AGREGADORAS = new Set(["gympass/wellhub", "total pass"]);

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Extrai apenas os dígitos de um CPF (aceita máscara, null, undefined). */
export function cpfDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Hash SHA-256 do CPF; null quando não houver exatamente 11 dígitos. */
export async function cpfHashFromRaw(value: unknown): Promise<string | null> {
  const digits = cpfDigits(value);
  if (digits.length !== 11) return null;
  return await sha256Hex(digits);
}

export interface DecisaoRota {
  rota: Rota;
  tier: Tier | null;
  isAgregadora: boolean;
}

/** Decide rota/tier a partir do tipo de plano ativo do aluno. */
export function decidirRota({ tipoPlano }: { tipoPlano?: string | null }): DecisaoRota {
  const tipoNorm = tipoPlano ? String(tipoPlano).trim().toLowerCase() : null;
  const isAgregadora = tipoNorm ? AGREGADORAS.has(tipoNorm) : false;
  const tier = !isAgregadora && tipoNorm ? TIER_MAP[tipoNorm] ?? null : null;
  return {
    rota: isAgregadora ? "prospect" : tier ? "aluno" : "somente_corrida",
    tier,
    isAgregadora,
  };
}

/** Divide o nome completo em primeiro nome e sobrenome. */
export function splitNome(nome: unknown): { primeiro_nome: string; sobrenome: string } {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    primeiro_nome: partes[0] ?? "",
    sobrenome: partes.slice(1).join(" "),
  };
}

/** O aluno encontrado pelo cpf_hash tem precedência sobre o id vindo do payload. */
export function resolverAlunoId({
  alunoIdPayload,
  alunoIdPorHash,
}: {
  alunoIdPayload?: string | null;
  alunoIdPorHash?: string | null;
}): string | null {
  return alunoIdPorHash || alunoIdPayload || null;
}

/** Status inicial de um aluno criado pelo funil da Corrida. */
export function statusNovoAluno(rota: Rota | string): "avulso" | "prospect" {
  return rota === "somente_provas" ? "avulso" : "prospect";
}

export function isCpfTeste(hash: string | null | undefined): boolean {
  return hash === CPF_TESTE_HASH;
}

/** Aplica o valor simbólico de teste quando o CPF é o CPF de homologação. */
export function aplicarValorTeste(total: number, hash: string | null | undefined): number {
  return isCpfTeste(hash) ? VALOR_TESTE : total;
}
