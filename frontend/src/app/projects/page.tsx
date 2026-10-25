"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/utils/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import AuthGateModal from "@/components/AuthGateModal";

interface Project {
  id: number;
  title: string;
  description: string;
  status: string;
  progress_percent: number;
  updated_at: string;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);
  const [authGateTitle, setAuthGateTitle] = useState("");
  const [authGateDesc, setAuthGateDesc] = useState("");

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    if (!user) {
      setProjects([
        {
          id: 9991,
          title: "Web Server in Python",
          description: "Build a socket-based custom HTTP web server from scratch in Python to serve static files.",
          status: "Template",
          progress_percent: 0,
          updated_at: new Date().toISOString()
        },
        {
          id: 9992,
          title: "React Kanban Board",
          description: "Develop a drag-and-drop task tracking system with custom workflows using React and TypeScript.",
          status: "Template",
          progress_percent: 0,
          updated_at: new Date().toISOString()
        },
        {
          id: 9993,
          title: "CLI SQLite Database Manager",
          description: "Write a command-line tool in Go to run queries, manage schemas, and dump database tables.",
          status: "Template",
          progress_percent: 0,
          updated_at: new Date().toISOString()
        }
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetchWithAuth("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : (data.projects || []));
      } else {
        setProjects([]);
      }
    } catch (e) {
      console.error(e);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!user) {
      setAuthGateTitle("Build Custom Projects");
      setAuthGateDesc("Sign in to unlock interactive step-by-step guidance from the AI Mentor on designing, coding, and debugging your custom projects.");
      setIsAuthGateOpen(true);
      return;
    }
    try {
      const res = await fetchWithAuth("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: "New Project",
          description: "Project generated with AI Mentor"
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          router.push(`/projects/${data.id}`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-screen">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <main className="p-4 lg:p-8 pb-24 lg:pb-8 min-h-screen bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-8">
          <div>
            <h1 className="text-3xl font-display-lg font-bold text-primary mb-2 tracking-tight">Your Projects</h1>
            <p className="text-on-surface-variant font-body-lg">Build real-world applications with an AI Mentor by your side.</p>
          </div>
          <button 
            onClick={createProject}
            className="bg-secondary text-white px-5 py-2.5 rounded-full font-medium flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 w-full sm:w-auto justify-center sm:justify-start"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 px-4 bg-surface-container-low rounded-3xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-6xl text-outline mb-4">architecture</span>
            <h3 className="text-xl font-bold text-primary mb-2">No projects yet</h3>
            <p className="text-on-surface-variant max-w-[400px] mx-auto mb-6">Start building your first project. The AI Mentor will guide you through planning, requirements, and implementation step-by-step.</p>
            <button 
              onClick={createProject}
              className="bg-primary text-white px-6 py-3 rounded-full font-medium inline-flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
            >
              Start Building
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => {
              const cardContent = (
                <div className="bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 rounded-3xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md h-full flex flex-col cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-white transition-colors duration-300">
                      <span className="material-symbols-outlined">rocket_launch</span>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 bg-surface rounded-full text-on-surface border border-outline-variant/50">
                      {p.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-2">{p.title}</h3>
                  <p className="text-on-surface-variant text-sm flex-1 mb-6 line-clamp-2">
                    {p.description || "No description provided."}
                  </p>
                  
                  <div className="mt-auto">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-on-surface-variant">Progress</span>
                      <span className="text-xs font-bold text-primary">{Math.round(p.progress_percent)}%</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-secondary h-1.5 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(5, p.progress_percent)}%` }}
                      ></div>
                    </div>
                    {user ? (
                      <p className="text-xs text-outline mt-4">
                        Last updated {new Date(p.updated_at).toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-xs text-secondary mt-4 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">lock</span>
                        Sign in to start building
                      </p>
                    )}
                  </div>
                </div>
              );

              if (!user) {
                return (
                  <div 
                    key={p.id}
                    className="h-full"
                    onClick={() => {
                      setAuthGateTitle("Start Coding Project");
                      setAuthGateDesc("Create a free account to load this project environment, view requirements, and get step-by-step AI feedback.");
                      setIsAuthGateOpen(true);
                    }}
                  >
                    {cardContent}
                  </div>
                );
              }

              return (
                <Link href={`/projects/${p.id}`} key={p.id}>
                  {cardContent}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <AuthGateModal
        isOpen={isAuthGateOpen}
        onClose={() => setIsAuthGateOpen(false)}
        title={authGateTitle}
        description={authGateDesc}
      />
    </main>
  );
}
