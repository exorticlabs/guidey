"use client";

import { useEffect } from "react";
import { API_URL } from "@/utils/api";

export default function KeepAliveBot() {
  useEffect(() => {
    // Ping backend every 5 minutes (300000ms) to keep the Render service active
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/health?t=${Date.now()}`, { cache: "no-store" })
        .then((res) => {
          if (res.ok) {
            console.log("[KeepAliveBot] Backend render is alive.");
          }
        })
        .catch((err) => {
          console.warn("[KeepAliveBot] Failed to ping backend health check:", err);
        });
    }, 5 * 60 * 1000);

    // Initial ping on load
    fetch(`${API_URL}/api/health?t=${Date.now()}`, { cache: "no-store" }).catch(() => {});

    return () => clearInterval(interval);
  }, []);

  return null;
}
