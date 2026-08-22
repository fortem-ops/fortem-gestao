import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";

// --- mocks -----------------------------------------------------------------

const toast = {
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
};
vi.mock("sonner", () => ({ toast }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "avaliador-1" } }),
}));

const uploadAndParseKinology = vi.fn();
const persistirForcaNaData = vi.fn();
const listarDatasForcaExistentes = vi.fn();

vi.mock("@/lib/kinologyImport", async () => {
  const actual = await vi.importActual<typeof import("@/lib/kinologyImport")>(
    "@/lib/kinologyImport",
  );
  return {
    ...actual,
    uploadAndParseKinology: (...a: unknown[]) => uploadAndParseKinology(...a),
    persistirForcaNaData: (...a: unknown[]) => persistirForcaNaData(...a),
    listarDatasForcaExistentes: (...a: unknown[]) => listarDatasForcaExistentes(...a),
  };
});

// Importado depois dos mocks.
const { PremiumKinologyImport } = await import("../PremiumKinologyImport");

// --- helpers ---------------------------------------------------------------

const ALUNO = "aluno-1";

function ex(nome: string, d: number, e: number, data?: string) {
  return { nome, direito_kg: d, esquerdo_kg: e, ...(data ? { data } : {}) };
}

function parseResult(over: Record<string, unknown> = {}) {
  return {
    paciente: "Carla",
    dataEmissao: "17/08/2026",
    exercicios: [ex("Agachamento", 30, 27, "17/08/2026")],
    historico: [],
    laudoPath: "avaliacoes/laudos-dinamometria/aluno-1/1-laudo.pdf",
    source: "deterministic" as const,
    ...over,
  };
}

async function uploadPdf(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["%PDF-1.4"], "laudo.pdf", { type: "application/pdf" });
  await user.upload(input, file);
}

beforeEach(() => {
  vi.clearAllMocks();
  persistirForcaNaData.mockResolvedValue("insert");
  listarDatasForcaExistentes.mockResolvedValue(new Set<string>());
});

// --- testes ----------------------------------------------------------------

describe("PremiumKinologyImport", () => {
  it("a) sem exercícios reconhecidos: avisa e não grava nada", async () => {
    const user = userEvent.setup();
    uploadAndParseKinology.mockResolvedValue(parseResult({ exercicios: [], historico: [] }));

    renderWithProviders(<PremiumKinologyImport alunoId={ALUNO} />);
    await uploadPdf(user);

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(toast.warning.mock.calls[0][0]).toMatch(/Nenhum exercício reconhecido/i);
    expect(persistirForcaNaData).not.toHaveBeenCalled();
    expect(screen.queryByText(/Datas encontradas no laudo/i)).not.toBeInTheDocument();
  });

  it("b) uma única data: grava direto, sem diálogo", async () => {
    const user = userEvent.setup();
    uploadAndParseKinology.mockResolvedValue(
      parseResult({
        historico: [{ data: "17/08/2026", exercicios: [ex("Agachamento", 30, 27)] }],
      }),
    );

    renderWithProviders(<PremiumKinologyImport alunoId={ALUNO} />);
    await uploadPdf(user);

    await waitFor(() => expect(persistirForcaNaData).toHaveBeenCalledTimes(1));
    const arg = persistirForcaNaData.mock.calls[0][0];
    expect(arg).toMatchObject({
      alunoId: ALUNO,
      avaliadorId: "avaliador-1",
      dataISO: "2026-08-17", // data da própria medição, não hoje
    });
    expect(arg.forcaPayload.exercicios).toHaveLength(1);
    expect(screen.queryByText(/Datas encontradas no laudo/i)).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it("b2) sem histórico algum: também grava direto usando a data da medição", async () => {
    const user = userEvent.setup();
    uploadAndParseKinology.mockResolvedValue(parseResult({ historico: [] }));

    renderWithProviders(<PremiumKinologyImport alunoId={ALUNO} />);
    await uploadPdf(user);

    await waitFor(() => expect(persistirForcaNaData).toHaveBeenCalledTimes(1));
    expect(persistirForcaNaData.mock.calls[0][0].dataISO).toBe("2026-08-17");
  });

  it("c) múltiplas datas: abre diálogo, marca 'já registrado' e grava as selecionadas", async () => {
    const user = userEvent.setup();
    uploadAndParseKinology.mockResolvedValue(
      parseResult({
        historico: [
          { data: "20/03/2025", exercicios: [ex("Agachamento", 20, 18)] },
          {
            data: "17/08/2026",
            exercicios: [ex("Agachamento", 30, 27), ex("Remada", 25, 25)],
          },
        ],
      }),
    );
    // a data mais recente já tem força registrada
    listarDatasForcaExistentes.mockResolvedValue(new Set(["2026-08-17"]));

    renderWithProviders(<PremiumKinologyImport alunoId={ALUNO} />);
    await uploadPdf(user);

    await screen.findByText(/Datas encontradas no laudo/i);
    expect(persistirForcaNaData).not.toHaveBeenCalled();

    // rótulos e contagens
    expect(screen.getByText("20/03/2025")).toBeInTheDocument();
    expect(screen.getByText(/já registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/2 exercício\(s\)/)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    // só a data nova vem marcada
    const marcados = checkboxes.filter((c) => c.getAttribute("data-state") === "checked");
    expect(marcados).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /Importar 1 data/i }));

    await waitFor(() => expect(persistirForcaNaData).toHaveBeenCalledTimes(1));
    const arg = persistirForcaNaData.mock.calls[0][0];
    expect(arg.dataISO).toBe("2025-03-20");
    expect(arg.forcaPayload.exercicios).toHaveLength(1);
  });

  it("c2) override manual de data vale só para a medição mais recente", async () => {
    const user = userEvent.setup();
    uploadAndParseKinology.mockResolvedValue(
      parseResult({
        historico: [
          { data: "20/03/2025", exercicios: [ex("Agachamento", 20, 18)] },
          { data: "17/08/2026", exercicios: [ex("Agachamento", 30, 27)] },
        ],
      }),
    );

    renderWithProviders(<PremiumKinologyImport alunoId={ALUNO} />);

    // usuário edita manualmente o campo de data
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, "2026-08-01");

    await uploadPdf(user);
    await screen.findByText(/Datas encontradas no laudo/i);

    // a medição mais recente aparece com a data sobrescrita; a antiga, intacta
    expect(screen.getByText("01/08/2026")).toBeInTheDocument();
    expect(screen.getByText("20/03/2025")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Importar 2 data/i }));

    await waitFor(() => expect(persistirForcaNaData).toHaveBeenCalledTimes(2));
    const datas = persistirForcaNaData.mock.calls.map((c) => c[0].dataISO).sort();
    expect(datas).toEqual(["2025-03-20", "2026-08-01"]);
  });
});
