import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import fortemIcon from "@/assets/fortem-icon.png";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(72),
  fullName: z.string().trim().min(2, "Informe seu nome completo").max(100),
});

export default function PortalSignUp() {
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error("Verifique os dados", { description: parsed.error.errors[0].message });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`,
        data: { full_name: parsed.data.fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      toast.success("Conta criada com sucesso!", { description: "Bem-vindo ao portal." });
      navigate("/portal");
      return;
    }

    toast.success("Conta criada!", { description: "Verifique seu e-mail para confirmar e depois faça login." });
    navigate("/portal/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="text-center space-y-2 pb-2">
          <img src={fortemIcon} alt="Fortem" className="mx-auto w-12 h-12" />
          <h1 className="font-heading font-bold text-lg">Criar conta — Portal do Aluno</h1>
          <p className="text-xs text-muted-foreground">Use o mesmo e-mail cadastrado pelo seu professor.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha (mín. 8 caracteres)</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={loading} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar conta"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Já tem conta? <Link to="/portal/login" className="text-primary hover:underline">Entrar</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
