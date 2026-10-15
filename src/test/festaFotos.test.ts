import { describe, it, expect } from "vitest";
import { agruparFotosPorAno } from "@/lib/festaFotos";
describe("agruparFotosPorAno", () => {
  it("agrupa por ano e ordena pela ordem", () => {
    const g = agruparFotosPorAno([{ id: "b", ano: "2017", ordem: 1 }, { id: "a", ano: "2017", ordem: 0 }, { id: "c", ano: "2016", ordem: 0 }]);
    expect(g["2017"].map((f) => f.id)).toEqual(["a", "b"]);
    expect(g["2016"]).toHaveLength(1);
  });
});
