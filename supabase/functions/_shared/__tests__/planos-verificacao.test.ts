import { describe, it, expect } from "vitest";
import { cpfDigitosValidos, mascararEmail, gerarCodigo, hashCodigo, semCpf, podeEnviarCodigo, corpoEmailCodigo } from "../planos-verificacao";

describe("identificação /planos", () => {
  it("valida dígitos do CPF", () => {
    expect(cpfDigitosValidos("015.743.080-41")).toBe(true);
    expect(cpfDigitosValidos("01574308042")).toBe(false);
    expect(cpfDigitosValidos("11111111111")).toBe(false);
    expect(cpfDigitosValidos("123")).toBe(false);
  });
  it("mascara o e-mail como n*****@gmail.com", () => {
    expect(mascararEmail("nicolas@gmail.com")).toBe("n*****@gmail.com");
  });
  it("código tem 6 dígitos e hash depende da verificação", async () => {
    expect(gerarCodigo(() => 42)).toBe("000042");
    const a = await hashCodigo("id-1", "123456");
    expect(a).toHaveLength(64);
    expect(a).not.toBe(await hashCodigo("id-2", "123456"));
    expect(a).not.toContain("123456");
  });
  it("remove CPF de textos de log", () => {
    expect(semCpf("cpf 015.743.080-41 e 01574308041")).not.toMatch(/0157430804/);
  });
  it("só envia ao aluno de teste enquanto o envio não for liberado", () => {
    expect(podeEnviarCodigo("a", false, ["a"])).toBe(true);
    expect(podeEnviarCodigo("b", false, ["a"])).toBe(false);
    expect(podeEnviarCodigo("b", true, [])).toBe(true);
  });
  it("assunto do e-mail traz o código", () => {
    expect(corpoEmailCodigo("123456").assunto).toBe("Seu código FORTEM: 123456");
  });
});

import { respostaEnvioPublica, respostaValidacaoPublica } from "../planos-verificacao";
describe("cadastro único /planos — anti-enumeração", () => {
  const idFalso = "00000000-0000-4000-8000-000000000000";
  it("CPF existente e inexistente respondem com as mesmas chaves e sem e-mail", () => {
    const existe = respostaEnvioPublica({ enviado: true, verificacao_id: "abc", email_mascarado: "n*****@gmail.com" }, idFalso);
    const naoExiste = respostaEnvioPublica({ enviado: false, motivo: "indisponivel" }, idFalso);
    const semEmail = respostaEnvioPublica({ enviado: false, motivo: "sem_email" }, idFalso);
    expect(Object.keys(existe).sort()).toEqual(Object.keys(naoExiste).sort());
    expect(Object.keys(semEmail).sort()).toEqual(Object.keys(naoExiste).sort());
    expect(JSON.stringify(existe)).not.toContain("@");
    expect(naoExiste).toEqual({ enviado: true, verificacao_id: idFalso });
  });
  it("só o limite de tentativas tem resposta diferente", () => {
    expect(respostaEnvioPublica({ enviado: false, motivo: "limitado" }, idFalso)).toEqual({ enviado: false, motivo: "limitado" });
  });
  it("validar uma verificação inexistente parece código errado", () => {
    expect(respostaValidacaoPublica({ ok: false, motivo: "invalido" })).toEqual({ ok: false, motivo: "errado", restantes: 4 });
    expect(respostaValidacaoPublica({ ok: false, motivo: "errado", restantes: 4 })).toEqual({ ok: false, motivo: "errado", restantes: 4 });
    expect(respostaValidacaoPublica({ ok: true })).toEqual({ ok: true });
  });
});
