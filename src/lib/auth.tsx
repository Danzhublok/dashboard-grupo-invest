import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase";

export type AppSession = {
  userId: string;
  fullName: string;
  email?: string;
  role: "admin" | "representante";
  representationId?: string;
  representationName?: string;
};

type AuthContextValue = {
  session: AppSession | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const LOCAL_SESSION_KEY = "grupo-invest-session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session && active) {
          const loaded = await loadSupabaseProfile(data.session.user.id, data.session.user.email);
          if (active) setSession(loaded);
        }
      } else {
        const raw = localStorage.getItem(LOCAL_SESSION_KEY);
        if (raw && active) setSession(JSON.parse(raw) as AppSession);
      }
      if (active) setReady(true);
    };

    void loadSession();

    const listener = supabase?.auth.onAuthStateChange((_event, authSession) => {
      if (!authSession) setSession(null);
    });

    return () => {
      active = false;
      listener?.data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      ready,
      login: async (email, password) => {
        if (!supabase) {
          if (email.toLowerCase() === "admin" && password === "invest123") {
            const localSession: AppSession = {
              userId: "local-admin",
              fullName: "Administrador",
              email: "admin",
              role: "admin",
            };
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localSession));
            setSession(localSession);
            return null;
          }
          return "Configure o Supabase para acessar contas de representantes.";
        }

        const loginEmail = email.includes("@")
          ? email
          : `${email.trim().toLowerCase()}@accounts.grupoinvest.local`;
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        if (error || !data.user) return error?.message ?? "Não foi possível entrar.";
        const loaded = await loadSupabaseProfile(data.user.id, data.user.email);
        setSession(loaded);
        return null;
      },
      logout: async () => {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        if (supabase) await supabase.auth.signOut();
        setSession(null);
      },
    }),
    [ready, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function loadSupabaseProfile(userId: string, email?: string): Promise<AppSession> {
  if (!supabase) {
    return { userId, email, fullName: email ?? "Usuário", role: "representante" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .single();

  const { data: membership } = await supabase
    .from("representation_members")
    .select("representation_id, representation:representations(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const representation = membership?.representation as unknown as { name?: string } | null;

  return {
    userId,
    email,
    fullName: profile?.full_name ?? email ?? "Usuário",
    role: profile?.role ?? "representante",
    representationId: membership?.representation_id,
    representationName: representation?.name,
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
