"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";

type Announcement = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author_name: string;
};

export default function AnnouncementsDashboard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", success: "" });

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const res = await fetchWithAuth("/api/org/announcements");
      if (res.ok) {
        setAnnouncements(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    setStatus({ loading: true, error: "", success: "" });
    try {
      const res = await fetchWithAuth("/api/org/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      });
      if (!res.ok) throw new Error("Failed to create announcement");
      setStatus({ loading: false, error: "", success: "Announcement broadcasted successfully!" });
      setTitle("");
      setContent("");
      loadAnnouncements();
      setTimeout(() => setStatus(s => ({ ...s, success: "" })), 3000);
    } catch (err: any) {
      setStatus({ loading: false, error: err.message, success: "" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await fetchWithAuth(`/api/org/announcements/${id}`, { method: "DELETE" });
      loadAnnouncements();
    } catch (e) {
      alert("Failed to delete announcement.");
    }
  };

  if (loading) return <div className="p-8 text-on-surface-variant">Loading announcements...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="font-display-lg text-2xl sm:text-3xl lg:text-4xl text-primary font-bold mb-1">
          Broadcast Announcements
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Create and manage important announcements. These will appear on all your students' home dashboards immediately.
        </p>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 mb-8 shadow-sm">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">campaign</span>
          New Broadcast
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Headline</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Midterm Exams Next Week"
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-primary focus:outline-none focus:border-secondary transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Message</label>
            <textarea 
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your announcement details here..."
              rows={4}
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-2 text-primary focus:outline-none focus:border-secondary transition-colors resize-y"
              required
            />
          </div>
          <div className="flex items-center gap-4">
            <button 
              type="submit" 
              disabled={status.loading || !title || !content}
              className="bg-secondary text-on-secondary px-6 py-2 rounded-lg font-label-md hover:bg-secondary/90 transition-colors disabled:opacity-50"
            >
              {status.loading ? "Broadcasting..." : "Broadcast Now"}
            </button>
            {status.success && <span className="text-sm text-tertiary-container font-medium">{status.success}</span>}
            {status.error && <span className="text-sm text-error font-medium">{status.error}</span>}
          </div>
        </form>
      </div>

      <div>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">Past Announcements</h2>
        {announcements.length === 0 ? (
          <p className="text-on-surface-variant italic text-sm">No announcements have been broadcasted yet.</p>
        ) : (
          <div className="space-y-4">
            {announcements.map(a => (
              <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex justify-between gap-4 hover:-translate-y-0.5 transition-transform">
                <div>
                  <h3 className="font-body-lg text-primary font-bold mb-1">{a.title}</h3>
                  <p className="font-body-md text-on-surface-variant mb-3">{a.content}</p>
                  <p className="text-xs text-on-surface-variant opacity-70">
                    Broadcasted by {a.author_name} on {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <button 
                  onClick={() => handleDelete(a.id)}
                  className="text-error hover:bg-error/10 w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0"
                  title="Delete Announcement"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
