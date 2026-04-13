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

const PLAN_CONFIG: Record<string, { label: string; duracao: number; servicos: string[] }> = {
  start:   { label: "Start",  duracao: 1,  servicos: [] },
  "start+": { label: "Start+", duracao: 12, servicos: ["1 Avaliação Funcional"] },
  power:   { label: "Power",  duracao: 12, servicos: ["1 Avaliação Funcional"] },
  pro:     { label: "Pro",    duracao: 12, servicos: ["2 Avaliação Funcional"] },
  max:     { label: "Max",    duracao: 12, servicos: ["3 Avaliação Funcional", "5 Consultas Nutrição", "5 Consultas Reabilitação"] },
};

export type PlanType = keyof typeof PLAN_CONFIG;

export const studentSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().trim().email("Email inválido").max(255).or(z.literal("")),
  telefone: z.string().trim().max(20).or(z.literal("")),
  data_nascimento: z.string().or(z.literal("")),
  status: z.enum(["ativo", "licenca", "encerrado"]),
  frequencia_semanal: z.coerce.number().int().min(1).max(7),
  observacoes: z.string().trim().max(1000).or(z.literal("")),
  plano: z.enum(["start", "start+", "power", "pro", "max"]).optional(),
  plano_consultas: z.string().optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;

export function getPlanDetails(plano?: string, plano_consultas?: string) {
  if (!plano || !(plano in PLAN_CONFIG)) return null;
  const cfg = PLAN_CONFIG[plano as PlanType];
  const servicos = [...cfg.servicos];

  if (plano === "power") {
    servicos.push(plano_consultas === "reabilitacao" ? "2 Consultas Reabilitação" : "2 Consultas Nutrição");
  } else if (plano === "pro") {
    if (plano_consultas === "reabilitacao") servicos.push("4 Consultas Reabilitação");
    else if (plano_consultas === "misto") servicos.push("2 Consultas Nutrição", "2 Consultas Reabilitação");
    else servicos.push("4 Consultas Nutrição");
  }

  return { tipo: plano, duracao_meses: cfg.duracao, servicos };
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
  const cfg = plano && plano in PLAN_CONFIG ? PLAN_CONFIG[plano as PlanType] : null;

  if (!cfg) return null;

  const vigenciaText = cfg.duracao === 1 ? "1 mês" : `${cfg.duracao} meses`;

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Vigência</span>
        <Badge variant="secondary">{vigenciaText}</Badge>
      </div>

      {cfg.servicos.length > 0 && (
        <div>
          <span className="text-sm font-medium text-foreground">Serviços inclusos</span>
          <ul className="mt-1 space-y-1">
            {cfg.servicos.map((s) => (
              <li key={s} className="text-sm text-muted-foreground">• {s}</li>
            ))}
          </ul>
        </div>
      )}

      {plano === "power" && (
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

      {plano === "pro" && (
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

      {plano === "max" && (
        <div>
          <span className="text-sm text-muted-foreground">• 5 Consultas Nutrição</span>
          <br />
          <span className="text-sm text-muted-foreground">• 5 Consultas Reabilitação</span>
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

        <FormField
          control={form.control}
          name="frequencia_semanal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequência Semanal</FormLabel>
              <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}x por semana</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plano</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="start">Start</SelectItem>
                  <SelectItem value="start+">Start+</SelectItem>
                  <SelectItem value="power">Power</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="max">Max</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <PlanServicesSelector control={form.control} />

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
