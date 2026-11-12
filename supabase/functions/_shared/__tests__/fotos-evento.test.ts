import { describe, expect, it } from "vitest";
import {
  alertaModeracao, arquivoValido, colecaoDoSlug, colecaoValida, decodificarSelfie, fotoPublica, fotosDosMatches,
  normalizarWhatsapp, orientacao, resultadoIndexacao, retencaoVencida, MAX_BYTES_ARQUIVO, MAX_FOTOS_ENVIO,
  LIMITE_BUSCAS_HORA, LIMITE_ENVIOS_HORA, LIMIAR_BUSCA, MAX_ROSTOS_BUSCA, MIN_CONFIANCA_MODERACAO,
} from "../fotos-evento";
import { assinar } from "../rekognition";

describe("fotos de eventos — regras do dono", () => {
  it("parâmetros da AWS e limites pedidos", () => {
    expect(LIMIAR_BUSCA).toBe(90); expect(MAX_ROSTOS_BUSCA).toBe(100); expect(MIN_CONFIANCA_MODERACAO).toBe(70);
    expect(MAX_FOTOS_ENVIO).toBe(30); expect(LIMITE_BUSCAS_HORA).toBe(10); expect(LIMITE_ENVIOS_HORA).toBe(3);
    expect(MAX_BYTES_ARQUIVO).toBe(15 * 1024 * 1024);
  });
  it("coleção sempre com prefixo fortem-", () => {
    expect(colecaoDoSlug("10anos")).toBe("fortem-evento-10anos");
    expect(colecaoValida("fortem-evento-10anos")).toBe(true);
    expect(colecaoValida("outra-colecao")).toBe(false);
  });
  it("foto sem rosto vira sem_rosto; vários rostos geram um id por rosto", () => {
    expect(resultadoIndexacao([])).toEqual({ status: "sem_rosto", faceIds: [] });
    expect(resultadoIndexacao([{ Face: { FaceId: "a" } }, { Face: { FaceId: "b" } }, { Face: { FaceId: "c" } }]))
      .toEqual({ status: "indexada", faceIds: ["a", "b", "c"] });
  });
  it("busca sem correspondência devolve lista vazia", () => {
    expect(fotosDosMatches([])).toEqual([]);
    expect(fotosDosMatches(undefined)).toEqual([]);
  });
  it("busca não repete foto com vários rostos da mesma pessoa e ignora abaixo de 90", () => {
    expect(fotosDosMatches([
      { Similarity: 95, Face: { ExternalImageId: "f1" } }, { Similarity: 99, Face: { ExternalImageId: "f2" } },
      { Similarity: 97, Face: { ExternalImageId: "f1" } }, { Similarity: 89.9, Face: { ExternalImageId: "f3" } },
    ])).toEqual(["f2", "f1"]);
  });
  it("foto pendente ou rejeitada não aparece ao público", () => {
    expect(fotoPublica({ status_moderacao: "pendente", status_indexacao: "indexada", upload_concluido: true })).toBe(false);
    expect(fotoPublica({ status_moderacao: "rejeitada", status_indexacao: "indexada", upload_concluido: true })).toBe(false);
    expect(fotoPublica({ status_moderacao: "aprovada", status_indexacao: "pendente", upload_concluido: true })).toBe(false);
    expect(fotoPublica({ status_moderacao: "aprovada", status_indexacao: "sem_rosto", upload_concluido: true })).toBe(true);
  });
  it("moderação assistida só sinaliza rótulos com 70% ou mais", () => {
    expect(alertaModeracao([{ Name: "X", Confidence: 69.9 }])).toEqual({ alerta: false, rotulos: [] });
    expect(alertaModeracao([{ Name: "X", ParentName: "Y", Confidence: 80 }]).alerta).toBe(true);
  });
  it("arquivos: JPEG/PNG/HEIC até 15 MB", () => {
    expect(arquivoValido({ tipo: "image/heic", tamanho: 1000 })).toBe(true);
    expect(arquivoValido({ tipo: "image/gif", tamanho: 1000 })).toBe(false);
    expect(arquivoValido({ tipo: "image/jpeg", tamanho: MAX_BYTES_ARQUIVO + 1 })).toBe(false);
  });
  it("WhatsApp normalizado com 55", () => {
    expect(normalizarWhatsapp("(51) 99999-8888")).toBe("5551999998888");
    expect(normalizarWhatsapp("123")).toBeNull();
  });
  it("orientação", () => { expect(orientacao(3000, 2000)).toBe("horizontal"); expect(orientacao(2000, 3000)).toBe("vertical"); });
  it("retenção de 90 dias conta da data do evento (Brasília)", () => {
    expect(retencaoVencida("2026-11-14", 90, new Date("2027-02-12T02:59:00Z"))).toBe(false);
    expect(retencaoVencida("2026-11-14", 90, new Date("2027-02-12T03:00:00Z"))).toBe(true);
  });
  it("selfie: só JPEG/PNG em base64", () => {
    const jpeg = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 1, 2));
    expect(decodificarSelfie(jpeg)?.length).toBe(6);
    expect(decodificarSelfie("data:image/jpeg;base64," + jpeg)).not.toBeNull();
    expect(decodificarSelfie(btoa("GIF89a"))).toBeNull();
    expect(decodificarSelfie(42)).toBeNull();
  });
  it("assinatura SigV4 determinística e sem expor a chave secreta", async () => {
    const cred = { accessKeyId: "AKIDEXEMPLO", secretAccessKey: "segredo-de-teste", region: "us-east-1" };
    const d = new Date("2026-11-14T12:00:00Z");
    const a = await assinar(cred, "rekognition", "RekognitionService.ListCollections", "{}", d);
    const b = await assinar(cred, "rekognition", "RekognitionService.ListCollections", "{}", d);
    expect(a.headers.authorization).toBe(b.headers.authorization);
    expect(a.url).toBe("https://rekognition.us-east-1.amazonaws.com/");
    expect(a.headers["x-amz-date"]).toBe("20261114T120000Z");
    expect(a.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXEMPLO\/20261114\/us-east-1\/rekognition\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/);
    expect(JSON.stringify(a)).not.toContain("segredo-de-teste");
  });
});
