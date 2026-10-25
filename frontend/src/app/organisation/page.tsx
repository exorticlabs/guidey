"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/utils/api";

function CreateStudentForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", success: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true, error: "", success: "" });
    try {
      const res = await fetchWithAuth("/api/org/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create student");
      setStatus({ loading: false, error: "", success: `Student created successfully! Email: ${email} | Password: ${data.password}` });
      setName("");
      setEmail("");
    } catch (err: any) {
      setStatus({ loading: false, error: err.message, success: "" });
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mt-lg">
      <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">
        Create Student Account
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-xxl">
        <input
          type="text"
          placeholder="Student Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="appearance-none block w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface placeholder-outline text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
        />
        <input
          type="email"
          placeholder="Student Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="appearance-none block w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface placeholder-outline text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
        />
        <button
          type="submit"
          disabled={status.loading}
          className="bg-secondary text-white py-2 rounded-lg font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50"
        >
          {status.loading ? "Creating..." : "Create Student"}
        </button>
        {status.error && <p className="text-error text-sm mt-1">{status.error}</p>}
        {status.success && <p className="text-tertiary-container text-sm mt-1">{status.success}</p>}
      </form>
    </div>
  );
}

export default function OrganisationDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const res = await fetchWithAuth("/api/org/groups");
        setGroups(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    loadGroups();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!data) setLoading(true);
      try {
        const groupQuery = selectedGroups.length > 0 ? `?groups=${selectedGroups.join(',')}` : '';
        const [profileRes, summaryRes, liveRes, insightsRes] = await Promise.all([
          fetchWithAuth("/api/org/profile"),
          fetchWithAuth(`/api/org/analytics/summary${groupQuery}`),
          fetchWithAuth(`/api/org/analytics/live${groupQuery}`),
          fetchWithAuth(`/api/org/analytics/insights${groupQuery}`)
        ]);

        if (profileRes.ok) {
          setData({
            profile: await profileRes.json(),
            summary: await summaryRes.json(),
            live: await liveRes.json(),
            insights: await insightsRes.json()
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedGroups]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  if (!data || !data.profile) return <div>Failed to load backend.</div>;

  const { profile, summary, live, insights } = data;

  return (
    <>
      {/* Header & Context */}
        <div className="mb-lg">
          <div className="flex justify-between items-end mb-xs">
            <div>
              <h1 className="font-headline-sm text-headline-sm text-primary">
                {profile?.name}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                College Dashboard
              </p>
            </div>
            <div className="bg-surface-container-highest px-3 py-1 rounded-full border border-outline-variant flex items-center gap-1">
              <span className="font-label-md text-label-md text-primary">
                {profile?.current_semester}
              </span>
              <span className="material-symbols-outlined text-[16px]">
                arrow_drop_down
              </span>
            </div>
          </div>
          
          <div className="relative mt-md flex flex-wrap gap-2 items-center bg-surface-container border border-outline-variant rounded-xl p-3 shadow-sm">
            <span className="material-symbols-outlined text-outline text-[20px] mr-1">filter_list</span>
            <span className="text-sm font-bold text-on-surface-variant uppercase mr-2">Filter Cohort:</span>
            {groups.length === 0 ? (
              <span className="text-sm italic text-on-surface-variant">No groups defined.</span>
            ) : (
              groups.map(g => {
                const isActive = selectedGroups.includes(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroups(prev => isActive ? prev.filter(id => id !== g.id) : [...prev, g.id])}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                      isActive 
                        ? 'bg-secondary text-white border-secondary shadow-md scale-105' 
                        : 'bg-surface border-outline-variant text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="opacity-70 mr-1">{g.key}:</span>{g.value}
                  </button>
                );
              })
            )}
            {selectedGroups.length > 0 && (
               <button onClick={() => setSelectedGroups([])} className="ml-auto text-xs font-bold text-secondary hover:underline px-2 transition-colors">Clear Filters</button>
            )}
          </div>
        </div>

        {/* Analytics Grid — 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-gutter mb-lg">
          <div className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant rounded-2xl p-md flex flex-col justify-between h-32 hover:-translate-y-1 transition-transform shadow-sm">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl text-secondary">group</span>
            </div>
            <div className="flex justify-between items-start relative z-10">
              <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-medium">
                Active Students
              </span>
              <div className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim animate-pulse shadow-[0_0_8px_rgba(var(--tertiary),0.8)]"></div>
            </div>
            <div className="flex items-baseline gap-1 relative z-10">
              <span className="font-display-md text-display-md text-primary font-bold">
                {summary?.active_students.toLocaleString()}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                online
              </span>
            </div>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-surface-container-lowest to-secondary/5 border border-outline-variant rounded-2xl p-md flex flex-col justify-between h-32 hover:-translate-y-1 transition-transform shadow-sm">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl text-secondary">schedule</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-medium relative z-10">
              Learning Hrs
            </span>
            <div className="flex items-baseline gap-1 relative z-10">
              <span className="font-display-md text-display-md text-primary font-bold">
                {summary?.learning_hours_weekly}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                /wk
              </span>
            </div>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-surface-container-lowest to-tertiary-container/10 border border-outline-variant rounded-2xl p-md flex flex-col justify-between h-32 hover:-translate-y-1 transition-transform shadow-sm">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl text-tertiary-container">psychology</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-medium relative z-10">
              AI Engagement
            </span>
            <div className="flex items-baseline gap-1 relative z-10">
              <span className="font-display-md text-display-md text-primary font-bold">
                {summary?.ai_engagement_percent}%
              </span>
            </div>
            <div className="w-full bg-surface-container h-1.5 mt-2 rounded-full overflow-hidden relative z-10">
              <div className="bg-secondary h-full rounded-full transition-all duration-1000" style={{ width: `${summary?.ai_engagement_percent}%` }}></div>
            </div>
          </div>
          <div className="relative overflow-hidden bg-gradient-to-br from-surface-container-lowest to-primary/5 border border-outline-variant rounded-2xl p-md flex flex-col justify-between h-32 hover:-translate-y-1 transition-transform shadow-sm">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <span className="material-symbols-outlined text-6xl text-primary">task_alt</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-medium relative z-10">
              Completion
            </span>
            <div className="flex items-baseline gap-1 relative z-10">
              <span className="font-display-md text-display-md text-primary font-bold">
                {summary?.completion_percent}%
              </span>
            </div>
            <div className="w-full bg-surface-container h-1.5 mt-2 rounded-full overflow-hidden relative z-10">
              <div
                className="bg-tertiary-fixed-dim h-full rounded-full transition-all duration-1000"
                style={{ width: `${summary?.completion_percent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-lg">
          <h2 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">
            Quick Actions
          </h2>
          <div className="flex overflow-x-auto gap-gutter no-scrollbar pb-2 lg:grid lg:grid-cols-4 lg:overflow-x-visible">
            <Link href="/organisation/settings/groups" className="flex-none lg:flex-auto bg-primary text-on-primary border border-primary rounded-lg p-sm flex flex-col items-center justify-center w-28 lg:w-auto h-24 cursor-pointer hover:bg-primary/90 transition-colors">
              <span className="material-symbols-outlined mb-2">account_tree</span>
              <span className="font-label-sm text-label-sm text-center">
                Manage Hierarchy
              </span>
            </Link>
            <div className="flex-none lg:flex-auto bg-surface-container-lowest text-primary border border-outline-variant rounded-lg p-sm flex flex-col items-center justify-center w-28 lg:w-auto h-24 cursor-pointer active:scale-95 transition-transform hover:bg-surface-container-low">
              <span className="material-symbols-outlined mb-2 text-secondary">
                person_add
              </span>
              <span className="font-label-sm text-label-sm text-center">
                Add Teacher
              </span>
            </div>
            <div className="flex-none lg:flex-auto bg-surface-container-lowest text-primary border border-outline-variant rounded-lg p-sm flex flex-col items-center justify-center w-28 lg:w-auto h-24 cursor-pointer active:scale-95 transition-transform hover:bg-surface-container-low">
              <span className="material-symbols-outlined mb-2 text-secondary">
                group_add
              </span>
              <span className="font-label-sm text-label-sm text-center">
                Bulk Upload
              </span>
            </div>
            <div className="flex-none lg:flex-auto bg-surface-container-lowest text-primary border border-outline-variant rounded-lg p-sm flex flex-col items-center justify-center w-28 lg:w-auto h-24 cursor-pointer active:scale-95 transition-transform hover:bg-surface-container-low">
              <span className="material-symbols-outlined mb-2 text-secondary">
                analytics
              </span>
              <span className="font-label-sm text-label-sm text-center">
                Reports
              </span>
            </div>
          </div>
        </div>

        {/* Desktop: two column layout */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-lg">
          <div className="lg:col-span-2 mb-lg lg:mb-0">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col justify-center items-center text-center min-h-[200px]">
              <span className="material-symbols-outlined text-4xl text-secondary mb-2">account_tree</span>
              <h2 className="text-xl font-bold text-primary mb-2">Academic Structure</h2>
              <p className="text-on-surface-variant text-sm max-w-2xl mx-auto">
                Your institution's hierarchy has been upgraded to support dynamic nesting. You can now build custom structures like Branch → Department → Semester.
              </p>
              <Link href="/organisation/settings/groups" className="mt-4 bg-secondary text-white px-4 py-2 rounded-lg font-medium hover:bg-secondary/90 transition-colors">
                Configure Hierarchy
              </Link>
            </div>
            
            {/* Create Student Form */}
            <CreateStudentForm />
          </div>

          {/* Right column: Live Activity + AI Insights */}
          <div className="flex flex-col gap-md mb-lg lg:mb-0">
            {/* Live Activity */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
              <div className="flex items-center gap-2 mb-sm">
                <div className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-pulse"></div>
                <h2 className="font-label-md text-label-md text-primary uppercase tracking-wider">
                  Live Activity
                </h2>
              </div>
              <div className="space-y-3">
                {live?.map((l: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b border-surface-container pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-outline">database</span>
                      <span className="font-body-md text-body-md text-primary">{l.name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant">
                      <span className="text-secondary font-medium">{l.active_users}</span> active
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-primary text-on-primary rounded-xl p-md relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary/20 rounded-full blur-xl"></div>
              <div className="flex items-center gap-2 mb-sm relative z-10">
                <span className="material-symbols-outlined text-tertiary-fixed-dim">psychology</span>
                <h2 className="font-label-md text-label-md text-tertiary-fixed-dim uppercase tracking-wider">
                  AI Insights: Difficulty
                </h2>
              </div>
              <p className="font-body-md text-body-md text-outline-variant mb-3 relative z-10">
                Top institutional bottlenecks detected this week.
              </p>
              <div className="space-y-2 relative z-10">
                {insights?.map((i: any) => (
                  <div key={i.rank} className="bg-surface-container-highest/10 border border-outline/30 rounded p-2 flex items-center gap-3">
                    <span className="font-label-md text-label-md text-tertiary-fixed-dim bg-tertiary-fixed-dim/20 w-6 h-6 flex items-center justify-center rounded">
                      {i.rank}
                    </span>
                    <span className="font-body-md text-body-md">{i.bottleneck_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>
    </>
  );
}
