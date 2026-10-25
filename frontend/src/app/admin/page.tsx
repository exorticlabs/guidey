"use client";

import { useAuth } from "@/components/AuthContext";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";
import ManageOrganizations from "./ManageOrganizations";
import AIAnalytics from "./AIAnalytics";
import DatabaseAnalytics from "./DatabaseAnalytics";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total_orgs: 0, active_learners: 0, solo_learners: 0 });
  const [orgs, setOrgs] = useState<{id: number, name: string}[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetchWithAuth("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Failed to load admin stats", e);
      }
    };
    const loadOrgs = async () => {
      try {
        const res = await fetchWithAuth("/api/admin/orgs");
        if (res.ok) {
          const data = await res.json();
          setOrgs(data);
        }
      } catch (e) {}
    };
    if (user?.role === "admin") {
      loadStats();
      loadOrgs();
    }
  }, [user]);

  if (user?.role !== "admin") return null;

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display-md text-primary tracking-tight">
            Admin Control Panel
          </h1>
          <p className="text-on-surface-variant mt-2 font-body-md">
            Global overview of all colleges and solo learners on guiEDTeach.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-on-surface-variant mb-1">
              Total Organizations
            </h3>
            <p className="text-3xl font-bold text-primary">{stats.total_orgs}</p>
          </div>
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-on-surface-variant mb-1">
              Active Learners
            </h3>
            <p className="text-3xl font-bold text-primary">{stats.active_learners}</p>
          </div>
          <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-on-surface-variant mb-1">
              Solo Learners
            </h3>
            <p className="text-3xl font-bold text-primary">{stats.solo_learners}</p>
          </div>
        </div>

        <div className="bg-surface border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Analytics Filters</h2>
            <p className="text-sm text-on-surface-variant">Filter the analytics sections below by a specific organization.</p>
          </div>
          <select 
            value={selectedOrgId} 
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="px-4 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary min-w-[250px]"
          >
            <option value="">All Organizations (Global)</option>
            {orgs.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>

        <AIAnalytics orgId={selectedOrgId || undefined} />
        <DatabaseAnalytics orgId={selectedOrgId || undefined} />
        
        <ManageOrganizations />
      </div>
    </div>
  );
}
