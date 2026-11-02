import { describe, expect, it } from "vitest";
import { destaquePost, validarFotoFeed } from "./comunidadeFeed";

describe("feed da comunidade", () => {
  it("aceita foto de até 3 MB e recusa acima", () => {
    expect(validarFotoFeed({ type: "image/jpeg", size: 3 * 1024 * 1024 })).toBeNull();
    expect(validarFotoFeed({ type: "image/jpeg", size: 3 * 1024 * 1024 + 1 })).not.toBeNull();
  });
  it("recusa formatos fora de JPG, PNG e WebP", () => {
    expect(validarFotoFeed({ type: "image/gif", size: 10 })).not.toBeNull();
    expect(validarFotoFeed({ type: "image/webp", size: 10 })).toBeNull();
  });
  it("sequência destaca 8 semanas seguidas", () => {
    expect(destaquePost({ tipo: "sequencia", payload: { semanas: 8 } }).valor).toBe("8 semanas seguidas");
  });
});
