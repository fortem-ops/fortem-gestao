import { describe, it, expect } from "vitest";
import { estadoPushAparelho } from "./equipePush";

const base = { temApis: true, ios: false, standalone: false, permissao: "granted" as const, inscrito: true };

describe("estado do push no aparelho", () => {
  it("inscrito com permissão = ativado; sem inscrição = desativado", () => {
    expect(estadoPushAparelho(base)).toBe("ativado");
    expect(estadoPushAparelho({ ...base, inscrito: false })).toBe("desativado");
  });
  it("iPhone fora do atalho pede o atalho FORTEM Equipe", () => {
    expect(estadoPushAparelho({ ...base, ios: true })).toBe("atalho_iphone");
    expect(estadoPushAparelho({ ...base, ios: true, standalone: true })).toBe("ativado");
  });
  it("permissão negada = bloqueado; sem APIs = sem suporte", () => {
    expect(estadoPushAparelho({ ...base, permissao: "denied" })).toBe("bloqueado");
    expect(estadoPushAparelho({ ...base, temApis: false })).toBe("sem_suporte");
  });
});
