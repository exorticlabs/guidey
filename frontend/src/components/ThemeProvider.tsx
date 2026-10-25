"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchWithAuth } from "@/utils/api";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({ theme: "light", toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load from localStorage first, then backend
    const saved = localStorage.getItem("guiedteach-theme") as Theme | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      fetchWithAuth("/api/user/settings/theme")
        .then((r) => r.json())
        .then((data) => {
          const t = data.theme || "light";
          setTheme(t);
          document.documentElement.setAttribute("data-theme", t);
        })
        .catch(() => {});
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("guiedteach-theme", next);
    fetchWithAuth("/api/user/settings/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  };

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
