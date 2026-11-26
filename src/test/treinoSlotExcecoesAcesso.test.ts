import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const original = readFileSync("drizzle/migrations/0302_treino_slot_excecoes.sql", "utf8");
const correction = readFileSync("drizzle/migrations/0305_treino_slot_excecoes_leitura_aluno_vinculado.sql", "utf8");
const studentPolicy = original.slice(original.indexOf('CREATE POLICY "aluno_read_treino_slot_excecoes"'), original.indexOf("CREATE OR REPLACE FUNCTION"));

function requiresStudentLink(policy: string): boolean {
  return /USING\s*\(EXISTS\s*\(/i.test(policy)
    && /FROM public\.alunos AS aluno/.test(policy)
    && /aluno\.user_id\s*=\s*\(SELECT auth\.uid\(\)\)/.test(policy)
    && /aluno\.is_equipe\s*=\s*false/.test(policy);
}

describe("schedule exception access regression", () => {
  it("rejects the original sign-in-only rule and requires a linked student", () => {
    expect(requiresStudentLink(studentPolicy)).toBe(false);
    expect(requiresStudentLink(correction)).toBe(true);
    expect(correction).not.toContain("auth.uid() IS NOT NULL");
  });

  it("changes only the selected read policy, preserving staff and write access", () => {
    expect(correction).toMatch(/ALTER POLICY aluno_read_treino_slot_excecoes ON public\.treino_slot_excecoes/);
    expect(correction).toContain("TO authenticated");
    expect(correction).not.toMatch(/(?:DROP|ALTER|CREATE)\s+(?:TABLE|FUNCTION|TRIGGER)/i);
    expect(correction).not.toContain("staff_all_treino_slot_excecoes");
    expect(correction).not.toMatch(/created_by\s*=|WITH CHECK|GRANT/i);
  });
});