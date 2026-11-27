// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AvisoDocumentosPendentes } from "@/components/portal/AvisoDocumentosPendentes";

describe("aviso de documentos na tela inicial do portal", () => {
  it("aparece com pendências, leva à revisão e some quando todos são aceitos", () => {
    const { rerender } = render(
      <MemoryRouter>
        <AvisoDocumentosPendentes contratosPendentes={2} anexoPendente={false} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Revisar e aceitar documentos" });
    expect(link).toHaveAttribute("href", "/portal/contratos");
    expect(link).toHaveTextContent("2 contratos");

    rerender(
      <MemoryRouter>
        <AvisoDocumentosPendentes contratosPendentes={0} anexoPendente={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Revisar e aceitar documentos" })).not.toBeInTheDocument();
  });

  it("mantém o aviso do Anexo I mesmo sem contrato pendente", () => {
    render(
      <MemoryRouter>
        <AvisoDocumentosPendentes contratosPendentes={0} anexoPendente />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Revisar e aceitar documentos" })).toHaveTextContent("Anexo I");
  });
});
