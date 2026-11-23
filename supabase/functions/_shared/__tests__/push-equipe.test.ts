import { describe, it, expect } from "vitest";
import {
  GATILHOS_EQUIPE, gatilhoPermitido, validarMensagem, dentroDoExpediente, momentoDeEnvio,
  filtrarDestinatarios, inscricaoInvalida,
} from "../push-equipe";
import { decidirChamador } from "../chamador-push";

// Brasília = UTC-3. 2026-11-23 é segunda-feira.
const brt = (iso: string) => new Date(`${iso}-03:00`);

describe("gatilhos com push", () => {
  it("só gatilhos da lista passam; itens SEM push são recusados", () => {
    expect(gatilhoPermitido("teste")).toBe(true);
    for (const g of ["chargeback", "lead_novo", "tarefa_nova", "despesa_vencendo", "qualquer"]) {
      expect(gatilhoPermitido(g)).toBe(false);
      expect(validarMensagem(g, "Título", "Corpo")).toBe("gatilho_sem_push");
    }
  });
  it("texto com exclamação ou 'comissionamento' é recusado", () => {
    expect(validarMensagem("teste", "Pronto!", "")).toBe("exclamacao");
    expect(validarMensagem("teste", "Aviso", "Seu Comissionamento saiu")).toBe("termo_proibido");
    expect(validarMensagem("teste", "Aviso", "Tudo certo")).toBeNull();
  });
  it("o teste é urgente (sai a qualquer hora)", () => {
    expect(GATILHOS_EQUIPE.teste.urgente).toBe(true);
  });
});

describe("expediente e pendentes", () => {
  it("seg–qui 06:10–20:40 e sex 06:10–19:40", () => {
    expect(dentroDoExpediente(brt("2026-11-23T06:10:00"))).toBe(true);
    expect(dentroDoExpediente(brt("2026-11-23T06:09:00"))).toBe(false);
    expect(dentroDoExpediente(brt("2026-11-26T20:40:00"))).toBe(true);
    expect(dentroDoExpediente(brt("2026-11-26T20:41:00"))).toBe(false);
    expect(dentroDoExpediente(brt("2026-11-27T19:41:00"))).toBe(false);
    expect(dentroDoExpediente(brt("2026-11-28T10:00:00"))).toBe(false);
  });
  it("não urgente fora do expediente fica para 06:10 do próximo dia útil", () => {
    expect(momentoDeEnvio(brt("2026-11-23T05:00:00"), false)).toEqual(brt("2026-11-23T06:10:00"));
    expect(momentoDeEnvio(brt("2026-11-23T21:00:00"), false)).toEqual(brt("2026-11-24T06:10:00"));
    expect(momentoDeEnvio(brt("2026-11-27T19:50:00"), false)).toEqual(brt("2026-11-30T06:10:00"));
    expect(momentoDeEnvio(brt("2026-11-28T12:00:00"), false)).toEqual(brt("2026-11-30T06:10:00"));
    expect(momentoDeEnvio(brt("2026-11-29T23:59:00"), false)).toEqual(brt("2026-11-30T06:10:00"));
  });
  it("no expediente ou urgente sai na hora", () => {
    const a = brt("2026-11-24T10:00:00");
    expect(momentoDeEnvio(a, false)).toBe(a);
    const b = brt("2026-11-28T03:00:00");
    expect(momentoDeEnvio(b, true)).toBe(b);
  });
});

describe("destinatários", () => {
  const c = [
    { user_id: "a", papeis: ["admin"], ativo: true },
    { user_id: "p", papeis: ["professor"], ativo: true },
    { user_id: "x", papeis: ["professor"], ativo: false },
    { user_id: "al", papeis: ["aluno"], ativo: true },
  ];
  it("por pessoa: inativo e aluno não recebem", () => {
    expect(filtrarDestinatarios(c).sort()).toEqual(["a", "p"]);
  });
  it("por papel: só quem tem o papel e está ativo", () => {
    expect(filtrarDestinatarios(c, "professor")).toEqual(["p"]);
    expect(filtrarDestinatarios(c, "admin")).toEqual(["a"]);
  });
});

describe("inscrição inválida", () => {
  it("404 e 410 apagam; outros erros não", () => {
    expect(inscricaoInvalida(404)).toBe(true);
    expect(inscricaoInvalida(410)).toBe(true);
    expect(inscricaoInvalida(500)).toBe(false);
    expect(inscricaoInvalida(undefined)).toBe(false);
  });
});

// Regressão: send-push-notification aceitava qualquer chamada (inclusive só com a chave pública).
describe("quem pode chamar o push", () => {
  const base = { chaveServico: false, segredoRotina: false, usuario: null };
  it("sem autenticação ou só chave pública: negado", () => {
    expect(decidirChamador(base)).toBe("negado");
  });
  it("aluno ou funcionário inativo: negado", () => {
    expect(decidirChamador({ ...base, usuario: { staff: false, ativo: true } })).toBe("negado");
    expect(decidirChamador({ ...base, usuario: { staff: true, ativo: false } })).toBe("negado");
  });
  it("staff ativo, chave de serviço ou segredo da rotina: liberado", () => {
    expect(decidirChamador({ ...base, usuario: { staff: true, ativo: true } })).toBe("staff");
    expect(decidirChamador({ ...base, chaveServico: true })).toBe("servidor");
    expect(decidirChamador({ ...base, segredoRotina: true })).toBe("servidor");
  });
});
