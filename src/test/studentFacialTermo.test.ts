import { describe, expect, it } from "vitest";
import { selecionarTermoFacial } from "@/components/student/StudentFacial";
import { TERMO_FACIAL_VERSAO, TERMO_FACIAL_TEXTO } from "@/lib/facialAluno";
import { VERSAO_RESPONSAVEL, TEXTO_RESPONSAVEL } from "../../supabase/functions/_shared/facial-responsavel-termo";

describe("termo registrado no cadastro facial do balcão", () => {
  it("mantém versão e termo completos da equipe independentemente da idade", () => {
    const equipe = selecionarTermoFacial("equipe", false);
    expect(equipe.versao).toBe("v1-provisoria-equipe");
    expect(equipe.texto).toBe("TERMO DE CONSENTIMENTO PARA USO DA IMAGEM DO ROSTO (EQUIPE). Eu autorizo a FORTEM a coletar e armazenar uma foto do meu rosto e a gerar dela os dados necessários para o reconhecimento facial na porta do estúdio, com a única finalidade de liberar a minha entrada. A foto e os dados do rosto não são compartilhados com terceiros nem usados para outra finalidade. Os registros de passagem (data e hora) ficam guardados no meu cadastro. Posso pedir a remoção do meu rosto a qualquer momento: o rosto é apagado da porta e a foto é apagada do sistema; o registro deste consentimento e das passagens permanece guardado para fins de comprovação. Este consentimento é válido enquanto eu fizer parte da equipe da FORTEM ou até que eu o revogue. (Texto provisório, a ser revisado por advogado.)");
    expect(selecionarTermoFacial("equipe", true)).toEqual(equipe);
  });

  it("adulto registra a mesma versão e texto integrais do app", () => {
    expect(selecionarTermoFacial("aluno", false)).toEqual({
      versao: TERMO_FACIAL_VERSAO,
      texto: TERMO_FACIAL_TEXTO,
    });
    expect(selecionarTermoFacial("aluno", false).versao).toBe("v1-provisoria");
  });

  it("menor ou sem nascimento registra o mesmo termo integral do responsável", () => {
    expect(selecionarTermoFacial("aluno", true)).toEqual({
      versao: VERSAO_RESPONSAVEL,
      texto: TEXTO_RESPONSAVEL,
    });
    expect(selecionarTermoFacial("aluno", true).versao).toBe("v1-provisoria-responsavel");
  });
});