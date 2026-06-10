import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PLAN_CONFIG: Record<string, { label: string; duracao: number; servicos: string[] }> = {
  Start:    { label: "Start",  duracao: 1,  servicos: [] },
  "Start+": { label: "Start+", duracao: 12, servicos: ["1 Avaliação Funcional"] },
  Power:    { label: "Power",  duracao: 12, servicos: ["1 Avaliação Funcional"] },
  Pro:      { label: "Pro",    duracao: 12, servicos: ["2 Avaliação Funcional"] },
  Max:      { label: "Max",    duracao: 12, servicos: ["3 Avaliação Funcional", "5 Consultas Nutrição", "5 Consultas Reabilitação"] },
  VIP:      { label: "VIP",    duracao: 1,  servicos: [] },
  "Gympass/Wellhub": { label: "Gympass/Wellhub", duracao: 1, servicos: [] },
  "Total Pass":      { label: "Total Pass",      duracao: 1, servicos: [] },
};

export type PlanType = keyof typeof PLAN_CONFIG;

export const studentSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255).or(z.literal("")),
  telefone: z.string().trim().max(20).or(z.literal("")),
  data_nascimento: z.string().or(z.literal("")),
  status: z.enum(["ativo", "licenca", "encerrado"]),
  frequencia_semanal: z.coerce.number().int().min(0).max(3),
  observacoes: z.string().trim().max(1000).or(z.literal("")),
  plano: z.enum(["Start", "Start+", "Power", "Pro", "Max", "VIP", "Gympass/Wellhub", "Total Pass"]).optional(),
  plano_consultas: z.string().optional(),
  plano_valor: z.coerce.number().min(0, "Valor deve ser positivo").optional(),
  plano_data_inicio: z.string().optional(),
  professor_responsavel_id: z.string().optional(),
  origem_lead: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

export function getPlanDetails(plano?: string, plano_consultas?: string) {
  if (!plano || !(plano in PLAN_CONFIG)) return null;
  const cfg = PLAN_CONFIG[plano];
  const servicos = [...cfg.servicos];

  if (plano === "Power") {
    servicos.push(plano_consultas === "reabilitacao" ? "2 Consultas Reabilitação" : "2 Consultas Nutrição");
  } else if (plano === "Pro") {
    if (plano_consultas === "reabilitacao") servicos.push("4 Consultas Reabilitação");
    else if (plano_consultas === "misto") servicos.push("2 Consultas Nutrição", "2 Consultas Reabilitação");
    else servicos.push("4 Consultas Nutrição");
  }

  return { tipo: plano, duracao_meses: cfg.duracao, servicos };
}

function calcEndDate(startDate: string, durationMonths: number): string {
  if (!startDate) return "";
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + durationMonths);
  return d.toISOString().split("T")[0];
}

interface StudentFormFieldsProps {
  defaultValues: StudentFormValues;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  loading: boolean;
  submitLabel: string;
  onCancel: () => void;
}

function PlanServicesSelector({ control }: { control: any }) {
  const plano = useWatch({ control, name: "plano" });
  const dataInicio = useWatch({ control, name: "plano_data_inicio" });
  const planoConsultas = useWatch({ control, name: "plano_consultas" });
  const cfg = plano && plano in PLAN_CONFIG ? PLAN_CONFIG[plano] : null;

  if (!cfg) return null;

  const vigenciaText = cfg.duracao === 1 ? "1 mês" : `${cfg.duracao} meses`;
  const dataFinal = dataInicio ? calcEndDate(dataInicio, cfg.duracao) : "";

  // Build full services list including consultas selection
  const allServices = [...cfg.servicos];
  if (plano === "Power") {
    allServices.push(planoConsultas === "reabilitacao" ? "2 Consultas Reabilitação" : "2 Consultas Nutrição");
  } else if (plano === "Pro") {
    if (planoConsultas === "reabilitacao") allServices.push("4 Consultas Reabilitação");
    else if (planoConsultas === "misto") allServices.push("2 Consultas Nutrição", "2 Consultas Reabilitação");
    else allServices.push("4 Consultas Nutrição");
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Vigência</span>
        <Badge variant="secondary">{vigenciaText}</Badge>
      </div>

      {dataFinal && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Data Final</span>
          <Badge variant="outline">
            {new Date(dataFinal + "T00:00:00").toLocaleDateString("pt-BR")}
          </Badge>
        </div>
      )}

      {plano === "Power" && (
        <FormField
          control={control}
          name="plano_consultas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Selecione o tipo de consulta (2x)</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value || "nutricao"}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nutricao" id="power-nutricao" />
                    <Label htmlFor="power-nutricao" className="text-sm">2 Consultas Nutrição</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="reabilitacao" id="power-reab" />
                    <Label htmlFor="power-reab" className="text-sm">2 Consultas Reabilitação</Label>
                  </div>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
      )}

      {plano === "Pro" && (
        <FormField
          control={control}
          name="plano_consultas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Selecione o tipo de consulta (4x)</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value || "nutricao"}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nutricao" id="pro-nutricao" />
                    <Label htmlFor="pro-nutricao" className="text-sm">4 Consultas Nutrição</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="reabilitacao" id="pro-reab" />
                    <Label htmlFor="pro-reab" className="text-sm">4 Consultas Reabilitação</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="misto" id="pro-misto" />
                    <Label htmlFor="pro-misto" className="text-sm">2 Consultas Nutrição + 2 Consultas Reabilitação</Label>
                  </div>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
      )}

      {allServices.length > 0 && (
        <div>
          <span className="text-sm font-medium text-foreground">Serviços inclusos</span>
          <ul className="mt-1 space-y-1">
            {allServices.map((s) => (
              <li key={s} className="text-sm text-muted-foreground">• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function StudentFormFields({ defaultValues, onSubmit, loading, submitLabel, onCancel }: StudentFormFieldsProps) {
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues,
  });

  const [professors, setProfessors] = useState<{ user_id: string; full_name: string }[]>([]);

  useEffect(() => {
    async function loadProfessors() {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["professor", "coordenador", "admin"]);
      if (!roles || roles.length === 0) return;

      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (profiles) setProfessors(profiles);
    }
    loadProfessors();
  }, []);

  const plano = form.watch("plano");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome *</FormLabel>
              <FormControl><Input placeholder="Nome completo" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input placeholder="(11) 99999-0000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="data_nascimento"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Nascimento</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="licenca">Licença</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="frequencia_semanal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequência Semanal</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                    <SelectItem value="1">1x por semana</SelectItem>
                    <SelectItem value="2">2x por semana</SelectItem>
                    <SelectItem value="3">3x por semana</SelectItem>
                    <SelectItem value="0">Livre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="professor_responsavel_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Professor Responsável</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {professors.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="plano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plano</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Start">Start</SelectItem>
                  <SelectItem value="Start+">Start+</SelectItem>
                  <SelectItem value="Power">Power</SelectItem>
                  <SelectItem value="Pro">Pro</SelectItem>
                  <SelectItem value="Max">Max</SelectItem>
                  <SelectItem value="Gympass/Wellhub">Gympass/Wellhub</SelectItem>
                  <SelectItem value="Total Pass">Total Pass</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {plano && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="plano_valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Plano (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="plano_data_inicio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Início do Plano</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <PlanServicesSelector control={form.control} />

        <FormField
          control={form.control}
          name="origem_lead"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Origem do lead</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl><SelectTrigger><SelectValue placeholder="Como nos conheceu?" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Passou em frente">Passou em frente</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl><Textarea placeholder="Observações sobre o aluno..." rows={3} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Salvando..." : submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}
