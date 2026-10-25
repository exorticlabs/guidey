import { supabase } from "./supabase";

let rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

if (typeof window !== "undefined") {
  if (window.location.hostname === "localhost") {
    rawApiUrl = "http://localhost:8000";
  }
}

if (rawApiUrl.endsWith("/") || rawApiUrl.endsWith(".")) {
  rawApiUrl = rawApiUrl.replace(/[./]+$/, "");
}
export const API_URL = rawApiUrl;

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  let token: string | undefined = undefined;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch (e) {
    console.warn("Supabase auth failed", e);
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;

  return fetch(url, {
    ...options,
    headers,
  });
}
