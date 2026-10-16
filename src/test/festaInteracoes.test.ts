import { describe, it, expect } from "vitest";
import { validarComentario } from "@/lib/festaInteracoes";
describe("validarComentario", () => {
  it("aceita comentário válido", () => expect(validarComentario("Ana", "Que foto!")).toBeNull());
  it("recusa acima de 300 caracteres", () => expect(validarComentario("Ana", "a".repeat(301))).not.toBeNull());
  it("recusa links", () => expect(validarComentario("Ana", "veja https://x.com")).not.toBeNull());
  it("exige nome", () => expect(validarComentario("", "oi oi")).not.toBeNull());
});
