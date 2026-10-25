"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/utils/api";
import { supabase } from "@/utils/supabase";
import { API_URL } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";
import AuthGateModal from "@/components/AuthGateModal";

export default function SubjectsPage() {
  const { user } = useAuth();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [isSoloLearner, setIsSoloLearner] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [newSubject, setNewSubject] = useState({ name: "", code: "", tag: "Core", syllabus_content: "" });
  const [createError, setCreateError] = useState("");

  const [importCode, setImportCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);
  const [authGateTitle, setAuthGateTitle] = useState("");
  const [authGateDesc, setAuthGateDesc] = useState("");
  const [viewTab, setViewTab] = useState<"active" | "templates">("active");

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingSubject(null);
    setNewSubject({ name: "", code: "", tag: "Core", syllabus_content: "" });
    setCreateError("");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);

  const handleSyllabusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSyllabus(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/api/tutor/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setNewSubject(prev => ({ ...prev, syllabus_content: data.content_preview || "" }));
      } else {
        alert("Failed to upload and parse syllabus.");
      }
    } catch (err) {
      console.error(err);
      alert("Error parsing syllabus file.");
    } finally {
      setUploadingSyllabus(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImportSubject = async (templateId?: number, shareCode?: string) => {
    if (!user) {
      setAuthGateTitle(templateId ? "Import Public Template" : "Import Shared Subject");
      setAuthGateDesc("Sign in to import this subject to your learning dashboard and start studying.");
      setIsAuthGateOpen(true);
      return;
    }

    setImporting(true);
    setImportError("");
    try {
      const res = await fetchWithAuth("/api/subjects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_code: shareCode || undefined,
          template_id: templateId || undefined
        })
      });
      if (res.ok) {
        // Reload subjects
        const reloadRes = await fetchWithAuth("/api/subjects/all");
        if (reloadRes.ok) {
          setSubjects(await reloadRes.json());
        }
        setImportCode("");
        if (templateId) {
          alert("Template added to your dashboard successfully!");
        } else {
          alert("Shared subject imported successfully!");
        }
      } else {
        const errData = await res.json();
        setImportError(errData.detail || "Failed to import subject.");
        alert(errData.detail || "Failed to import subject.");
      }
    } catch (e) {
      setImportError("Connection error.");
      alert("Failed to import subject due to connection error.");
    } finally {
      setImporting(false);
    }
  };

  const isTemplateImported = (templateCode: string) => {
    return subjects.some(s => s.code === templateCode);
  };

  const getImportedSubjectId = (templateCode: string) => {
    return subjects.find(s => s.code === templateCode)?.id;
  };

  useEffect(() => {
    setViewTab(user ? "active" : "templates");
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load templates
        const tempRes = await fetch(`${API_URL}/api/subjects/templates`);
        if (tempRes.ok) {
          setTemplates(await tempRes.json());
        }

        if (user) {
          const [subRes, meRes] = await Promise.all([
            fetchWithAuth("/api/subjects/all"),
            fetchWithAuth("/api/users/me")
          ]);
          if (subRes.ok) {
            setSubjects(await subRes.json());
          }
          if (meRes.ok) {
            const me = await meRes.json();
            setIsSoloLearner(me.org_id === null);
          }
        } else {
          setSubjects([]);
          setIsSoloLearner(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  const currentItems = viewTab === "active" ? subjects : templates;

  const filteredSubjects = subjects.filter(sub => {
    const matchesSearch = (sub.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || (sub.code || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "All" || sub.tag === activeTab;
    return matchesSearch && matchesTab;
  });

  const filteredTemplates = templates.filter(temp => {
    const matchesSearch = (temp.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || (temp.code || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "All" || temp.tag === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="bg-background text-on-background font-body-md pb-24 lg:pb-8 flex flex-col min-h-screen">
      <main className="px-container-margin lg:px-8 pt-4 sm:pt-6 max-w-screen-xl w-full mx-auto flex flex-col gap-6">
        {/* Subjects Header & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest/70 border border-outline-variant rounded-2xl p-3.5 sm:p-4 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input
              type="text"
              placeholder={viewTab === "active" ? "Search subjects..." : "Search templates..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl pl-10 pr-4 py-2 sm:py-2.5 font-body-md text-sm text-primary focus:outline-none focus:border-secondary transition-colors"
            />
          </div>

          {(isSoloLearner || !user) && (
            <button
              onClick={() => {
                if (!user) {
                  setAuthGateTitle("Create Custom Subject");
                  setAuthGateDesc("Sign in to build your own custom subject, upload textbook syllabi, and set up your personal learning objectives.");
                  setIsAuthGateOpen(true);
                } else {
                  setEditingSubject(null);
                  setNewSubject({ name: "", code: "", tag: "Core", syllabus_content: "" });
                  setShowCreateModal(true);
                }
              }}
              className="bg-primary text-on-primary hover:bg-primary/95 px-4 py-2 sm:py-2.5 rounded-xl font-label-md flex items-center justify-center gap-2 shadow-xs transition-all text-xs sm:text-sm font-semibold whitespace-nowrap active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Subject
            </button>
          )}
        </div>
        {/* Import Box */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
          <div className="flex-1 flex flex-col gap-1">
            <h2 className="text-primary font-bold text-base">Import Shared Subject</h2>
            <p className="text-xs text-on-surface-variant">Enter a share code shared by a peer or educator to copy their subject curriculum.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch mt-2 md:mt-0">
            <input
              type="text"
              placeholder="e.g. SUB-A8C3D2"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              className="bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-secondary uppercase min-w-[200px]"
            />
            <button
              onClick={() => handleImportSubject(undefined, importCode)}
              disabled={importing || !importCode.trim()}
              className="bg-secondary text-on-secondary hover:bg-secondary/90 px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {importing ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">download</span>
              )}
              Import
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex border-b border-outline-variant">
          <button
            onClick={() => { setViewTab("active"); setActiveTab("All"); }}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${viewTab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
          >
            My Subjects
          </button>
          <button
            onClick={() => { setViewTab("templates"); setActiveTab("All"); }}
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${viewTab === "templates"
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
          >
            Public Exam Templates
          </button>
        </div>

        {/* Tags filtering */}
        {((viewTab === "active" && user && subjects.length > 0) || (viewTab === "templates" && templates.length > 0)) && (
          <div className="flex items-center gap-sm overflow-x-auto pb-2 hide-scrollbar">
            {['All', ...Array.from(new Set(currentItems.map(s => s.tag).filter(Boolean)))].map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTab(tag)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full font-label-md transition-all ${activeTab === tag
                    ? 'bg-secondary text-on-primary shadow-sm'
                    : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-container-high'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Tab contents */}
        {viewTab === "active" ? (
          !user ? (
            <div className="text-center py-16 px-4 bg-surface-container-lowest border border-outline-variant rounded-3xl w-full max-w-2xl mx-auto flex flex-col items-center shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 border border-primary/10">
                <span className="material-symbols-outlined text-3xl">lock</span>
              </div>
              {/* <h3 className="text-primary font-bold text-lg mb-2">Save & Track Your Subjects</h3> */}
              <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
                Sign in to create custom subjects, save textbooks, and let the AI generate personalized learning paths and interactive quiz maps just for you.
              </p>
              <button
                onClick={() => {
                  setAuthGateTitle("My Subjects Dashboard");
                  setAuthGateDesc("Create a free account to track your syllabus progress, customize units, and take learning checks.");
                  setIsAuthGateOpen(true);
                }}
                className="bg-primary text-on-primary hover:bg-primary/95 px-6 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm"
              >
                Get Started
              </button>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">menu_book</span>
              <p>No subjects found. Create a new subject or browse public templates to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {filteredSubjects.map((course: any) => (
                <Link
                  key={course.id}
                  href={`/subject/${course.id}`}
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md hover:border-secondary/50 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-1 rounded-sm">
                      {course.tag}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-label-sm text-label-sm text-secondary">
                        {course.code}
                      </span>
                      {isSoloLearner && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingSubject(course);
                            setNewSubject({
                              name: course.title,
                              code: course.code,
                              tag: course.tag || "Core",
                              syllabus_content: course.syllabus_content || ""
                            });
                            setShowCreateModal(true);
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                          title="Edit Subject"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="font-body-lg text-body-lg font-semibold text-primary mb-2 group-hover:text-secondary transition-colors">
                    {course.title}
                  </h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">group</span>
                      {course.active_users} active
                    </div>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-2 mb-2">
                    <div
                      className="bg-secondary h-2 rounded-full transition-all"
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-label-sm text-label-sm text-secondary">
                      {course.progress}% complete
                    </span>
                    <span className="material-symbols-outlined text-secondary text-[18px] group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">school</span>
            <p>No template exam curricula match your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {filteredTemplates.map((temp: any) => {
              const imported = isTemplateImported(temp.code);
              const importedId = getImportedSubjectId(temp.code);
              return (
                <div
                  key={temp.id}
                  className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm hover:shadow-md hover:border-secondary/50 transition-all flex flex-col justify-between h-full min-h-[220px]"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-1 rounded-sm">
                        {temp.tag}
                      </span>
                      <span className="font-label-sm text-label-sm text-secondary">
                        {temp.code}
                      </span>
                    </div>
                    <h3 className="font-body-lg text-body-lg font-semibold text-primary mb-2">
                      {temp.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant line-clamp-3 mb-4 leading-relaxed">
                      {temp.syllabus_content || "Standard curriculum exam prep template."}
                    </p>
                  </div>
                  <div className="mt-4">
                    {imported ? (
                      <Link
                        href={`/subject/${importedId}`}
                        className="w-full bg-secondary/10 hover:bg-secondary/15 text-secondary py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-sm border border-secondary/20"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                        View in Dashboard
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleImportSubject(temp.id)}
                        disabled={importing}
                        className="w-full bg-primary text-on-primary hover:bg-primary/95 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors text-sm shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[18px]">add_circle</span>
                        Add to Dashboard
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-headline-sm text-primary font-bold text-lg">
                {editingSubject ? "Edit Subject" : "Create Subject"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {createError && (
              <div className="bg-error/10 text-error p-3 rounded-lg text-sm mb-4">
                {createError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">Subject Name</label>
                <input
                  type="text"
                  placeholder="e.g. Data Structures and Algorithms"
                  value={newSubject.name}
                  onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2 text-primary focus:outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">Subject Code</label>
                <input
                  type="text"
                  placeholder="e.g. DSA-101"
                  value={newSubject.code}
                  onChange={(e) => setNewSubject({ ...newSubject, code: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2 text-primary focus:outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">Category / Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science, Science, Math"
                  value={newSubject.tag}
                  onChange={(e) => setNewSubject({ ...newSubject, tag: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2 text-primary focus:outline-none focus:border-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Syllabus Content (Optional)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleSyllabusUpload}
                    className="hidden"
                    accept=".pdf,.txt,.md"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingSyllabus}
                    className="flex-1 px-4 py-2 border border-outline border-dashed rounded-xl text-primary font-medium hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${uploadingSyllabus ? 'animate-spin' : ''}`}>
                      {uploadingSyllabus ? 'refresh' : 'upload_file'}
                    </span>
                    {uploadingSyllabus ? 'Parsing syllabus...' : 'Upload Syllabus (PDF, TXT, MD)'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Paste syllabus text content here, or upload a file above to extract text..."
                  value={newSubject.syllabus_content}
                  onChange={(e) => setNewSubject({ ...newSubject, syllabus_content: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2 text-sm text-primary focus:outline-none focus:border-secondary font-sans resize-y"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 border border-outline text-primary rounded-full hover:bg-surface-container-high transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newSubject.name || !newSubject.code) {
                    setCreateError("Name and Code are required.");
                    return;
                  }
                  try {
                    const url = editingSubject ? `/api/subjects/${editingSubject.id}` : "/api/subjects";
                    const method = editingSubject ? "PUT" : "POST";
                    const res = await fetchWithAuth(url, {
                      method: method,
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(newSubject)
                    });
                    if (res.ok) {
                      handleCloseModal();
                      const reloadRes = await fetchWithAuth("/api/subjects/all");
                      if (reloadRes.ok) {
                        setSubjects(await reloadRes.json());
                      }
                    } else {
                      const errData = await res.json();
                      setCreateError(errData.detail || `Failed to ${editingSubject ? "update" : "create"} subject.`);
                    }
                  } catch (err) {
                    setCreateError("An unexpected error occurred.");
                  }
                }}
                className="px-6 py-2 bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors shadow-sm font-medium"
              >
                {editingSubject ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthGateModal
        isOpen={isAuthGateOpen}
        onClose={() => setIsAuthGateOpen(false)}
        title={authGateTitle}
        description={authGateDesc}
      />
    </div>
  );
}
