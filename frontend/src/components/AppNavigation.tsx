"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { fetchWithAuth, API_URL } from "@/utils/api";
import DarkModeToggle from "@/components/DarkModeToggle";
import NotificationsPanel from "@/components/NotificationsPanel";
import { useSidebar } from "@/components/SidebarContext";

type Session = {
  id: number | string;
  title: string;
  category: string;
  subject_id: number | null;
  topic_id: number | null;
  subject_name: string | null;
  topic_name: string | null;
  message_count?: number;
  updated_at?: string;
};

type SubjectItem = {
  id: number;
  name: string;
  code?: string;
  color?: string;
  icon?: string;
  topics_count?: number;
};

const CATEGORY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  subject: { icon: "menu_book", label: "Subject", color: "text-emerald-500 dark:text-emerald-400" },
  topic: { icon: "topic", label: "Topic", color: "text-amber-500 dark:text-amber-400" },
  free: { icon: "chat_bubble", label: "General", color: "text-sky-500 dark:text-sky-400" },
};

const SUBJECT_COLORS = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600"
];

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useSidebar();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<number | string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [guestCredits, setGuestCredits] = useState<number | null>(null);

  const currentSessionId = searchParams.get("session");

  const PUBLIC_ROUTES = ["/", "/login", "/signup", "/privacy", "/terms", "/contact", "/pricing"];
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Load Sessions
  const loadSessions = useCallback(async () => {
    if (user) {
      try {
        const res = await fetchWithAuth("/api/tutor/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessions(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to load sessions in sidebar", e);
      }
    } else {
      // Guest chats are strictly temporary and not stored in localStorage or database
      try {
        localStorage.removeItem("guiedteach_guest_sessions");
      } catch {}
      setSessions([]);
    }
  }, [user]);

  // Load Subjects
  const loadSubjects = useCallback(async () => {
    if (!user) {
      setSubjects([]);
      return;
    }
    try {
      const res = await fetchWithAuth("/api/subjects/active");
      if (res.ok) {
        const data = await res.json();
        setSubjects(Array.isArray(data) ? data.slice(0, 6) : []);
      } else {
        const fallbackRes = await fetchWithAuth("/api/subjects");
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setSubjects(Array.isArray(fallbackData) ? fallbackData.slice(0, 6) : []);
        }
      }
    } catch (e) {
      console.error("Failed to load active subjects in sidebar", e);
    }
  }, [user]);

  // Guest credits
  useEffect(() => {
    if (typeof window !== "undefined" && !user) {
      const deviceId = localStorage.getItem("guiedteach_device_id");
      if (deviceId) {
        fetch(`${API_URL}/api/tutor/guest/credits?device_id=${deviceId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.credits_left !== undefined) {
              setGuestCredits(data.credits_left);
            }
          })
          .catch(() => {});
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isPublicRoute) {
      loadSessions();
      loadSubjects();
    }
  }, [isPublicRoute, loadSessions, loadSubjects]);

  // Listen to cross-component sync events
  useEffect(() => {
    const handleSessionsUpdate = () => {
      loadSessions();
    };
    window.addEventListener("tutor_sessions_updated", handleSessionsUpdate);
    return () => {
      window.removeEventListener("tutor_sessions_updated", handleSessionsUpdate);
    };
  }, [loadSessions]);

  if (isPublicRoute) return null;

  // New Chat Action
  const handleNewChat = () => {
    setIsMobileMenuOpen(false);
    if (pathname === "/tutor") {
      window.dispatchEvent(new CustomEvent("new_tutor_session"));
      window.history.replaceState({}, "", "/tutor?new=1");
    } else {
      router.push("/tutor?new=1");
    }
  };

  // Select Chat Session
  const handleSelectSession = (id: number | string) => {
    setIsMobileMenuOpen(false);
    if (pathname === "/tutor") {
      window.dispatchEvent(new CustomEvent("open_tutor_session", { detail: { id } }));
      window.history.replaceState({}, "", `/tutor?session=${id}`);
    } else {
      router.push(`/tutor?session=${id}`);
    }
  };

  // Rename Session
  const handleSaveTitle = async (id: number | string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTitle.trim()) return;

    if (user) {
      try {
        const res = await fetchWithAuth(`/api/tutor/sessions/${id}/title`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editingTitle }),
        });
        if (res.ok) {
          setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: editingTitle } : s)));
          window.dispatchEvent(new CustomEvent("tutor_sessions_updated"));
        }
      } catch (err) {
        console.error("Error renaming session", err);
      }
    } else {
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: editingTitle } : s)));
    }
    setEditingSessionId(null);
  };

  // Delete Session
  const handleDeleteSession = async (id: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;

    if (user) {
      try {
        const res = await fetchWithAuth(`/api/tutor/sessions/${id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== id));
          window.dispatchEvent(new CustomEvent("tutor_sessions_updated"));
          if (String(currentSessionId) === String(id)) {
            handleNewChat();
          }
        }
      } catch (err) {
        console.error("Error deleting session", err);
      }
    } else {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (String(currentSessionId) === String(id)) {
        handleNewChat();
      }
    }
  };

  // Nav Links
  const role = user?.role;
  const CORE_NAV_LINKS = [
    { href: "/home", icon: "dashboard", label: "Dashboard", badge: "" },
    // { href: "/subjects", icon: "menu_book", label: "Subjects & Syllabus", badge: "" },
    { href: "/my-knowledge", icon: "hub", label: "My Knowledge", badge: "Mastery" },
    // { href: "/projects", icon: "architecture", label: "Projects", badge: "" },
  ];

  const ROLE_NAV_LINKS = [
    { href: "/organisation", icon: "domain", label: "School Portal", roles: ["clg", "admin", "teacher"] },
    { href: "/teacher", icon: "school", label: "Teacher Workspace", roles: ["teacher", "admin"] },
    { href: "/admin", icon: "admin_panel_settings", label: "Admin Panel", roles: ["admin"] },
  ].filter((item) => !item.roles || (role && item.roles.includes(role)));

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header & New Chat */}
      <div className="p-3 pb-2 flex-shrink-0 flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-2 py-1">
          <Link href="/tutor" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform duration-200 flex-shrink-0">
              <Image src="/logo.png" alt="Exortic AI" width={32} height={32} className="w-full h-full object-contain" priority />
            </div>
            <div className="flex flex-col">
              <span className="font-display-lg text-base font-bold tracking-tight text-primary leading-tight">
                Exortic <span className="text-secondary">AI</span>
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-1">
            <button
              onClick={toggleDesktopSidebar}
              className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <span className="material-symbols-outlined text-[18px]">dock_to_left</span>
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Primary "+ New Chat" Button */}
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-primary text-on-primary font-medium text-sm shadow-md shadow-primary/15 hover:bg-primary/95 active:scale-[0.98] transition-all duration-150 group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px] group-hover:rotate-90 transition-transform duration-200">
              add
            </span>
            <span>New Chat</span>
          </div>
          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/15 text-white/90 font-mono">
            +
          </span>
        </button>
      </div>

      {/* Main Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 no-scrollbar">
        {/* 1. SUBJECTS NAVIGATION SECTION */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-secondary">menu_book</span>
              Subjects
            </span>
            <Link
              href="/subjects"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-[11px] font-medium text-secondary hover:text-secondary/80 hover:underline flex items-center gap-0.5"
            >
              Browse All
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            </Link>
          </div>

          <div className="space-y-0.5">
            {subjects.length > 0 ? (
              subjects.map((sub, idx) => {
                const isSubActive = pathname === `/subject/${sub.id}`;
                const gradient = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
                return (
                  <Link
                    key={sub.id}
                    href={`/subject/${sub.id}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all duration-150 group ${
                      isSubActive
                        ? "bg-secondary/10 text-secondary font-semibold"
                        : "text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full bg-gradient-to-r ${gradient} flex-shrink-0 group-hover:scale-125 transition-transform`}
                      />
                      <span className="truncate">{sub.name}</span>
                    </div>
                    {sub.code && (
                      <span className="text-[10px] font-mono text-on-surface-variant/60 uppercase">
                        {sub.code}
                      </span>
                    )}
                  </Link>
                );
              })
            ) : (
              <Link
                href="/subjects"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-on-surface-variant hover:bg-surface-container-low border border-dashed border-outline-variant/60"
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">add_circle</span>
                <span>Enroll in Subjects</span>
              </Link>
            )}
          </div>
        </div>

        {/* 2. OTHER RELEVANT NAVIGATIONS SECTION */}
        <div>
          <div className="px-2 py-1 mb-1">
            <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-secondary">explore</span>
              Workspace
            </span>
          </div>

          <div className="space-y-0.5">
            {CORE_NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all duration-150 ${
                    isActive
                      ? "bg-secondary/10 text-secondary font-semibold"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        isActive ? "text-secondary icon-fill" : "text-on-surface-variant"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant border border-outline-variant/40">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {ROLE_NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition-all duration-150 ${
                    isActive
                      ? "bg-secondary/10 text-secondary font-semibold"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isActive ? "text-secondary icon-fill" : "text-on-surface-variant"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 3. CHATS LIST (HISTORY) SECTION */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant/70 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-secondary">forum</span>
              Conversations
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant/60">
              {sessions.length}
            </span>
          </div>

          <div className="space-y-0.5">
            {sessions.length > 0 ? (
              sessions.map((s) => {
                const isActiveChat =
                  pathname === "/tutor" &&
                  (String(currentSessionId) === String(s.id) ||
                    (!currentSessionId && sessions[0]?.id === s.id && !searchParams.get("new")));
                const catConfig = CATEGORY_CONFIG[s.category] || CATEGORY_CONFIG.free;

                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all duration-150 ${
                      isActiveChat
                        ? "bg-secondary/10 text-secondary font-semibold border border-secondary/20 shadow-sm"
                        : "text-on-surface hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
                      <span className={`material-symbols-outlined text-[15px] flex-shrink-0 ${catConfig.color}`}>
                        {catConfig.icon}
                      </span>
                      {editingSessionId === s.id ? (
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveTitle(s.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveTitle(s.id, e);
                            if (e.key === "Escape") setEditingSessionId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-surface text-xs font-medium border border-secondary rounded px-1.5 py-0.5 outline-none text-primary"
                        />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{s.title || "Untitled Chat"}</p>
                          {(s.subject_name || s.topic_name) && (
                            <p className="text-[10px] text-on-surface-variant/70 truncate">
                              {s.subject_name} {s.topic_name ? `· ${s.topic_name}` : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {editingSessionId !== s.id && (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(s.id);
                            setEditingTitle(s.title || "");
                          }}
                          className="p-1 rounded-md hover:bg-secondary/15 text-on-surface-variant hover:text-secondary transition-colors"
                          title="Rename"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="p-1 rounded-md hover:bg-error/15 text-on-surface-variant hover:text-error transition-colors"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[13px]">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-on-surface-variant/60 text-xs border border-dashed border-outline-variant/40 rounded-xl">
                <span className="material-symbols-outlined text-[20px] block mb-1 opacity-50">chat</span>
                No conversations yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. ACCOUNT & SETTINGS AT BOTTOM */}
      <div className="p-3 border-t border-outline-variant/60 bg-surface/70 backdrop-blur-sm flex-shrink-0">
        {/* Guest Credits Banner if not logged in */}
        {!user && guestCredits !== null && (
          <div className="mb-2.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-secondary/10 border border-secondary/20 text-secondary text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] animate-pulse">energy_savings_leaf</span>
              {guestCredits} free turns left
            </span>
            <Link href="/signup" className="underline font-semibold hover:opacity-80">
              Sign Up
            </Link>
          </div>
        )}

        {/* User Card & Action Tray */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/settings"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2.5 min-w-0 flex-1 p-1 rounded-xl hover:bg-surface-container-low transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-secondary/20 to-primary/20 border border-outline-variant flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 group-hover:scale-105 transition-transform">
              {user ? user.name?.[0] || user.email?.[0]?.toUpperCase() || "U" : "G"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-primary truncate leading-tight">
                {user ? user.name || user.email?.split("@")[0] || "User" : "Guest Mode"}
              </p>
              <p className="text-[10px] text-on-surface-variant/70 capitalize truncate">
                {user ? user.role || "Student" : "Explore Mode"}
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-0.5">
            <NotificationsPanel />
            <DarkModeToggle />
            {user ? (
              <button
                onClick={signOut}
                className="p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="p-2 rounded-full text-secondary hover:bg-secondary/10 transition-colors flex items-center justify-center"
                title="Sign In"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Toggleable Left Sidebar */}
      <aside
        className={`hidden lg:flex fixed left-0 top-0 bottom-0 w-72 bg-surface border-r border-outline-variant/80 flex-col z-50 shadow-sm transition-transform duration-300 ease-in-out ${
          isDesktopSidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Trigger (Natively Masked in Header) */}
      <div className="lg:hidden fixed top-2 left-3 z-40">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-primary hover:bg-surface-container/70 active:scale-95 transition-all focus:outline-none"
          aria-label="Open Navigation"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
      </div>

      {/* Mobile Slide-out Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-surface h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-250 z-10">
            {renderSidebarContent()}
          </div>
        </div>
      )}
    </>
  );
}
