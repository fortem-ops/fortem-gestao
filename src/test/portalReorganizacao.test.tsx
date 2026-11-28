// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  montarParceirosAtivosComBeneficios,
  filtrarParceiros,
  contarDiasComTreinoNoMes,
  textoRecompensaDesafio,
  grupoDaConquista,
  calcularProximaConquista,
  resolverDestinoMeuPerfil,
  type BadgePortal,
} from "@/lib/portalReorganizacao";
import PortalParceiros from "@/pages/portal/PortalParceiros";

vi.mock("@/hooks/useParceirosPortal", () => ({
  useParceirosPortal: () => ({
    isLoading: false,
    data: [
      {
        id: "p1",
        nome: "UMANA - CASA RIO BRANCO",
        categoria: "YÔGA",
        descricao: null,
        logo_url: null,
        ativo: true,
        beneficios: [{ id: "b1", parceiro_id: "p1", titulo: "10% de desconto", regra_uso: "1x por mês", ativo: true }],
      },
      {
        id: "p2",
        nome: "FERRÃO BARBEARIA",
        categoria: "Barbearia",
        descricao: null,
        logo_url: null,
        ativo: true,
        beneficios: [{ id: "b2", parceiro_id: "p2", titulo: "Corte com 15% OFF", regra_uso: null, ativo: true }],
      },
    ],
  }),
}));

describe("portalReorganizacao — helpers", () => {
  it("oculta parceiros inativos e parceiros ativos sem benefício ativo", () => {
    const res = montarParceirosAtivosComBeneficios(
      [
        { id: "1", nome: "UMANA", categoria: "YÔGA", descricao: null, logo_url: null, ativo: true },
        { id: "2", nome: "PRESS", categoria: "Restaurantes", descricao: null, logo_url: null, ativo: true },
        { id: "3", nome: "Teste", categoria: "Alimentação", descricao: null, logo_url: null, ativo: false },
      ],
      [
        { id: "b1", parceiro_id: "1", titulo: "10% OFF", regra_uso: null, ativo: true },
        { id: "b2", parceiro_id: "2", titulo: "Inativo", regra_uso: null, ativo: false },
        { id: "b3", parceiro_id: "3", titulo: "Ativo em inativo", regra_uso: null, ativo: true },
      ],
    );
    expect(res.map((p) => p.nome)).toEqual(["UMANA"]);
  });

  it("filtra parceiros por busca e categoria", () => {
    const base = montarParceirosAtivosComBeneficios(
      [
        { id: "1", nome: "UMANA", categoria: "YÔGA", descricao: null, logo_url: null, ativo: true },
        { id: "2", nome: "FERRÃO BARBEARIA", categoria: "Barbearia", descricao: null, logo_url: null, ativo: true },
      ],
      [
        { id: "b1", parceiro_id: "1", titulo: "Aula experimental", regra_uso: null, ativo: true },
        { id: "b2", parceiro_id: "2", titulo: "15% OFF", regra_uso: null, ativo: true },
      ],
    );
    expect(filtrarParceiros(base, "barbearia", "todas").map((p) => p.id)).toEqual(["2"]);
    expect(filtrarParceiros(base, "", "YÔGA").map((p) => p.id)).toEqual(["1"]);
  });

  it("conta dias distintos com treino no mês (não duplica dois treinos no mesmo dia)", () => {
    const datas = ["2026-11-01", "2026-11-01", "2026-11-03", "2026-10-29"];
    expect(contarDiasComTreinoNoMes(datas, "2026-11")).toBe(2);
  });

  it("retorna recompensa do desafio coletivo uma única vez", () => {
    expect(
      textoRecompensaDesafio({ mensagem_recompensa: "Todos ganham 100 pts.", pontos_recompensa: 100 }),
    ).toBe("Todos ganham 100 pts.");
    expect(
      textoRecompensaDesafio({ mensagem_recompensa: null, pontos_recompensa: 50 }),
    ).toContain("50 pontos");
  });

  it("agrupa conquistas nas 3 categorias e calcula a próxima conquista com segurança", () => {
    expect(grupoDaConquista("treinos_10")).toBe("treinos");
    expect(grupoDaConquista("nutri_4")).toBe("nutricao_reab");
    expect(grupoDaConquista("reab_1")).toBe("nutricao_reab");
    expect(grupoDaConquista("avaliacao_1")).toBe("avaliacao_fortem");
    expect(grupoDaConquista("lenda")).toBe("avaliacao_fortem");

    const badges: BadgePortal[] = [
      { id: "1", codigo: "primeiro_treino", nome: "Primeiro Passo", descricao: null, conquistado: true },
      { id: "2", codigo: "treinos_10", nome: "10 Treinos", descricao: null, conquistado: false },
      { id: "3", codigo: "sequencia_30", nome: "8 Semanas Seguidas", descricao: null, conquistado: false },
    ];
    expect(calcularProximaConquista(badges, 7, 2, false)).toEqual({ nome: "10 Treinos", faltam: 3 });
    expect(calcularProximaConquista(badges, 7, 7, false)).toEqual({ nome: "8 Semanas Seguidas", faltam: 1 });
    expect(calcularProximaConquista(badges, 7, 7, true)).toEqual({ nome: "10 Treinos", faltam: 3 });
  });

  it("resolve redirecionamentos de /portal/meu-perfil", () => {
    expect(resolverDestinoMeuPerfil(null)).toBe("/portal/avaliacoes?aba=frequencia");
    expect(resolverDestinoMeuPerfil("progresso")).toBe("/portal/avaliacoes?aba=frequencia");
    expect(resolverDestinoMeuPerfil("conquistas")).toBe("/portal/avaliacoes?aba=conquistas");
    expect(resolverDestinoMeuPerfil("clubes")).toBe("/portal/comunidade?aba=clubes");
  });
});

describe("PortalParceiros — interface", () => {
  it("renderiza parceiros com benefícios, carteirinha, rodapé e filtra por categoria", () => {
    render(
      <MemoryRouter>
        <PortalParceiros />
      </MemoryRouter>,
    );
    expect(screen.getByText("UMANA - CASA RIO BRANCO")).toBeTruthy();
    expect(screen.getByText("FERRÃO BARBEARIA")).toBeTruthy();
    expect(screen.getByText(/Use a sua carteirinha/i)).toBeTruthy();
    expect(screen.getByText(/Os benefícios valem para alunos com plano FORTEM ativo/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Barbearia" }));
    expect(screen.queryByText("UMANA - CASA RIO BRANCO")).toBeNull();
    expect(screen.getByText("FERRÃO BARBEARIA")).toBeTruthy();
  });
});