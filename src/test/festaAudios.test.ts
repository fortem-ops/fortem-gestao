import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { audioValido, textoDuracao, ANOS_HISTORIA } from "@/lib/festaAudios";

describe("áudios da história", () => {
  it("sem áudios esconde a duração", () => expect(textoDuracao([null, undefined])).toBeNull());
  it("soma as durações: 14 min", () => expect(textoDuracao([420, 420])).toBe("cerca de 14 min"));
  it("aceita mp3 até 25 MB", () => expect(audioValido({ name: "a.mp3", type: "audio/mpeg", size: 25 * 1024 * 1024 })).toBeNull());
  it("recusa acima de 25 MB", () => expect(audioValido({ name: "a.mp3", type: "audio/mpeg", size: 25 * 1024 * 1024 + 1 })).not.toBeNull());
  it("recusa outros formatos", () => expect(audioValido({ name: "a.ogg", type: "audio/ogg", size: 10 })).not.toBeNull());
  it("anos 2016 a 2027", () => expect([ANOS_HISTORIA[0], ANOS_HISTORIA.at(-1), ANOS_HISTORIA.length]).toEqual(["2016", "2027", 12]));
});
