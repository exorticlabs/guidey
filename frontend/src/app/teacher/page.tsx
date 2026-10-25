"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";

interface Student {
  id: string;
  name: string;
  email: string;
  progress: number;
  learning_hours: number;
}

interface ClassAnalytics {
  students: Student[];
  average_progress: number;
  average_hours: number;
}

interface ClassItem {
  id: number;
  name: string;
  subject_name: string;
  student_count: number;
  created_at: string;
}

interface Syllabus {
  title: string;
  content: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  
  const [syllabus, setSyllabus] = useState<Syllabus>({ title: "", content: "" });
  const [isSavingSyllabus, setIsSavingSyllabus] = useState(false);
  const [activeTab, setActiveTab] = useState<"analytics" | "syllabus">("analytics");

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadClassData(selectedClassId);
    }
  }, [selectedClassId]);

  const loadClasses = async () => {
    try {
      const res = await fetchWithAuth("/api/teacher/classes");
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        if (data.length > 0 && !selectedClassId) {
          setSelectedClassId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadClassData = async (classId: number) => {
    setAnalytics(null);
    try {
      // Load analytics
      const resA = await fetchWithAuth(`/api/teacher/classes/${classId}/analytics`);
      if (resA.ok) setAnalytics(await resA.json());

      // Load syllabus
      const resS = await fetchWithAuth(`/api/teacher/classes/${classId}/syllabus`);
      if (resS.ok) {
        const data = await resS.json();
        setSyllabus({ title: data.title || "", content: data.content || "" });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSyllabus = async () => {
    if (!selectedClassId) return;
    setIsSavingSyllabus(true);
    try {
      await fetchWithAuth(`/api/teacher/classes/${selectedClassId}/syllabus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syllabus),
      });
      alert("Syllabus saved successfully!");
    } catch (e) {
      console.error(e);
      alert("Error saving syllabus");
    } finally {
      setIsSavingSyllabus(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 lg:ml-64 flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-8 bg-surface-container-lowest">
      {/* Header */}
      <div className="bg-surface border-b border-outline-variant px-container-margin py-8">
        <h1 className="font-display-lg text-3xl font-bold text-on-surface">Teacher Dashboard</h1>
        <p className="text-on-surface-variant font-body-md mt-2">
          Manage your classes, track student progress, and update syllabus material.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 p-container-margin mt-4">
        
        {/* Classes Sidebar */}
        <div className="w-full md:w-1/3 lg:w-1/4">
          <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <h2 className="font-headline-sm font-semibold">Your Classes</h2>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">school</span>
            </div>
            {classes.length === 0 ? (
              <div className="p-6 text-center text-on-surface-variant font-body-md">
                No classes assigned yet.
              </div>
            ) : (
              <div className="flex flex-col">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`text-left p-4 border-b last:border-0 border-outline-variant transition-colors ${
                      selectedClassId === cls.id 
                      ? "bg-secondary/10 border-l-4 border-l-secondary" 
                      : "hover:bg-surface-container hover:border-l-4 hover:border-l-outline-variant border-l-4 border-l-transparent"
                    }`}
                  >
                    <h3 className={`font-medium ${selectedClassId === cls.id ? "text-secondary" : "text-on-surface"}`}>{cls.name}</h3>
                    <p className="text-xs text-on-surface-variant mt-1 font-body-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">book</span> {cls.subject_name}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1 font-body-md flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">group</span> {cls.student_count} Students
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          {selectedClassId ? (
            <div className="bg-surface rounded-2xl border border-outline-variant overflow-hidden min-h-[600px] flex flex-col shadow-sm">
              
              {/* Tabs */}
              <div className="flex border-b border-outline-variant bg-surface-container-low">
                <button
                  onClick={() => setActiveTab("analytics")}
                  className={`flex-1 py-4 font-medium transition-all ${
                    activeTab === "analytics"
                      ? "text-secondary border-b-2 border-secondary bg-surface"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface/50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">analytics</span>
                    Student Analytics
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("syllabus")}
                  className={`flex-1 py-4 font-medium transition-all ${
                    activeTab === "syllabus"
                      ? "text-secondary border-b-2 border-secondary bg-surface"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface/50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">auto_stories</span>
                    Syllabus Builder
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6 flex-1">
                {activeTab === "analytics" && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-headline-md font-semibold text-on-surface">Class Analytics</h2>
                    </div>

                    {!analytics ? (
                       <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className="bg-surface-container rounded-xl p-5 border border-outline-variant">
                            <p className="text-on-surface-variant font-label-md mb-1">Average Progress</p>
                            <div className="flex items-end gap-2">
                              <span className="font-display-lg text-3xl font-bold text-primary">
                                {Math.round(analytics.average_progress)}%
                              </span>
                            </div>
                            <div className="w-full bg-surface-variant rounded-full h-1.5 mt-3">
                              <div className="bg-secondary h-1.5 rounded-full" style={{ width: `${Math.min(100, analytics.average_progress)}%` }}></div>
                            </div>
                          </div>
                          
                          <div className="bg-surface-container rounded-xl p-5 border border-outline-variant">
                            <p className="text-on-surface-variant font-label-md mb-1">Avg Weekly Hours</p>
                            <div className="flex items-end gap-2">
                              <span className="font-display-lg text-3xl font-bold text-primary">
                                {analytics.average_hours.toFixed(1)}
                              </span>
                              <span className="text-on-surface-variant mb-1 font-body-md">hrs/week</span>
                            </div>
                          </div>
                        </div>

                        <h3 className="font-headline-sm font-semibold mb-4 text-on-surface">Student Roster</h3>
                        <div className="overflow-x-auto border border-outline-variant rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-surface-container-low border-b border-outline-variant text-on-surface-variant font-label-md uppercase text-xs tracking-wider">
                                <th className="p-4 font-medium">Student</th>
                                <th className="p-4 font-medium">Progress</th>
                                <th className="p-4 font-medium">Weekly Hours</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analytics.students.length === 0 ? (
                                <tr><td colSpan={3} className="p-4 text-center text-on-surface-variant font-body-md">No students in this class.</td></tr>
                              ) : (
                                analytics.students.map((student) => (
                                  <tr key={student.id} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                                    <td className="p-4">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold text-sm">
                                          {student.name ? student.name[0] : "U"}
                                        </div>
                                        <div>
                                          <p className="font-medium text-on-surface font-body-md">{student.name || "Unknown Student"}</p>
                                          <p className="text-xs text-on-surface-variant font-label-sm">{student.email}</p>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-24 bg-surface-variant rounded-full h-2">
                                          <div className="bg-secondary h-2 rounded-full" style={{ width: `${Math.min(100, student.progress)}%` }}></div>
                                        </div>
                                        <span className="text-sm font-medium">{Math.round(student.progress)}%</span>
                                      </div>
                                    </td>
                                    <td className="p-4 text-sm font-medium">{student.learning_hours} hrs</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "syllabus" && (
                  <div className="animate-in fade-in duration-300 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="font-headline-md font-semibold text-on-surface">Syllabus Builder</h2>
                      <button 
                        onClick={handleSaveSyllabus}
                        disabled={isSavingSyllabus}
                        className="bg-secondary text-on-primary px-5 py-2 rounded-full font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm hover:shadow-md"
                      >
                        <span className="material-symbols-outlined text-sm">save</span>
                        {isSavingSyllabus ? "Saving..." : "Save Syllabus"}
                      </button>
                    </div>

                    <div className="space-y-5 flex-1 flex flex-col">
                      <div>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1 font-label-md">Syllabus Title</label>
                        <input
                          type="text"
                          value={syllabus.title}
                          onChange={(e) => setSyllabus({ ...syllabus, title: e.target.value })}
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all text-on-surface font-body-md"
                          placeholder="e.g. Fall 2026 - Computer Science 101"
                        />
                      </div>
                      
                      <div className="flex-1 flex flex-col">
                        <label className="block text-sm font-medium text-on-surface-variant mb-1 font-label-md flex justify-between">
                          <span>Syllabus Content (Markdown Supported)</span>
                        </label>
                        <textarea
                          value={syllabus.content}
                          onChange={(e) => setSyllabus({ ...syllabus, content: e.target.value })}
                          className="w-full flex-1 min-h-[300px] bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all text-on-surface font-body-md resize-none"
                          placeholder="## Course Objectives\n\n- Understand basic programming...\n\n## Grading\n\n- Homework: 40%\n- Exams: 60%"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-outline-variant flex flex-col items-center justify-center p-12 h-[600px] text-center shadow-sm">
              <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">school</span>
              </div>
              <h2 className="font-headline-md font-semibold text-on-surface mb-2">Select a Class</h2>
              <p className="text-on-surface-variant font-body-md max-w-md">
                Choose a class from the sidebar to view student analytics, manage syllabus, and monitor progress.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
