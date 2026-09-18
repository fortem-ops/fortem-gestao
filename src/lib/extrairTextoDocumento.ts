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
    let ultimoY: number | null = null;
    let linha = "";
    const linhas: string[] = [];
    for (const item of content.items as { str?: string; transform?: number[] }[]) {
      const texto = item.str ?? "";
      const y = item.transform?.[5] ?? null;
      if (ultimoY !== null && y !== null && Math.abs(y - ultimoY) > 3) {
        linhas.push(linha.trim());
        linha = "";
      }
      linha += texto;
      if (y !== null) ultimoY = y;
    }
    if (linha.trim()) linhas.push(linha.trim());
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
