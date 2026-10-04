import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateUniqueSlug } from "@/lib/siteSlug";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "user" | "photographer" | "organizer" | "super_admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { full_name: string | null; avatar_url: string | null; cpf_cnpj: string | null; terms_accepted_at: string | null } | null;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  addRole: (role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  roles: [],
  hasRole: () => false,
  addRole: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null; cpf_cnpj: string | null; terms_accepted_at: string | null } | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);

  const fetchUserData = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url, cpf_cnpj, terms_accepted_at").eq("user_id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(profileRes.data);
    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r: any) => r.role as AppRole));
    }

    // Garante slug único do site para fotógrafos (gerado a partir do nome)
    try {
      const isPhotographer = (rolesRes.data || []).some((r: any) => r.role === "photographer");
      if (isPhotographer) {
        const { data: site } = await supabase
          .from("photographer_sites")
          .select("id, slug")
          .eq("user_id", userId)
          .maybeSingle();
        if (!site?.slug) {
          const baseName = profileRes.data?.full_name || "fotografo";
          const slug = await generateUniqueSlug(baseName, userId);
          if (site?.id) {
            await supabase.from("photographer_sites").update({ slug }).eq("user_id", userId);
          } else {
            await supabase.from("photographer_sites").insert({
              user_id: userId,
              slug,
              display_name: profileRes.data?.full_name || "",
            });
          }
        }
      }
    } catch { /* noop */ }

    // Track last sign in
    supabase.from("profiles").update({ last_sign_in_at: new Date().toISOString() }).eq("user_id", userId).then(() => {});

    // Captura código de indicação salvo no /r/:code (se houver) e cria o vínculo de referral
    try {
      const code = localStorage.getItem("viufoto_referral_code");
      const isPhotog = (rolesRes.data || []).some((r: any) => r.role === "photographer");
      if (code && isPhotog) {
        const { data: site } = await supabase
          .from("photographer_sites")
          .select("user_id")
          .eq("referral_code", code)
          .maybeSingle();
        if (site?.user_id && site.user_id !== userId) {
          await supabase.from("referrals" as any).insert({ referrer_id: site.user_id, referred_id: userId, code });
        }
        localStorage.removeItem("viufoto_referral_code");
      }
    } catch { /* noop */ }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, cpf_cnpj, terms_accepted_at")
      .eq("user_id", user.id)
      .single();
    if (data) setProfile(data);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const addRole = async (role: AppRole) => {
    if (!user) return;
    if (roles.includes(role)) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
    if (!error) {
      setRoles((prev) => [...prev, role]);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth listener - don't do async work inside the callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Use setTimeout to avoid Supabase auth deadlock
        setTimeout(() => {
          if (!mounted) return;
          fetchUserData(session.user.id).then(() => {
            if (mounted) setLoading(false);
          });
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, roles, hasRole, addRole, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
