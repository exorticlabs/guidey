"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings Form State
  const [name, setName] = useState("");
  const [currentSemester, setCurrentSemester] = useState("");
  const [aiPersona, setAiPersona] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetchWithAuth("/api/org/profile");
        if (res.ok) {
          const data = await res.json();
          setName(data.name || "");
          setCurrentSemester(data.current_semester || "");
          setAiPersona(data.teaching_style || "Friendly");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    try {
      // Save general settings
      await fetchWithAuth("/api/org/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, current_semester: currentSemester })
      });
      // Save AI Persona
      await fetchWithAuth("/api/org/config/ai-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style: aiPersona })
      });
      
      setSuccessMsg("Settings saved successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 max-w-3xl">
      <div className="mb-lg">
        <h1 className="font-display-lg text-2xl sm:text-3xl lg:text-4xl text-primary font-bold mb-1">
          Organisation Settings
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Configure your institution's profile and global AI preferences.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-lg">
        {/* Profile Settings */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/50">
            <span className="material-symbols-outlined text-secondary text-2xl">apartment</span>
            <h2 className="font-headline-sm text-headline-sm text-primary">Institution Profile</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block font-label-md text-label-md text-primary mb-2">Institution Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full max-w-xxl bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-primary mb-2">Current Academic Term</label>
              <input 
                type="text" 
                value={currentSemester} 
                onChange={e => setCurrentSemester(e.target.value)}
                placeholder="e.g. Fall 2026"
                className="w-full max-w-xxl bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
              />
            </div>
          </div>
        </div>

        {/* AI Configuration */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-lg">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-outline-variant/50">
            <span className="material-symbols-outlined text-secondary text-2xl">psychology</span>
            <h2 className="font-headline-sm text-headline-sm text-primary">Global AI Preferences</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block font-label-md text-label-md text-primary mb-2">Default Teaching Style</label>
              <p className="font-body-sm text-on-surface-variant mb-4">
                This sets the baseline persona for the AI Tutor across all departments, unless overridden by specific teachers.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "Friendly", icon: "sentiment_satisfied", desc: "Supportive and encouraging" },
                  { id: "Socratic", icon: "question_mark", desc: "Guides with questions" },
                  { id: "Direct", icon: "straight", desc: "Factual and to the point" },
                  { id: "Storyteller", icon: "auto_stories", desc: "Uses analogies and tales" }
                ].map(style => (
                  <div 
                    key={style.id}
                    onClick={() => setAiPersona(style.id)}
                    className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 ${
                      aiPersona === style.id 
                        ? 'bg-secondary/10 border-secondary ring-1 ring-secondary' 
                        : 'bg-surface-container hover:bg-surface-container-high border-outline-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`material-symbols-outlined text-[20px] ${aiPersona === style.id ? 'text-secondary' : 'text-outline'}`}>
                        {style.icon}
                      </span>
                      <span className={`font-label-lg font-medium ${aiPersona === style.id ? 'text-secondary' : 'text-primary'}`}>
                        {style.id}
                      </span>
                    </div>
                    <p className="font-body-sm text-on-surface-variant ml-7">{style.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center gap-4 pt-4">
          <button 
            type="submit" 
            disabled={saving}
            className="bg-primary text-on-primary px-8 py-3 rounded-full font-label-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">save</span>
            )}
            Save Changes
          </button>
          
          {successMsg && (
            <span className="text-tertiary-container flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              {successMsg}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
