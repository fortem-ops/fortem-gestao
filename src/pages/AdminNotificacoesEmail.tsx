import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Mail, Plus, Send, X } from "lucide-react";

type Config = {
  id: number;
  remetente_nome: string;
  remetente_email: string;
  atividades_monitoradas: string[];
  enviar_em_agendamento: boolean;
  enviar_em_cancelamento: boolean;
  exigir_aluno_vinculado: boolean;
  destinatarios_regra: string;
  emails_extras: string[];
  enviar_tarefa_criada: boolean;
  enviar_tarefa_automatica: boolean;
  enviar_notificacao_nova: boolean;
  enviar_notificacao_resposta: boolean;
  enviar_agenda_diaria: boolean;
  agenda_diaria_horario: string;
};

const REGRAS = [
  { value: "profissional_vinculado", label: "Apenas o profissional vinculado" },
  { value: "profissional_e_coordenadores", label: "Profissional + coordenadores" },
  { value: "profissional_coord_admin", label: "Profissional + coordenadores + admins" },
  { value: "todos_staff", label: "Todos os funcionários" },
];

export default function AdminNotificacoesEmail() {
  const { user } = useAuth();
  const [form, setForm] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [novaAtividade, setNovaAtividade] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [testEmail, setTestEmail] = useState("");

  const { data: isCoordAdmin, isLoading: loadingRole } = useQuery({
    queryKey: ["is-coord-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user?.id,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["notificacao-email-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacao_email_config" as any)
        .select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as unknown as Config;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (loadingRole || isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!isCoordAdmin) {
    return <div className="p-6 text-muted-foreground">Acesso restrito a coordenadores e administradores.</div>;
  }
  if (!form) return null;

  const update = <K extends keyof Config>(k: K, v: Config[K]) => setForm({ ...form, [k]: v });

  const addAtividade = () => {
    const v = novaAtividade.trim();
    if (!v || form.atividades_monitoradas.includes(v)) return;
    update("atividades_monitoradas", [...form.atividades_monitoradas, v]);
    setNovaAtividade("");
  };
  const removeAtividade = (v: string) =>
    update("atividades_monitoradas", form.atividades_monitoradas.filter((x) => x !== v));

  const addEmail = () => {
    const v = novoEmail.trim().toLowerCase();
    if (!v || !/^\S+@\S+\.\S+$/.test(v) || form.emails_extras.includes(v)) return;
    update("emails_extras", [...form.emails_extras, v]);
    setNovoEmail("");
  };
  const removeEmail = (v: string) =>
    update("emails_extras", form.emails_extras.filter((x) => x !== v));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("notificacao_email_config" as any)
      .update({
        remetente_nome: form.remetente_nome.trim() || "FORTEM",
        remetente_email: form.remetente_email.trim(),
        atividades_monitoradas: form.atividades_monitoradas,
        enviar_em_agendamento: form.enviar_em_agendamento,
        enviar_em_cancelamento: form.enviar_em_cancelamento,
        exigir_aluno_vinculado: form.exigir_aluno_vinculado,
        destinatarios_regra: form.destinatarios_regra,
        emails_extras: form.emails_extras,
        enviar_tarefa_criada: form.enviar_tarefa_criada,
        enviar_tarefa_automatica: form.enviar_tarefa_automatica,
        enviar_notificacao_nova: form.enviar_notificacao_nova,
        enviar_notificacao_resposta: form.enviar_notificacao_resposta,
        enviar_agenda_diaria: form.enviar_agenda_diaria,
        agenda_diaria_horario: form.agenda_diaria_horario,
        updated_by: user?.id,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Configurações salvas");
    refetch();
  };

  const enviarTeste = async () => {
    const to = testEmail.trim() || form.remetente_email;
    if (!/^\S+@\S+\.\S+$/.test(to)) {
      toast.error("Informe um email válido para teste");
      return;
    }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("notify-agenda-evento", {
      body: { teste: to },
    });
    setTesting(false);
    if (error) {
      toast.error("Falha no teste: " + error.message);
      return;
    }
    toast.success(`Email de teste enviado para ${(data as any)?.to || to}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Notificações por email</h1>
          <p className="text-sm text-muted-foreground">
            Configure o remetente, destinatários e regras de disparo automático.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Remetente</CardTitle>
          <CardDescription>
            O envio usa a conta Gmail <strong>contatofortem@gmail.com</strong>. Alterar o email aqui muda apenas
            o cabeçalho <em>From</em> exibido ao destinatário.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome exibido</Label>
            <Input value={form.remetente_nome} onChange={(e) => update("remetente_nome", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email exibido</Label>
            <Input type="email" value={form.remetente_email} onChange={(e) => update("remetente_email", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos e regras</CardTitle>
          <CardDescription>Quando os emails devem ser disparados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Disparar ao agendar</Label>
              <p className="text-xs text-muted-foreground">Email enviado quando uma atividade é incluída na agenda.</p>
            </div>
            <Switch checked={form.enviar_em_agendamento} onCheckedChange={(v) => update("enviar_em_agendamento", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Disparar ao cancelar</Label>
              <p className="text-xs text-muted-foreground">Email enviado quando uma atividade é removida da agenda.</p>
            </div>
            <Switch checked={form.enviar_em_cancelamento} onCheckedChange={(v) => update("enviar_em_cancelamento", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Exigir aluno vinculado</Label>
              <p className="text-xs text-muted-foreground">Se desligado, eventos sem aluno também geram email.</p>
            </div>
            <Switch checked={form.exigir_aluno_vinculado} onCheckedChange={(v) => update("exigir_aluno_vinculado", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarefas, notificações e agenda diária</CardTitle>
          <CardDescription>Disparos automáticos adicionais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Nova tarefa criada</Label>
              <p className="text-xs text-muted-foreground">Email ao responsável quando uma tarefa é criada.</p>
            </div>
            <Switch checked={form.enviar_tarefa_criada} onCheckedChange={(v) => update("enviar_tarefa_criada", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Incluir tarefas automáticas</Label>
              <p className="text-xs text-muted-foreground">Se desligado, apenas tarefas criadas manualmente disparam email.</p>
            </div>
            <Switch checked={form.enviar_tarefa_automatica} onCheckedChange={(v) => update("enviar_tarefa_automatica", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Nova notificação (aguardando resposta)</Label>
              <p className="text-xs text-muted-foreground">Email aos destinatários quando uma notificação é criada.</p>
            </div>
            <Switch checked={form.enviar_notificacao_nova} onCheckedChange={(v) => update("enviar_notificacao_nova", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Notificação respondida</Label>
              <p className="text-xs text-muted-foreground">Email ao criador quando há resposta ou comentário.</p>
            </div>
            <Switch checked={form.enviar_notificacao_resposta} onCheckedChange={(v) => update("enviar_notificacao_resposta", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Agenda diária do profissional</Label>
              <p className="text-xs text-muted-foreground">Email matinal listando todos os agendamentos do dia (cron diário às 07:00 BRT).</p>
            </div>
            <Switch checked={form.enviar_agenda_diaria} onCheckedChange={(v) => update("enviar_agenda_diaria", v)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Atividades monitoradas</CardTitle>
          <CardDescription>Somente estas atividades disparam notificação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {form.atividades_monitoradas.map((a) => (
              <Badge key={a} variant="secondary" className="gap-1 pl-3 pr-1 py-1">
                {a}
                <button onClick={() => removeAtividade(a)} className="ml-1 hover:bg-destructive/20 rounded p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {form.atividades_monitoradas.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma atividade — nenhum email será disparado.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Ex.: Treino Experimental"
              value={novaAtividade}
              onChange={(e) => setNovaAtividade(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAtividade())}
            />
            <Button type="button" variant="outline" onClick={addAtividade}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destinatários</CardTitle>
          <CardDescription>Quem recebe o email principal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={form.destinatarios_regra}
            onValueChange={(v) => update("destinatarios_regra", v)}
            className="space-y-2"
          >
            {REGRAS.map((r) => (
              <label key={r.value} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent">
                <RadioGroupItem value={r.value} id={r.value} />
                <span>{r.label}</span>
              </label>
            ))}
          </RadioGroup>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label>Emails extras em cópia (CC)</Label>
              <p className="text-xs text-muted-foreground">Recebem cópia em todos os disparos, independente da regra acima.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.emails_extras.map((e) => (
                <Badge key={e} variant="outline" className="gap-1 pl-3 pr-1 py-1">
                  {e}
                  <button onClick={() => removeEmail(e)} className="ml-1 hover:bg-destructive/20 rounded p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
              />
              <Button type="button" variant="outline" onClick={addEmail}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enviar email de teste</CardTitle>
          <CardDescription>Dispara um email com a configuração atual sem afetar a agenda.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            type="email"
            placeholder={`Padrão: ${form.remetente_email}`}
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={enviarTeste} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar teste
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
