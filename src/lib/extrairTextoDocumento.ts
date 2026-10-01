/** Extração de texto de PDF e DOCX no navegador. */

export const TAMANHO_MAX_BYTES = 15 * 1024 * 1024;

async function extrairPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const paginas: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Ordena por posição (de cima para baixo, da esquerda para a direita) e agrupa por linha.
    // Sem isso, PDFs em tabela (ex.: Extrato Mensal da folha) saem fora da ordem de leitura.
    const itens = (content.items as { str?: string; transform?: number[]; width?: number }[])
      .filter((it) => (it.str ?? "") !== "")
      .map((it) => ({ s: it.str ?? "", x: it.transform?.[4] ?? 0, y: it.transform?.[5] ?? 0, w: it.width ?? 0 }));
    itens.sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));
    const linhas: string[] = [];
    let atual: typeof itens = [];
    let yLinha: number | null = null;
    const fechar = () => {
      if (atual.length) {
        // Só insere espaço quando há distância real entre os pedaços — alguns PDFs vêm letra por letra.
        atual.sort((a, b) => a.x - b.x);
        let txt = "", fimAnt: number | null = null;
        for (const i of atual) {
          if (fimAnt !== null && i.x - fimAnt > 1.5 && !txt.endsWith(" ") && !i.s.startsWith(" ")) txt += " ";
          txt += i.s;
          fimAnt = i.x + i.w;
        }
        linhas.push(txt.replace(/\s+/g, " ").trim());
      }
      atual = [];
    };
    for (const it of itens) {
      if (yLinha !== null && Math.abs(it.y - yLinha) > 3) fechar();
      if (!atual.length) yLinha = it.y;
      atual.push(it);
    }
    fechar();
    paginas.push(linhas.join("\n"));
  }

  return paginas.join("\n\n");
}

async function extrairDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return value ?? "";
}

/** Lê o texto de um arquivo PDF ou DOCX. Lança erro com mensagem amigável. */
export async function extrairTextoDocumento(file: File): Promise<string> {
  if (file.size > TAMANHO_MAX_BYTES) {
    throw new Error("Arquivo muito grande. O limite é de 15 MB.");
  }
  const nome = file.name.toLowerCase();
  let texto = "";
  if (nome.endsWith(".pdf")) texto = await extrairPdf(file);
  else if (nome.endsWith(".docx")) texto = await extrairDocx(file);
  else throw new Error("Formato não aceito. Envie um arquivo PDF ou Word (.docx).");

  if (texto.replace(/\s/g, "").length < 30) {
    throw new Error(
      "Não foi possível ler o texto deste arquivo. Se for um documento digitalizado (imagem), use uma versão com texto.",
    );
  }
  return texto;
}
