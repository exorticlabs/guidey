"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import { fetchWithAuth } from "@/utils/api";

export default function SettingsPage() {
  const { user, signOut, refreshUser } = useAuth();
  
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [copiedReferral, setCopiedReferral] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    preferences: {
      learning_style: "Visual",
      notifications: { email: true, push: false },
      privacy: { show_profile: true }
    }
  });

  useEffect(() => {
    if (!user) return;
    const loadSettings = async () => {
      try {
        const res = await fetchWithAuth("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          setFormData({
            name: data.name || user.name || "",
            preferences: data.preferences || {
              learning_style: "Visual",
              notifications: { email: true, push: false },
              privacy: { show_profile: true }
            }
          });
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [user]);

  if (!user) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center max-w-2xl mx-auto animate-fade-in-up">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6 border border-primary/20 shadow-inner">
          <span className="material-symbols-outlined text-4xl">settings</span>
        </div>
        <h1 className="font-display-lg text-3xl font-bold text-primary mb-3">Account Preferences</h1>
        <p className="font-body-md text-sm text-on-surface-variant mb-8 leading-relaxed">
          Sign in to customize your learning styles, configure notifications, track referral achievements, and manage your account security.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 bg-primary text-on-primary rounded-full font-bold hover:shadow-lg transition-all text-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            Create Free Account
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 border border-outline text-primary rounded-full font-bold hover:bg-surface-container-low transition-all text-sm active:scale-98"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const roleDisplay = user.role === 'clg' ? 'Organisation Admin' : 
                      user.role === 'teacher' ? 'Educator' :
                      user.role === 'admin' ? 'Super Admin' : 'Student';

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetchWithAuth("/api/user/settings", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setSaveMessage("Settings saved successfully!");
        refreshUser(); // Updates the AuthContext if needed
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        setSaveMessage("Failed to save settings.");
      }
    } catch (e) {
      console.error(e);
      setSaveMessage("An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background text-on-background font-body-md pb-24 lg:pb-8 min-h-screen">
      <main className="px-container-margin lg:px-8 pt-6 max-w-screen-md mx-auto animate-fade-in-up">
        <div className="mb-6">
          <h1 className="font-headline-md text-2xl sm:text-3xl font-bold text-primary">
            Settings & Preferences
          </h1>
          <p className="font-body-md text-sm text-on-surface-variant mt-1">
            Manage your profile, learning preferences, and notifications
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center p-12">
            <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Profile Section */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center text-3xl font-bold text-secondary border border-secondary/20 uppercase shadow-inner">
                  {user.avatar || user.email?.[0] || "?"}
                </div>
                <div>
                  <h2 className="font-headline-sm text-2xl font-bold text-primary">{formData.name || user.name || "User"}</h2>
                  <p className="font-body-md text-on-surface-variant mt-1">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-label-sm px-2 py-1 bg-surface-variant text-on-surface-variant rounded-md text-xs uppercase tracking-wider">{roleDisplay}</span>
                    {user.referral_code && (
                      <span className="font-label-sm px-2 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-md text-xs tracking-wider flex items-center gap-1" title="Share this code with friends for more credits!">
                        <span className="material-symbols-outlined text-[12px]">redeem</span>
                        Ref Code: {user.referral_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={signOut}
                className="px-6 py-2 border border-error text-error rounded-full text-sm font-medium hover:bg-error hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </section>
            
            {user.referral_code && (
              <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:justify-between gap-4 animate-fade-in-up">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">redeem</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-primary">Refer a Friend</h3>
                    <p className="text-sm text-on-surface-variant">Share your code to earn 50 tutor tokens for each friend who signs up!</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-surface-container border border-outline-variant rounded-xl p-1.5 pl-4 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="font-mono font-bold text-secondary tracking-wider text-sm select-all">{user.referral_code}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(user.referral_code || "");
                      setCopiedReferral(true);
                      setTimeout(() => setCopiedReferral(false), 2000);
                    }}
                    className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors flex items-center justify-center gap-1.5 hover:text-secondary"
                    title="Copy referral code"
                  >
                    <span className="material-symbols-outlined text-lg">{copiedReferral ? "check" : "content_copy"}</span>
                    <span className="text-xs font-semibold">{copiedReferral ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </section>
            )}

            {/* Save Toast */}
            {saveMessage && (
              <div className={`p-4 rounded-xl text-center font-medium ${saveMessage.includes("success") ? "bg-green-500/20 text-green-700 dark:text-green-300" : "bg-error/20 text-error"}`}>
                {saveMessage}
              </div>
            )}

            {/* Settings Accordion */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
              {/* Account */}
              <div className="border-b border-outline-variant last:border-b-0">
                <button 
                  onClick={() => toggleSection("account")}
                  className="w-full p-5 flex items-center gap-4 hover:bg-surface-container-low transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">person</span>
                  </div>
                  <span className="font-bold text-lg text-primary flex-1">Account Info</span>
                  <span className={`material-symbols-outlined text-outline transition-transform ${activeSection === "account" ? "rotate-90" : ""}`}>chevron_right</span>
                </button>
                {activeSection === "account" && (
                  <div className="p-5 bg-surface-container-lowest border-t border-outline-variant space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-1">Full Name</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 focus:outline-none focus:border-primary text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-1">Email Address</label>
                      <input 
                        type="email" 
                        value={user.email}
                        disabled
                        className="w-full bg-surface-variant border border-outline-variant rounded-xl px-4 py-2 text-on-surface-variant opacity-70 cursor-not-allowed"
                      />
                      <p className="text-xs text-on-surface-variant mt-1">Email cannot be changed directly. Contact support.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Learning Preferences */}
              <div className="border-b border-outline-variant last:border-b-0">
                <button 
                  onClick={() => toggleSection("learning")}
                  className="w-full p-5 flex items-center gap-4 hover:bg-surface-container-low transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined">tune</span>
                  </div>
                  <span className="font-bold text-lg text-primary flex-1">Learning Preferences</span>
                  <span className={`material-symbols-outlined text-outline transition-transform ${activeSection === "learning" ? "rotate-90" : ""}`}>chevron_right</span>
                </button>
                {activeSection === "learning" && (
                  <div className="p-5 bg-surface-container-lowest border-t border-outline-variant space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-on-surface-variant mb-2">Preferred Learning Style</label>
                      <select 
                        value={formData.preferences.learning_style}
                        onChange={e => setFormData({
                          ...formData, 
                          preferences: {...formData.preferences, learning_style: e.target.value}
                        })}
                        className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-primary text-primary appearance-none cursor-pointer"
                      >
                        <option value="Visual">Visual (Diagrams, Videos, Graphs)</option>
                        <option value="Textual">Textual (Reading, Definitions)</option>
                        <option value="Kinesthetic">Kinesthetic (Interactive coding, Practice)</option>
                        <option value="Auditory">Auditory (Listening to explanations)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div className="border-b border-outline-variant last:border-b-0">
                <button 
                  onClick={() => toggleSection("notifications")}
                  className="w-full p-5 flex items-center gap-4 hover:bg-surface-container-low transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined">notifications</span>
                  </div>
                  <span className="font-bold text-lg text-primary flex-1">Notifications</span>
                  <span className={`material-symbols-outlined text-outline transition-transform ${activeSection === "notifications" ? "rotate-90" : ""}`}>chevron_right</span>
                </button>
                {activeSection === "notifications" && (
                  <div className="p-5 bg-surface-container-lowest border-t border-outline-variant space-y-4">
                    <label className="flex items-center justify-between p-3 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors">
                      <div>
                        <span className="block font-medium text-primary">Email Notifications</span>
                        <span className="text-xs text-on-surface-variant">Weekly summaries and major updates</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.preferences.notifications.email}
                        onChange={e => setFormData({
                          ...formData, 
                          preferences: {
                            ...formData.preferences, 
                            notifications: {...formData.preferences.notifications, email: e.target.checked}
                          }
                        })}
                        className="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary"
                      />
                    </label>
                    <label className="flex items-center justify-between p-3 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors">
                      <div>
                        <span className="block font-medium text-primary">Push Notifications</span>
                        <span className="text-xs text-on-surface-variant">Daily reminders and chat messages</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.preferences.notifications.push}
                        onChange={e => setFormData({
                          ...formData, 
                          preferences: {
                            ...formData.preferences, 
                            notifications: {...formData.preferences.notifications, push: e.target.checked}
                          }
                        })}
                        className="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Privacy */}
              <div className="border-b border-outline-variant last:border-b-0">
                <button 
                  onClick={() => toggleSection("privacy")}
                  className="w-full p-5 flex items-center gap-4 hover:bg-surface-container-low transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center text-error">
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <span className="font-bold text-lg text-primary flex-1">Privacy & Security</span>
                  <span className={`material-symbols-outlined text-outline transition-transform ${activeSection === "privacy" ? "rotate-90" : ""}`}>chevron_right</span>
                </button>
                {activeSection === "privacy" && (
                  <div className="p-5 bg-surface-container-lowest border-t border-outline-variant space-y-4">
                    <label className="flex items-center justify-between p-3 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-container-low transition-colors">
                      <div>
                        <span className="block font-medium text-primary">Public Profile</span>
                        <span className="text-xs text-on-surface-variant">Show my progress to organization members</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={formData.preferences.privacy.show_profile}
                        onChange={e => setFormData({
                          ...formData, 
                          preferences: {
                            ...formData.preferences, 
                            privacy: {...formData.preferences.privacy, show_profile: e.target.checked}
                          }
                        })}
                        className="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary"
                      />
                    </label>
                  </div>
                )}
              </div>
            </section>

            <div className="flex justify-end pt-4 border-t border-outline-variant">
              <button
                onClick={handleSave}
                disabled={saving || !activeSection}
                className="px-8 py-3 bg-primary text-on-primary rounded-full font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:hover:shadow-none flex items-center gap-2"
              >
                {saving ? "Saving..." : "Save Settings"}
                {!saving && <span className="material-symbols-outlined text-[20px]">save</span>}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
