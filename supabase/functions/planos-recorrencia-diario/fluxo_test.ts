import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { executar, TETO_EXECUCAO_CENTAVOS, type DepsRec, type Mensalidade } from "./fluxo.ts";

// Banco falso que imita as regras de reservar/resultado/devidas (D0, D+1, D+3; 3 tentativas).
function banco(linhas: Mensalidade[], o: { simulacao?: boolean; pode?: string; cobrar?: (m: Mensalidade) => any; consulta?: any } = {}) {
  const prox = new Map<string, string | null>();
  const chamadasRede: string[] = []; const avisos: string[] = []; const alertas: string[] = [];
  const add = (d: string, n: number) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const deps: DepsRec = {
    simulacao: o.simulacao ?? true,
    devidas: async (hoje) => linhas.filter((m) => ["pendente", "recusado"].includes(m.status) && m.tentativas < 3 && (prox.get(m.id) ?? "2000-01-01") <= hoje),
    incertas: async () => linhas.filter((m) => m.status === "desconhecido"),
    podeCobrar: async () => o.pode ?? "ok",
    reservar: async (id) => {
      const m = linhas.find((x) => x.id === id)!;
      if (!["pendente", "recusado"].includes(m.status) || m.tentativas >= 3) return null;
      m.status = "processando"; m.tentativas++; m.referencia = "REF" + id + "T" + m.tentativas; return { ...m };
    },
    cobrar: async (m) => { chamadasRede.push(m.referencia!); return o.cobrar ? o.cobrar(m) : { res: "aprovado", tid: "T" }; },
    consultar: async () => o.consulta ?? { res: "nao_encontrado" },
    resultado: async (id, res, _t, _m, hoje) => {
      const m = linhas.find((x) => x.id === id)!;
      if (!["processando", "desconhecido"].includes(m.status)) return "ignorado";
      if (res === "aprovado") m.status = "pago";
      else if (res === "recusado") {
        m.status = m.tentativas >= 3 ? "inadimplente" : "recusado";
        prox.set(id, m.tentativas === 1 ? add(hoje, 1) : m.tentativas === 2 ? add(hoje, 2) : null);
        if (m.status === "inadimplente") avisos.push(id);
      } else m.status = "desconhecido";
      return m.status;
    },
    alerta: async (msg) => { alertas.push(msg); },
  };
  return { deps, chamadasRede, avisos, alertas };
}
const linha = (id: string, extra: Partial<Mensalidade> = {}): Mensalidade =>
  ({ id, proposta_id: "p", tokenizacao_id: "t", numero: 2, valor_centavos: 45390, status: "pendente", tentativas: 0, referencia: null, simulado: true, ...extra });

Deno.test("rodar 2x na mesma data: 1 tentativa por ciclo", async () => {
  const l = [linha("a")];
  const b = banco(l, { cobrar: () => ({ res: "recusado", motivo: "x" }) });
  await executar(b.deps, "2026-11-14");
  await executar(b.deps, "2026-11-14");
  assertEquals(b.chamadasRede.length, 1);
  assertEquals(l[0].tentativas, 1);
});

Deno.test("retentativas D+1 e D+3; 3ª recusa vira inadimplente com 1 aviso", async () => {
  const l = [linha("a")];
  const b = banco(l, { cobrar: () => ({ res: "recusado", motivo: "x" }) });
  await executar(b.deps, "2026-11-14");
  await executar(b.deps, "2026-11-15"); // D+1
  await executar(b.deps, "2026-11-16"); // nada (próxima em D+3)
  assertEquals(b.chamadasRede.length, 2);
  await executar(b.deps, "2026-11-17"); // D+3
  await executar(b.deps, "2026-11-18");
  assertEquals(b.chamadasRede.length, 3);
  assertEquals(l[0].status, "inadimplente");
  assertEquals(b.avisos.length, 1);
});

Deno.test("resultado incerto nunca recobra; só consulta pela referência", async () => {
  const l = [linha("a")];
  const b = banco(l, { cobrar: () => ({ res: "desconhecido" }) });
  await executar(b.deps, "2026-11-14");
  await executar(b.deps, "2026-11-15");
  await executar(b.deps, "2026-11-20");
  assertEquals(b.chamadasRede.length, 1);
  assertEquals(l[0].status, "desconhecido");
});

Deno.test("incerto conciliado como aprovado vira pago sem nova cobrança", async () => {
  const l = [linha("a", { status: "desconhecido", tentativas: 1, referencia: "R" })];
  const b = banco(l, { consulta: { res: "aprovado", tid: "T" } });
  await executar(b.deps, "2026-11-15");
  assertEquals(l[0].status, "pago");
  assertEquals(b.chamadasRede.length, 0);
});

Deno.test("modo real: sem pode_cobrar='ok' (chave desligada) não reserva nem cobra", async () => {
  const l = [linha("a", { simulado: false })];
  const b = banco(l, { simulacao: false, pode: "desligado" });
  const r = await executar(b.deps, "2026-11-14");
  assertEquals(b.chamadasRede.length, 0);
  assertEquals(l[0].tentativas, 0);
  assertEquals(r.puladas.desligado, 1);
});

Deno.test("simulação nunca toca linha real e vice-versa", async () => {
  const b = banco([linha("a", { simulado: false })], { simulacao: true });
  await executar(b.deps, "2026-11-14");
  assertEquals(b.chamadasRede.length, 0);
});

Deno.test("teto por execução para e avisa", async () => {
  const grande = Math.floor(TETO_EXECUCAO_CENTAVOS / 2) + 1;
  const l = [linha("a", { valor_centavos: grande }), linha("b", { valor_centavos: grande })];
  const b = banco(l);
  const r = await executar(b.deps, "2026-11-14");
  assertEquals(b.chamadasRede.length, 1);
  assertEquals(r.teto_atingido, true);
  assertEquals(b.alertas.length, 1);
});

Deno.test("erro inesperado na cobrança vira desconhecido (não recobra)", async () => {
  const l = [linha("a")];
  const b = banco(l, { cobrar: () => { throw new Error("x"); } });
  await executar(b.deps, "2026-11-14");
  await executar(b.deps, "2026-11-15");
  assertEquals(l[0].status, "desconhecido");
  assertEquals(b.chamadasRede.length, 1);
});
