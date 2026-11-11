import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Regras da Etapa 4 do Plano Semestral. O ensaio completo no banco fica em
// scripts/semestral-renovacao.regression.sql (rodado à parte, sempre revertido).
const mig = readFileSync("drizzle/migrations/0264_semestral_renovacao_cartao.sql", "utf8");
const creditos = readFileSync("drizzle/migrations/0265_semestral_creditos_sem_acumulo.sql", "utf8");
const cancelar = readFileSync("drizzle/migrations/0266_semestral_cancelar_contagem.sql", "utf8");
const cron = readFileSync("supabase/functions/renovar-planos-mensais/index.ts", "utf8");

function corpo(sql: string, fn: string): string {
  const i = sql.indexOf(`FUNCTION public.${fn}(`);
  expect(i).toBeGreaterThanOrEqual(0);
  return sql.slice(i, sql.indexOf("END $$;", i));
}

describe("Plano Semestral — renovação mensal", () => {
  it("ciclo n vence 30 dias após o anterior, contado da venda", () => {
    expect(corpo(mig, "fn_semestral_gerar_mensalidade")).toContain("v_venc := k.data_inicio + 30 * (p_n - 1);");
  });

  it("não duplica: mensalidade só nasce se ainda não existe cobrança ou mensalidade do ciclo", () => {
    const f = corpo(mig, "fn_semestral_gerar_mensalidade");
    expect(f).toContain("WHERE contrato_id = k.id AND numero_ciclo = p_n");
    expect(f).toContain("WHERE venda_origem_id = p_venda AND numero = p_n");
  });

  it("preço fixo nos ciclos 1..preco_fixo_ciclos; depois, valor do contrato", () => {
    const f = corpo(mig, "fn_semestral_valor_ciclo");
    expect(f).toContain("IF p_n <= COALESCE(v_fixo, 0) AND v_venda IS NOT NULL THEN RETURN v_venda; END IF;");
    expect(f).toContain("RETURN k.valor_cobrado;");
  });

  it("créditos só no pagamento e sem acúmulo", () => {
    const f = corpo(creditos, "fn_semestral_liberar_ciclo");
    expect(f).toContain("IF NEW.status IS DISTINCT FROM 'pago' OR OLD.status = 'pago'");
    expect(f).toContain("UPDATE public.creditos_aluno SET ativo = false");
  });

  it("cancelamento: só admin, sem multa, mensalidades futuras canceladas", () => {
    const f = corpo(cancelar, "fn_semestral_cancelar");
    expect(f).toContain("NOT public.is_admin(auth.uid())");
    expect(f).toContain("multa_percentual = 0");
    expect(f).toContain("UPDATE public.planos_2027_mensalidades SET status = 'cancelado'");
    expect(corpo(mig, "fn_semestral_gerar_mensalidade")).toContain("k.data_cancelamento IS NOT NULL");
  });

  it("rotina diária chama o Semestral e a renovação do Start segue só Start/Consultoria", () => {
    expect(cron).toContain('supabase.rpc("fn_semestral_diario"');
    expect(cron).toContain('.in("planos_catalogo.familia", ["start_2027", "consultoria_2027"])');
  });

  it("Pix Automático desligado para o Semestral", () => {
    expect(corpo(mig, "fn_semestral_pix_guarda")).toContain("'semestral_pix_automatico_ativo'");
  });
});
