"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { API_URL } from "@/utils/api";

type AppUser = User & {
  role?: "student" | "clg" | "admin" | "teacher";
  name?: string;
  avatar?: string;
  org_id?: number | null;
  referral_code?: string | null;
};

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  token: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const res = await fetch(`${API_URL}/api/users/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          
          if (res.ok) {
            const profile = await res.json();
            setUser({ ...session.user, ...profile });
            setToken(session.access_token);
          } else {
            // Force sign out if they don't exist in our backend and couldn't be auto-synced
            await supabase.auth.signOut();
            setUser(null);
            setToken(null);
          }
        } catch (e) {
          // If backend is down, log them out to be safe
          setUser(null);
          setToken(null);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            const res = await fetch(`${API_URL}/api/users/me`, {
              headers: { Authorization: `Bearer ${session.access_token}` }
            });
            
            if (res.ok) {
              const profile = await res.json();
              setUser({ ...session.user, ...profile });
              setToken(session.access_token);
            } else {
              if (event === "SIGNED_IN") {
                await supabase.auth.signOut();
              }
              setUser(null);
              setToken(null);
            }
          } catch (e) {
            setUser(null);
            setToken(null);
          }
        } else {
          setUser(null);
          setToken(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Protected Routes Logic
  useEffect(() => {
    if (!loading) {
      const PUBLIC_ROUTES = [
        "/",
        "/login",
        "/signup",
        "/privacy",
        "/terms",
        "/contact",
        "/home",
        "/tutor",
        "/subjects",
        "/projects",
        "/my-knowledge",
        "/settings",
        "/pricing"
      ];

      if (!user && !PUBLIC_ROUTES.includes(pathname)) {
        router.push("/login");
      } else if (user) {
        if (pathname === "/login" || pathname === "/") {

          router.push("/home");
        }
        // Strict Role checks (RBAC)
        if (pathname.startsWith("/admin") && user.role !== "admin") {
           router.push("/home");
        } else if (pathname.startsWith("/organisation") && !["admin", "clg"].includes(user.role || "")) {
           router.push("/home");
        } else if (pathname.startsWith("/teacher") && !["admin", "clg", "teacher"].includes(user.role || "")) {
           router.push("/home");
        }
      }
    }
  }, [user, loading, pathname, router]);

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && session.access_token) {
      try {
        const res = await fetch(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const profile = await res.json();
          setUser({ ...session.user, ...profile });
        }
      } catch (e) {
        console.error("Failed to refresh user profile", e);
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, token, signOut, refreshUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
