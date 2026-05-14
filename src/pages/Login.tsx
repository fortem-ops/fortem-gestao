import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import fortemIcon from "@/assets/fortem-icon.png";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { userHasStaffAccess } from "@/lib/authAccess";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    userHasStaffAccess(user.id).then((isStaff) => {
      navigate(isStaff ? "/" : "/portal", { replace: true });
    });
  }, [navigate, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast({
        title: "Erro ao entrar",
        description: "Email ou senha incorretos.",
        variant: "destructive",
      });
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const signedUser = sessionData.session?.user;
      if (!signedUser) {
        setLoading(false);
        toast({
          title: "Erro ao entrar",
          description: "Não foi possível carregar a sessão. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      try {
        const isStaff = await userHasStaffAccess(signedUser.id);
        navigate(isStaff ? "/" : "/portal");
      } catch {
        await supabase.auth.signOut();
        toast({
          title: "Acesso não liberado",
          description: "Sua conta não tem permissão de funcionário.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md glass-card">
          <CardHeader className="text-center space-y-4 pb-2">
            <img src={fortemIcon} alt="Fortem" className="mx-auto w-16 h-16 object-contain" />
            <div className="space-y-2">
              <img src={fortemWordmark} alt="Fortem" className="mx-auto h-6 object-contain dark:invert" />
              <p className="text-sm text-muted-foreground">Gestão Técnica</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <div className="text-right">
                <Link to="/recuperar-senha" className="text-xs text-muted-foreground hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
