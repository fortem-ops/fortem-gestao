import { describe, it, expect } from "vitest";
import { OPCOES_PLANOS_R1, filtrarPlanosLegadoR1, opcoesPlanosVisiveis, NOVA_VENDA_R1 } from "@/lib/novaVendaAbas";
import { filtrarLegadoVendavel } from "@/lib/vendas2027";

const HOJE = "2026-11-09";
// Recorte do catálogo real (09/11/2026).
const planos = [
  { id: "c6", nome: "Consultoria Online - 6 meses 2026", atividade: "treinamento_funcional", frequencia: "livre", valor: 774, versao: null, ativo: true },
  { id: "cp1", nome: "Corrida - Power", atividade: "corrida", frequencia: "livre", valor: 160, versao: null, ativo: true },
  { id: "cs1", nome: "Corrida - Sem Plano", atividade: "corrida", frequencia: "livre", valor: 200, versao: null, ativo: true },
  { id: "gp", nome: "Gympass/Wellhub", atividade: "treinamento_funcional", frequencia: "3x", valor: 0, versao: null, ativo: true },
  { id: "tp", nome: "Total Pass", atividade: "treinamento_funcional", frequencia: "2x", valor: 0, versao: null, ativo: true },
  { id: "vip1", nome: "VIP", atividade: "treinamento_funcional", frequencia: "1x", valor: 0, versao: null, ativo: true },
  { id: "vip2", nome: "VIP", atividade: "treinamento_funcional", frequencia: "livre", valor: 0, versao: null, ativo: true },
  { id: "st", nome: "Start", atividade: "treinamento_funcional", frequencia: "2x", valor: 479, versao: null, ativo: true },
  { id: "stp", nome: "Start+", atividade: "treinamento_funcional", frequencia: "2x", valor: 4788, versao: null, ativo: true },
  { id: "pw", nome: "Power", atividade: "treinamento_funcional", frequencia: "2x", valor: 5388, versao: null, ativo: true },
  { id: "pw27", nome: "Power", atividade: "treinamento_funcional", frequencia: "2x", valor: 429, versao: 2027, ativo: true },
];
const legado = filtrarLegadoVendavel<any>(planos as any, HOJE);
const idsDe = (chave: string) => filtrarPlanosLegadoR1<any>(legado, chave).map((p) => p.id);
const todosLegadoVisiveis = OPCOES_PLANOS_R1.filter((o) => o.tipo === "legado").flatMap((o) => idsDe(o.chave));

describe("Nova Venda R1 — aba Planos", () => {
  it("tela nova ligada", () => expect(NOVA_VENDA_R1).toBe(true));

  it("lista Start, Power, Pro, Consultoria Online, Corrida, Gympass/Wellhub, Total Pass e VIP, sem 'Só serviços'", () => {
    expect(OPCOES_PLANOS_R1.map((o) => o.label)).toEqual([
      "Start", "Power", "Pro", "Consultoria Online", "Corrida", "Gympass/Wellhub", "Total Pass", "VIP",
    ]);
    expect(OPCOES_PLANOS_R1.some((o) => /servi/i.test(o.label) || /adicional|2027/i.test(o.label))).toBe(false);
  });

  it("Start/Power/Pro/Consultoria usam as mesmas famílias do fluxo 2027", () => {
    expect(OPCOES_PLANOS_R1.filter((o) => o.tipo === "2027").map((o: any) => o.familia)).toEqual([
      "start_2027", "power_2027", "pro_2027", "consultoria_online_2027",
    ]);
  });

  it("Corrida mostra os mesmos itens do fluxo antigo (atividade corrida)", () => {
    expect(idsDe("corrida")).toEqual(legado.filter((p: any) => p.atividade === "corrida").map((p: any) => p.id));
  });

  it("agregadoras e VIP são os mesmos objetos do catálogo antigo (mesmo valor R$ 0)", () => {
    for (const [chave, ids] of [["gympass", ["gp"]], ["totalpass", ["tp"]], ["vip", ["vip1", "vip2"]]] as const) {
      const itens = filtrarPlanosLegadoR1<any>(legado, chave);
      expect(itens.map((p) => p.id)).toEqual(ids);
      itens.forEach((p) => {
        expect(p).toBe(legado.find((l: any) => l.id === p.id));
        expect(p.valor).toBe(0);
      });
    }
  });

  it("Start antigo, Start+, Power antigo e Consultoria 6 meses R$ 774 deixam de aparecer", () => {
    for (const id of ["st", "stp", "pw", "c6"]) expect(todosLegadoVisiveis).not.toContain(id);
  });

  it("nenhum item 2027 entra pelo fluxo antigo", () => {
    expect(todosLegadoVisiveis).not.toContain("pw27");
  });

  it("quem não vende 2027 (ex.: Prospects sem permissão) ainda vê Corrida e agregadoras", () => {
    expect(opcoesPlanosVisiveis(false).map((o) => o.label)).toEqual(["Corrida", "Gympass/Wellhub", "Total Pass", "VIP"]);
    expect(opcoesPlanosVisiveis(true)).toHaveLength(8);
  });
});

describe("Nova Venda R1 — aba Serviços", () => {
  const servicos = [
    { id: "rec", nome: "Recovery - 1 sessão", valor: 50, versao: null, ativo: true },
    { id: "prova", nome: "Inscrição em Prova Avulsa (Corrida)", valor: 289, versao: null, ativo: true },
    { id: "nut27", nome: "Nutrição - 8 consultas", valor: 2400, versao: 2027, ativo: true },
  ];
  const visiveis = filtrarLegadoVendavel<any>(servicos as any, HOJE);
  it("Recovery R$ 50 e Inscrição em Prova Avulsa aparecem", () => {
    expect(visiveis.find((s: any) => s.id === "rec")?.valor).toBe(50);
    expect(visiveis.map((s: any) => s.id)).toContain("prova");
  });
  it("pacotes 2027 não aparecem", () => {
    expect(visiveis.map((s: any) => s.id)).not.toContain("nut27");
  });
});
