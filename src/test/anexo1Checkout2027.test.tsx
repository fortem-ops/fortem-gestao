import { describe, it, expect } from "vitest";
import { ANEXO1_VAZIO, anexoCompleto, anexoParaEnvio } from "@/components/planos/Anexo1Checkout2027";

const cheio = { ...ANEXO1_VAZIO, termos_lidos: true, medical_status: "restricao" as const, image_usage: false,
  emergency_contact_name: "Maria Silva", emergency_contact_phone: "(51) 99999-1234", lgpd: true, assinatura: "data:image/png;base64,AA" };

describe("ANEXO I no checkout", () => {
  it("aceite só libera com tudo preenchido", () => {
    expect(anexoCompleto(ANEXO1_VAZIO)).toBe(false);
    expect(anexoCompleto(cheio)).toBe(true);
    expect(anexoCompleto({ ...cheio, medical_status: null })).toBe(false);
    expect(anexoCompleto({ ...cheio, image_usage: null })).toBe(false);
    expect(anexoCompleto({ ...cheio, assinatura: null })).toBe(false);
    expect(anexoCompleto({ ...cheio, termos_lidos: false })).toBe(false);
  });
  it("'Com restrições' não exige atestado e 'Não autorizo' conta como resposta", () => {
    const e = anexoParaEnvio(cheio);
    expect(e.anexo.medical_status).toBe("restricao");
    expect(e.anexo.image_usage).toBe(false);
    expect(e.anexo.emergency_contact_phone).toBe("51999991234");
    expect(e.anexo.versao).toBe("anexo1-2027-v1");
  });
});
