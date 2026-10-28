import { describe, it, expect } from "vitest";
import { rotuloPrevia, textoAgrupado } from "@/lib/whatsappChat";

describe("pop-up WhatsApp", () => {
  it("rótulos", () => {
    expect(rotuloPrevia("reaction", "👍")).toBe("Reagiu 👍 à mensagem");
    expect(rotuloPrevia("sticker", "")).toBe("Figurinha");
    expect(rotuloPrevia("image", "")).toBe("📷 Foto");
    expect(rotuloPrevia("text", "[unsupported]")).toBe("Nova mensagem");
    expect(rotuloPrevia("text", "oi")).toBe("oi");
  });
  it("agrupa", () => {
    expect(textoAgrupado(1, "oi")).toBe("oi");
    expect(textoAgrupado(3, "oi")).toBe("3 mensagens novas · oi");
  });
});
