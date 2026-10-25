"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";

type DBStats = {
  users: number;
  organizations: number;
  subjects: number;
  topics: number;
  projects: number;
  chat_sessions: number;
};

export default function DatabaseAnalytics({ orgId }: { orgId?: string | number }) {
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const url = orgId ? `/api/admin/analytics/db?org_id=${orgId}` : "/api/admin/analytics/db";
        const res = await fetchWithAuth(url);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    loadStats();
  }, [orgId]);

  if (loading) return <div className="p-6 text-on-surface-variant">Loading DB analytics...</div>;
  if (!stats) return <div className="p-6 text-error">Failed to load DB stats.</div>;

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-lowest">
        <h3 className="text-lg font-medium text-on-surface">Database Analytics</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-sm font-medium text-on-surface-variant mb-1">Users</p>
            <p className="text-2xl font-bold text-primary">{stats.users}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-sm font-medium text-on-surface-variant mb-1">Organizations</p>
            <p className="text-2xl font-bold text-primary">{stats.organizations}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-sm font-medium text-on-surface-variant mb-1">Subjects</p>
            <p className="text-2xl font-bold text-primary">{stats.subjects}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-sm font-medium text-on-surface-variant mb-1">Topics</p>
            <p className="text-2xl font-bold text-primary">{stats.topics}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-sm font-medium text-on-surface-variant mb-1">Projects</p>
            <p className="text-2xl font-bold text-primary">{stats.projects}</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
            <p className="text-sm font-medium text-on-surface-variant mb-1">Chat Sessions</p>
            <p className="text-2xl font-bold text-primary">{stats.chat_sessions}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
