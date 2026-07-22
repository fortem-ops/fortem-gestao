import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  PLANO_LABELS,
  FORMA_PAGAMENTO_LABELS,
  type PlanoTipo,
  type FormaPagamento,
} from "@/types/financeiro";
import type { Tables } from "@/integrations/supabase/types";

const db = supabase as any;

type Aluno = Tables<"alunos">;

interface ContratoDocLite {
  id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: Aluno;
  contratoDoc: ContratoDocLite | null;
  planoTipoAtual?: string | null;
}

const FORMAS_PRESENCIAL: FormaPagamento[] = [
  "cartao_recorrencia",
  "cartao_parcelado",
  "plataforma_agregadora",
];

const PLANOS_OPCOES: PlanoTipo[] = [
  "start",
  "start_plus",
  "power",
  "pro",
  "max",
  "corrida",
  "gympass",
  "wellhub",
  "totalpass",
  "outro",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(d: Date) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString();
}
function fmtBR(d: Date) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function mapPlanoTipoToEnum(tipo: string | null | undefined): PlanoTipo | null {
  if (!tipo) return null;
  const t = tipo.trim().toLowerCase();
  if (t === "start") return "start";
  if (t === "start+") return "start_plus";
  if (t === "power") return "power";
  if (t === "pro") return "pro";
  if (t === "max") return "max";
  if (t === "gympass/wellhub") return "gympass";
  if (t === "total pass") return "totalpass";
  if (t.startsWith("vip")) return "outro";
  return null;
}


function mergeAluno(html: string, student: Aluno, dataAssinatura: Date): { conteudo: string; vars: Record<string, string> } {
  const s = student as any;
  const endereco = [s.logradouro, s.numero].filter(Boolean).join(", ");
  const dataNasc = s.data_nascimento
    ? (() => {
        const d = new Date(s.data_nascimento + "T00:00:00");
        return fmtBR(d);
      })()
    : "";
  const vars: Record<string, string> = {
    NOME: s.nome ?? "",
    CPF: s.cpf ?? "",
    RG: s.rg ?? "",
    EMAIL: s.email ?? "",
    DATA_NASCIMENTO: dataNasc,
    ENDERECO: endereco,
    BAIRRO: s.bairro ?? "",
    CIDADE: s.cidade ?? "",
    UF: s.uf ?? "",
    CEP: s.cep ?? "",
    ASSINATURA: "Assinatura presencial",
    ACEITE: "Aceito (presencial)",
    DATA_ACEITE: fmtBR(dataAssinatura),
    FORMATO_ACEITE: "Assinatura presencial (registro manual)",
    IP_ACEITE: "N/A — assinatura presencial",
  };
  const conteudo = html.replace(/%([A-Z_][A-Z0-9_]*)%/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return { conteudo, vars };
}

export function MarkPresentialSignatureDialog({ open, onOpenChange, student, contratoDoc, planoTipoAtual }: Props) {
  const qc = useQueryClient();
  const [date, setDate] = useState<Date>(new Date());
  const [planoTipo, setPlanoTipo] = useState<PlanoTipo | "">(
    mapPlanoTipoToEnum(planoTipoAtual) ?? "",
  );

  const [forma, setForma] = useState<FormaPagamento>("cartao_recorrencia");
  const [saving, setSaving] = useState(false);

  const precisaSelects = !contratoDoc;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (contratoDoc) {
        const { error } = await db
          .from("contratos_documentos")
          .update({
            aceite: true,
            data_aceite: toISO(date),
            formato_aceite: "Assinatura presencial (registro manual)",
            ip_aceite: null,
          })
          .eq("id", contratoDoc.id);
        if (error) throw error;
      } else {
        if (!planoTipo) {
          toast.error("Selecione o plano");
          setSaving(false);
          return;
        }

        const { data: template, error: errTpl } = await db
          .from("contrato_templates")
          .select("id, conteudo, versao")
          .eq("plano_tipo", planoTipo)
          .eq("forma_pagamento", forma)
          .eq("ativo", true)
          .maybeSingle();
        if (errTpl) throw errTpl;
        if (!template) {
          toast.error("Nenhum template encontrado para essa combinação de plano e forma de pagamento");
          setSaving(false);
          return;
        }


        const { data: regulamento, error: errReg } = await db
          .from("regulamento_interno_versoes")
          .select("id, versao")
          .eq("ativo", true)
          .maybeSingle();
        if (errReg) throw errReg;

        const { data: contrato, error: errCtr } = await db
          .from("contratos")
          .select("id")
          .eq("aluno_id", student.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (errCtr) throw errCtr;
        if (!contrato?.id) {
          toast.error("Aluno não possui contrato financeiro cadastrado");
          setSaving(false);
          return;
        }

        const { conteudo, vars } = mergeAluno(template.conteudo, student, date);

        const { error: errIns } = await db.from("contratos_documentos").insert({
          contrato_id: contrato.id,
          aluno_id: student.id,
          template_id: template.id,
          template_versao: template.versao,
          regulamento_versao: regulamento?.versao ?? null,
          conteudo_gerado: conteudo,
          variaveis_utilizadas: vars,
          aceite: true,
          data_aceite: toISO(date),
          formato_aceite: "Assinatura presencial (registro manual)",
          ip_aceite: null,
        });
        if (errIns) throw errIns;
      }

      toast.success("Assinatura presencial registrada");
      qc.invalidateQueries({ queryKey: ["contrato_documento_aluno", student.id] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar assinatura");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar assinatura presencial</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Data da assinatura</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal mt-1", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d > new Date()}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {precisaSelects && (
            <>
              <div>
                <Label className="text-xs">Plano</Label>
                <Select value={planoTipo || undefined} onValueChange={(v) => setPlanoTipo(v as PlanoTipo)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANOS_OPCOES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLANO_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Forma de pagamento</Label>
                <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PRESENCIAL.map((f) => (
                      <SelectItem key={f} value={f}>
                        {FORMA_PAGAMENTO_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar assinatura presencial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MarkPresentialSignatureDialog;
