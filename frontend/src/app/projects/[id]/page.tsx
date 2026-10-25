"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/utils/api";
import ReactMarkdown from "react-markdown";

interface Project {
  id: number;
  title: string;
  description: string;
  status: string;
  progress_percent: number;
}

interface Message {
  id: number;
  role: "user" | "ai";
  content: string;
}

export default function ProjectWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState("Planning");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const TABS = ["Planning", "Requirements", "Implementation Help", "Documentation"];

  useEffect(() => {
    loadProject();
    loadMessages();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const loadProject = async () => {
    try {
      const res = await fetchWithAuth(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      } else {
        router.push('/projects');
      }
    } catch (e) {
      console.error(e);
      router.push('/projects');
    }
  };

  const loadMessages = async () => {
    try {
      const res = await fetchWithAuth(`/api/projects/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      } else {
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const updateProject = async (updates: Partial<Project>) => {
    try {
      await fetchWithAuth(`/api/projects/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
      });
      setProject(prev => prev ? { ...prev, ...updates } : null);
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const userMsgContent = inputValue;
    setInputValue("");
    setSending(true);

    const tempId = Date.now();
    setMessages(prev => [...prev, { id: tempId, role: "user", content: userMsgContent }]);

    try {
      const res = await fetchWithAuth(`/api/projects/${id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content: userMsgContent })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.response) {
          setMessages(prev => [...prev, { id: tempId + 1, role: "ai", content: data.response }]);
          if (data.project_status && project?.status !== data.project_status) {
            setProject(prev => prev ? { ...prev, status: data.project_status } : null);
          }
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: tempId + 1, role: "ai", content: "Sorry, I encountered an error responding." }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-[calc(100vh-64px)]">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  if (!project) return null;

  return (
    <main className="flex flex-col bg-surface h-[calc(100dvh-144px)] lg:h-[calc(100vh-64px)] overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-outline-variant flex items-center justify-between px-4 sm:px-6 bg-surface z-10 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <button 
            onClick={() => router.push('/projects')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-primary text-base sm:text-lg flex items-center gap-2 truncate">
              <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">architecture</span>
              <span className="truncate">{project.title}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="text-xs font-medium px-2.5 sm:px-3 py-1 bg-surface-variant rounded-full text-on-surface-variant whitespace-nowrap">
            Phase: {project.status}
          </span>
          <div className="w-32 bg-surface-variant rounded-full h-2 hidden sm:block">
            <div 
              className="bg-secondary h-2 rounded-full transition-all" 
              style={{ width: `${Math.max(5, project.progress_percent)}%` }}
            ></div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Workspace Context (Tabs) */}
        <div className="flex flex-col lg:w-1/3 border-b lg:border-b-0 lg:border-r border-outline-variant bg-surface-container-low shrink-0 lg:h-full max-h-[40vh] lg:max-h-full">
          <div className="flex overflow-x-auto border-b border-outline-variant no-scrollbar shrink-0 px-2 lg:px-0">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab 
                    ? "border-secondary text-secondary" 
                    : "border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-variant/50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            <h2 className="text-xl font-bold text-primary mb-4">{activeTab}</h2>
            
            {activeTab === "Planning" && (
              <div className="space-y-4">
                <p className="text-sm text-on-surface-variant mb-6">
                  Use the mentor chat to define your project scope. Outline the problem you are solving.
                </p>
                <div>
                  <label className="block text-xs font-bold text-outline mb-1 uppercase tracking-wider">Project Title</label>
                  <input 
                    type="text" 
                    value={project.title}
                    onChange={(e) => updateProject({ title: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-primary focus:outline-none focus:border-secondary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-outline mb-1 mt-4 uppercase tracking-wider">Description</label>
                  <textarea 
                    value={project.description || ""}
                    onChange={(e) => updateProject({ description: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 text-primary focus:outline-none focus:border-secondary transition-colors h-32 resize-none"
                    placeholder="Describe your project goals..."
                  />
                </div>
              </div>
            )}
            
            {activeTab === "Requirements" && (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">list_alt</span>
                <p className="text-on-surface-variant text-sm">Ask the mentor to help you generate a requirements checklist based on your plan.</p>
              </div>
            )}

            {activeTab === "Implementation Help" && (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">code</span>
                <p className="text-on-surface-variant text-sm">Stuck on a feature? Ask the mentor for pseudo-code or architecture advice. The mentor will guide you rather than writing code for you.</p>
              </div>
            )}

            {activeTab === "Documentation" && (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-4xl text-outline mb-2">menu_book</span>
                <p className="text-on-surface-variant text-sm">Draft your README and submission docs here with the mentor's help.</p>
              </div>
            )}
            
          </div>
        </div>

        {/* Right Side: Mentor Chat */}
        <div className="flex-1 flex flex-col bg-surface min-h-0  mb-12">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-6 ">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center w-full max-w-[400px] mx-auto px-4">
                <div className="w-16 h-16 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl">psychology</span>
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">Your AI Mentor</h3>
                <p className="text-on-surface-variant">
                  Hi! I'm here to guide you through building your project. 
                  Let's start by discussing what you want to build. What are the main features you have in mind?
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                    msg.role === "user" 
                      ? "bg-secondary text-white rounded-tr-sm shadow-sm" 
                      : "bg-surface-container border border-outline-variant/30 text-on-surface rounded-tl-sm shadow-sm"
                  }`}>
                    {msg.role === "ai" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface-container-high prose-pre:border prose-pre:border-outline-variant">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-[15px] whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {sending && (
              <div className="flex justify-start">
                <div className="bg-surface-container border border-outline-variant/30 text-on-surface rounded-2xl rounded-tl-sm p-4 max-w-[80%] shadow-sm">
                  <div className="flex gap-1.5 items-center h-5">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="border-t border-outline-variant bg-surface p-4 flex-shrink-0">
            <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex gap-2 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask your mentor for guidance..."
                className="flex-1 bg-surface-container-high border border-outline-variant rounded-full py-3.5 pl-6 pr-12 text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 transition-all shadow-sm"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || sending}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-secondary text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-surface-variant disabled:text-outline transition-all hover:shadow-md"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
