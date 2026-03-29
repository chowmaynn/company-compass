import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  admin: boolean;
  department: string | null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  department: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Can this user edit data for the given department? Admins can edit all. */
  canEdit: (dept: string) => boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  isAdmin: false,
  department: null,
  loading: true,
  signIn: async () => null,
  signOut: async () => {},
  canEdit: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ admin: false, department: null });
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("admin, department")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile({
      admin: data?.admin ?? false,
      department: data?.department ?? null,
    });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id);
      else setProfile({ admin: false, department: null });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const canEdit = useCallback(
    (dept: string) => profile.admin || profile.department === dept,
    [profile.admin, profile.department]
  );

  return (
    <AuthContext.Provider value={{
      user, session,
      isAdmin: profile.admin,
      department: profile.department,
      loading, signIn, signOut, canEdit,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
