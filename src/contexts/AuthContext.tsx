import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True quando getSession() já resolveu E o primeiro evento de onAuthStateChange chegou. */
  isReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef({ subscription: false, session: false });

  useEffect(() => {
    const markReady = () => {
      if (initialized.current.subscription && initialized.current.session) {
        setLoading(false);
        setIsReady(true);
      }
    };

    // IMPORTANT: subscribe BEFORE getSession to avoid missing the initial event.
    // Never await inside this callback (evita deadlocks).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      initialized.current.subscription = true;
      markReady();
    });

    supabase.auth.getSession()
      .then(({ data: { session: existing } }) => {
        setSession(existing);
        setUser(existing?.user ?? null);
      })
      .catch(() => {
        // ignora — fallback abaixo garante que isReady acaba ficando true
      })
      .finally(() => {
        initialized.current.session = true;
        markReady();
      });

    // Safety net: se algo travar, libera a UI após 4s para não ficar em loading infinito.
    const safety = setTimeout(() => {
      if (!initialized.current.session || !initialized.current.subscription) {
        initialized.current.session = true;
        initialized.current.subscription = true;
        markReady();
      }
    }, 4000);

    return () => {
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    // Retry uma vez em erro de rede (extensão/proxy do navegador pode falhar a 1ª chamada).
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (!error) return { error: null };
        lastError = error;
        if (!/fetch|network/i.test(error.message)) break;
      } catch (e: any) {
        lastError = e;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    return { error: lastError as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isReady, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
