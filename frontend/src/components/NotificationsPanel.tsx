"use client";

import { useState, useEffect, useRef } from "react";

type Notification = {
  id: number;
  title: string;
  message: string;
  read: boolean;
  category: string;
  timestamp: string;
};

const CATEGORY_ICONS: Record<string, string> = {
  assessment: "quiz",
  achievement: "emoji_events",
  reminder: "schedule",
  general: "info",
};

import { fetchWithAuth } from "@/utils/api";

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWithAuth("/api/user/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setNotifications(data);
        } else {
          setNotifications([]);
        }
      })
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications?.filter((n) => !n?.read).length || 0;

  const markRead = (id: number) => {
    fetchWithAuth(`/api/user/notifications/${id}/read`, { method: "POST" })
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      });
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-surface-container-low transition-colors rounded-full text-on-surface-variant active:scale-95 duration-150 ease-in-out relative"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-[calc(100vw-2rem)] sm:w-80 max-h-96 overflow-y-auto bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
          <div className="p-3 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-headline-sm text-headline-sm text-primary text-base">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="font-label-sm text-label-sm text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-on-surface-variant font-body-md">
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-left p-3 border-b border-outline-variant/50 flex gap-3 items-start hover:bg-surface-container-low transition-colors ${
                  !n.read ? "bg-secondary/5" : ""
                }`}
              >
                <span
                  className={`material-symbols-outlined mt-0.5 text-sm ${
                    !n.read ? "text-secondary" : "text-outline"
                  }`}
                >
                  {CATEGORY_ICONS[n.category] || "info"}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-body-md text-sm truncate ${
                      !n.read
                        ? "text-primary font-medium"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {n.title}
                  </p>
                  <p className="font-label-sm text-label-sm text-outline mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                </div>
                {!n.read && (
                  <div className="w-2 h-2 rounded-full bg-secondary mt-2 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
