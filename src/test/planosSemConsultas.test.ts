import { describe, it, expect } from "vitest";
import { CONSULTAS_NO_SITE, WHATSAPP_FORTEM, linkConsultasEquipe } from "@/lib/planosPublico2027";

describe("site vende só o plano", () => {
  it("consultas ficam fora do checkout público", () => expect(CONSULTAS_NO_SITE).toBe(false));
  it("WhatsApp oficial com código do país", () => {
    expect(WHATSAPP_FORTEM).toBe("555135199451");
    expect(linkConsultasEquipe("Power · 2x por semana")).toMatch(/^https:\/\/wa\.me\/555135199451\?text=/);
  });
});
