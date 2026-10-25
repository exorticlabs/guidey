"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";

type AIStats = {
  total_messages: number;
  total_ai_responses: number;
  tutor_messages: number;
  project_messages: number;
};

export default function AIAnalytics({ orgId }: { orgId?: string | number }) {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const url = orgId ? `/api/admin/analytics/ai?org_id=${orgId}` : "/api/admin/analytics/ai";
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

  if (loading) return <div className="p-6 text-on-surface-variant">Loading AI analytics...</div>;
  if (!stats) return <div className="p-6 text-error">Failed to load AI stats.</div>;

  return (
    <div className="bg-surface border border-outline-variant rounded-2xl shadow-sm overflow-hidden mb-8">
      <div className="px-6 py-5 border-b border-outline-variant bg-surface-container-lowest">
        <h3 className="text-lg font-medium text-on-surface">AI Usage Analytics</h3>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-primary-container/20 border border-primary/20 rounded-xl p-4">
          <p className="text-sm font-medium text-primary mb-1">Total Platform Messages</p>
          <p className="text-3xl font-bold text-on-surface">{stats.total_messages}</p>
        </div>
        <div className="bg-secondary-container/20 border border-secondary/20 rounded-xl p-4">
          <p className="text-sm font-medium text-secondary mb-1">Total AI Responses</p>
          <p className="text-3xl font-bold text-on-surface">{stats.total_ai_responses}</p>
        </div>
        <div className="bg-surface-variant/50 border border-outline-variant rounded-xl p-4">
          <p className="text-sm font-medium text-on-surface-variant mb-1">Tutor Messages</p>
          <p className="text-3xl font-bold text-on-surface">{stats.tutor_messages}</p>
        </div>
        <div className="bg-surface-variant/50 border border-outline-variant rounded-xl p-4">
          <p className="text-sm font-medium text-on-surface-variant mb-1">Project Messages</p>
          <p className="text-3xl font-bold text-on-surface">{stats.project_messages}</p>
        </div>
      </div>
    </div>
  );
}
