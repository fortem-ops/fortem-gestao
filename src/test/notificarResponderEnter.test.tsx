import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// ---- mocks ----------------------------------------------------------------
const addComentarioSpy = vi.fn(async (_input: any) => undefined);
const getAnexoUrlSpy = vi.fn(async (_path: any) => null);
const markVisualizadaSpy = vi.fn(async (_id: any, _u: any) => undefined);
const updateStatusSpy = vi.fn(async (..._a: any[]) => ({ error: null }));

vi.mock("@/lib/notificar", () => ({
  addComentario: (input: any) => addComentarioSpy(input),
  getAnexoUrl: (path: any) => getAnexoUrlSpy(path),
  markVisualizada: (id: any, u: any) => markVisualizadaSpy(id, u),
  updateStatus: (...a: any[]) => updateStatusSpy(...a),
  NOTIF_STATUS: [
    { value: "enviada", label: "Enviada", className: "" },
    { value: "visualizada", label: "Visualizada", className: "" },
    { value: "concluida", label: "Concluída", className: "" },
    { value: "arquivada", label: "Arquivada", className: "" },
  ],
  NOTIF_PRIORIDADES: [
    { value: "normal", label: "Normal", className: "" },
    { value: "alta", label: "Alta", className: "" },
    { value: "urgente", label: "Urgente", className: "" },
  ],
  NOTIF_CATEGORIAS: [{ value: "geral", label: "Geral" }],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "equipe@fortem.com" } }),
}));

vi.mock("@/contexts/NotifChatContext", () => ({
  useNotifChat: () => ({ minimize: vi.fn(), dismiss: vi.fn() }),
}));

const notif = {
  id: "n1",
  titulo: "Ajuste de carga",
  descricao: "Conversar sobre a periodização.",
  categoria: "geral",
  prioridade: "alta",
  tipo: "mensagem",
  status: "enviada",
  criado_por: "u2",
  prazo: null,
  aluno_id: null,
  reuniao_data: null,
  reuniao_local: null,
  created_at: "2026-10-26T10:00:00Z",
};

const comentarioMultilinha = {
  id: "c1",
  notificacao_id: "n1",
  usuario_id: "u2",
  comentario: "Linha1\nLinha2",
  anexo_url: null,
  anexo_tipo: null,
  anexo_nome: null,
  created_at: "2026-10-26T10:05:00Z",
};

vi.mock("@/hooks/useNotificacoes", () => ({
  useNotificacaoDetail: () => ({
    data: { notif, dests: [], coments: [comentarioMultilinha], hist: [] },
    isLoading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq", "in", "is", "neq", "order", "limit", "range", "insert", "delete", "filter"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.update = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  chain.single = vi.fn(async () => ({ data: null, error: null }));
  return {
    supabase: {
      from: vi.fn(() => chain),
      channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })) })),
      removeChannel: vi.fn(),
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })),
        getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1" } } } })),
      },
    },
  };
});

import { NotificacaoDetail } from "@/components/notificar/NotificacaoDetail";
import { NotificacaoChatWindow } from "@/components/notificar/NotificacaoChatWindow";

const PH_DETAIL = "Responder... (Enter envia · Shift+Enter nova linha · Ctrl+V cola imagem)";
const PH_CHAT = "Mensagem... (Enter envia · Shift+Enter nova linha · Ctrl+V cola imagem)";

function renderWithUi(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  addComentarioSpy.mockClear();
  markVisualizadaSpy.mockClear();
});

describe("campo de resposta do detalhe da notificação", () => {
  it("usa Textarea de 1 linha, sem redimensionador manual, com o novo placeholder", () => {
    renderWithUi(<NotificacaoDetail id="n1" />);
    const ta = screen.getByPlaceholderText(PH_DETAIL) as HTMLTextAreaElement;
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta.rows).toBe(1);
    expect(ta.className).toContain("resize-none");
    expect(ta.className).toContain("max-h-[136px]");
    expect(ta.className).toContain("overflow-y-auto");
  });

  it("Enter envia a resposta, impede a quebra padrão e limpa o campo", async () => {
    renderWithUi(<NotificacaoDetail id="n1" />);
    const ta = screen.getByPlaceholderText(PH_DETAIL) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Oi\nTudo bem?" } });
    const naoImpedido = fireEvent.keyDown(ta, { key: "Enter", shiftKey: false });
    expect(naoImpedido).toBe(false); // preventDefault chamado
    await waitFor(() =>
      expect(addComentarioSpy).toHaveBeenCalledWith(
        expect.objectContaining({ notificacaoId: "n1", comentario: "Oi\nTudo bem?" }),
      ),
    );
    expect(ta.value).toBe("");
  });

  it("Shift+Enter NÃO envia e deixa o navegador inserir a nova linha", () => {
    renderWithUi(<NotificacaoDetail id="n1" />);
    const ta = screen.getByPlaceholderText(PH_DETAIL) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Alpha" } });
    const naoImpedido = fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
    expect(naoImpedido).toBe(true); // sem preventDefault
    expect(addComentarioSpy).not.toHaveBeenCalled();
  });

  it("Enter durante composição de IME não envia", () => {
    renderWithUi(<NotificacaoDetail id="n1" />);
    const ta = screen.getByPlaceholderText(PH_DETAIL) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "X" } });
    const naoImpedido = fireEvent.keyDown(ta, { key: "Enter", isComposing: true });
    expect(naoImpedido).toBe(true);
    expect(addComentarioSpy).not.toHaveBeenCalled();
  });

  it("Enter com campo vazio e sem anexo não envia", () => {
    renderWithUi(<NotificacaoDetail id="n1" />);
    const ta = screen.getByPlaceholderText(PH_DETAIL) as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(addComentarioSpy).not.toHaveBeenCalled();
  });

  it("balão preserva as quebras de linha do comentário", () => {
    const { container } = renderWithUi(<NotificacaoDetail id="n1" />);
    const baloes = Array.from(container.querySelectorAll("div.whitespace-pre-wrap"));
    expect(baloes.some((el) => el.textContent === "Linha1\nLinha2")).toBe(true);
  });
});

describe("campo de resposta da janela flutuante", () => {
  const abre = () =>
    renderWithUi(
      <MemoryRouter>
        <NotificacaoChatWindow id="n1" offsetIndex={0} />
      </MemoryRouter>,
    );

  it("usa Textarea de 1 linha, sem redimensionador manual, com o novo placeholder", () => {
    abre();
    const ta = screen.getByPlaceholderText(PH_CHAT) as HTMLTextAreaElement;
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta.rows).toBe(1);
    expect(ta.className).toContain("resize-none");
    expect(ta.className).toContain("max-h-[132px]");
    expect(ta.className).toContain("overflow-y-auto");
  });

  it("Enter envia a resposta, impede a quebra padrão e limpa o campo", async () => {
    abre();
    const ta = screen.getByPlaceholderText(PH_CHAT) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Certo\nJá ajusto" } });
    const naoImpedido = fireEvent.keyDown(ta, { key: "Enter", shiftKey: false });
    expect(naoImpedido).toBe(false);
    await waitFor(() =>
      expect(addComentarioSpy).toHaveBeenCalledWith(
        expect.objectContaining({ notificacaoId: "n1", comentario: "Certo\nJá ajusto" }),
      ),
    );
    expect(ta.value).toBe("");
  });

  it("Shift+Enter NÃO envia e deixa o navegador inserir a nova linha", () => {
    abre();
    const ta = screen.getByPlaceholderText(PH_CHAT) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "Alpha" } });
    const naoImpedido = fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
    expect(naoImpedido).toBe(true);
    expect(addComentarioSpy).not.toHaveBeenCalled();
  });

  it("Enter durante composição de IME não envia", () => {
    abre();
    const ta = screen.getByPlaceholderText(PH_CHAT) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "X" } });
    const naoImpedido = fireEvent.keyDown(ta, { key: "Enter", isComposing: true });
    expect(naoImpedido).toBe(true);
    expect(addComentarioSpy).not.toHaveBeenCalled();
  });

  it("balão da janela preserva as quebras de linha do comentário", () => {
    const { container } = abre();
    const baloes = Array.from(container.querySelectorAll("div.whitespace-pre-wrap"));
    expect(baloes.some((el) => el.textContent === "Linha1\nLinha2")).toBe(true);
  });
});
