"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface SidebarContextType {
  isDesktopSidebarOpen: boolean;
  toggleDesktopSidebar: () => void;
  setDesktopSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isDesktopSidebarOpen: true,
  toggleDesktopSidebar: () => {},
  setDesktopSidebarOpen: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("guiedteach_desktop_sidebar");
        if (stored !== null) {
          setIsDesktopSidebarOpen(stored === "true");
        }
      } catch {}
    }
  }, []);

  const setDesktopSidebarOpen = useCallback((open: boolean) => {
    setIsDesktopSidebarOpen(open);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("guiedteach_desktop_sidebar", String(open));
        window.dispatchEvent(new CustomEvent("desktop_sidebar_toggled", { detail: { open } }));
      } catch {}
    }
  }, []);

  const toggleDesktopSidebar = useCallback(() => {
    setIsDesktopSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("guiedteach_desktop_sidebar", String(next));
          window.dispatchEvent(new CustomEvent("desktop_sidebar_toggled", { detail: { open: next } }));
        } catch {}
      }
      return next;
    });
  }, []);

  // Global Ctrl+B / Cmd+B keyboard shortcut to toggle desktop sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        const active = document.activeElement;
        const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable);
        if (!isInput) {
          e.preventDefault();
          toggleDesktopSidebar();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleDesktopSidebar]);

  return (
    <SidebarContext.Provider
      value={{
        isDesktopSidebarOpen,
        toggleDesktopSidebar,
        setDesktopSidebarOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
