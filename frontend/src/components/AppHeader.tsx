"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/SidebarContext";

export default function AppHeader() {
  const pathname = usePathname();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useSidebar();

  const PUBLIC_ROUTES = ["/", "/login", "/signup", "/privacy", "/terms", "/contact", "/pricing", "/tutor"];
  if (PUBLIC_ROUTES.includes(pathname)) return null;

  return (
    <header className="w-full top-0 sticky bg-surface/90 backdrop-blur-md border-b border-outline-variant/80 z-30">
      <div className="flex items-center justify-between px-4 lg:px-8 w-full h-14 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2">
          {!isDesktopSidebarOpen && (
            <button
              onClick={toggleDesktopSidebar}
              className="hidden lg:flex items-center justify-center p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
              title="Expand sidebar (Ctrl+B)"
              aria-label="Expand sidebar"
            >
              <span className="material-symbols-outlined text-[18px]">dock_to_right</span>
            </button>
          )}
        </div>
        <Link
          href="/tutor?new=1"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary/95 font-medium text-xs shadow-xs active:scale-95 transition-all ml-auto"
          title="Create New General Chat"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span className="font-semibold">New Chat</span>
        </Link>
      </div>
    </header>
  );
}
