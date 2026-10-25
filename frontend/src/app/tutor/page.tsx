"use client";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import AnimationViewer from "@/components/AnimationViewer";
import ExplanationPanel from "@/components/tutor/ExplanationPanel";
import ConceptBreakdown from "@/components/tutor/ConceptBreakdown";
import UnderstandingCheck from "@/components/tutor/UnderstandingCheck";
import ConceptSimulator from "@/components/tutor/ConceptSimulator";
import Whiteboard from "@/components/tutor/Whiteboard";
import FeedbackModal from "@/components/tutor/FeedbackModal";
import { parseTutorResponse, parseStructuredResponse, stripTutorTags } from "@/utils/tts";
import { fetchWithAuth, API_URL } from "@/utils/api";
import { supabase } from "@/utils/supabase";
import { useAuth } from "@/components/AuthContext";
import { useSidebar } from "@/components/SidebarContext";
import AuthGateModal from "@/components/AuthGateModal";

type Session = {
  id: number | string;
  title: string;
  category: string;
  subject_id: number | null;
  topic_id: number | null;
  subject_name: string | null;
  topic_name: string | null;
  message_count: number;
  last_message: string | null;
  updated_at: string;
  is_big_topic?: boolean;
  agenda?: string[] | null;
  current_index?: number;
};

type Message = {
  id?: number;
  role: "ai" | "user";
  content: string;
};

export interface TutorSettings {
  teachingStyle: "detailed" | "brief" | "socratic" | "step_by_step";
  animationsEnabled: boolean;
  speechEnabled: boolean;
  difficultyLevel: "intuitive" | "rigorous" | "exam_prep";
  chalkboardTheme: "emerald" | "slate" | "ocean";
  autoDrawVisuals: boolean;
}

const DEFAULT_TUTOR_SETTINGS: TutorSettings = {
  teachingStyle: "detailed",
  animationsEnabled: true,
  speechEnabled: true,
  difficultyLevel: "intuitive",
  chalkboardTheme: "emerald",
  autoDrawVisuals: true,
};

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch { }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const CATEGORY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  subject: { icon: "menu_book", label: "Subject", color: "text-emerald-500 dark:text-emerald-400" },
  topic: { icon: "topic", label: "Topic", color: "text-amber-500 dark:text-amber-400" },
  free: { icon: "chat", label: "General", color: "text-sky-500 dark:text-sky-400" },
};

const markdownComponents = {
  pre({ node, children, ...props }: any) {
    const codeChild = children?.[0];
    if (codeChild && codeChild.props && codeChild.props.className === "language-component") {
      return <>{children}</>;
    }
    return (
      <pre className="p-4 rounded-xl bg-[#1e1e1e] text-[#d4d4d4] overflow-x-auto my-4 text-sm font-mono border border-outline-variant" {...props}>
        {children}
      </pre>
    );
  },
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || "");
    if (!inline && match && match[1] === "component") {
      try {
        let rawStr = String(children);
        const jsonMatch = rawStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) rawStr = jsonMatch[0];
        rawStr = rawStr.replace(/\n$/, "").replace(/\\([^"\\/bfnrtu])/g, "\\\\$1");
        const data = JSON.parse(rawStr);
        if (data.type === "Animation") {
          return (
            <div className="my-4 not-prose w-full">
              <AnimationViewer topicId={data.topicId || data.topicName.toLowerCase().replace(/[^a-z0-9]+/g, "_")} topicName={data.topicName} />
            </div>
          );
        }
        if (data.type === "ExplanationPanel") {
          return <ExplanationPanel title={data.title} content={data.content} />;
        }
        if (data.type === "ConceptBreakdown") {
          return <ConceptBreakdown title={data.title} steps={data.steps} />;
        }
        if (data.type === "UnderstandingCheck") {
          return <UnderstandingCheck question={data.question} options={data.options} correctIndex={data.correctIndex} explanation={data.explanation} />;
        }
        if (data.type === "ConceptSimulator") {
          return <ConceptSimulator topic={data.topic} type={data.simType || "linear_equation"} />;
        }
        if (data.type === "SemanticBoard") {
          return null;
        }
      } catch (e: any) {
        console.warn("Failed to parse AI component JSON, falling back to code block:", e.message);
        return <code className={className} {...props}>{children}</code>;
      }
    }
    return inline ? (
      <code className="bg-surface-variant/50 text-secondary px-1.5 py-0.5 rounded-md font-mono text-[0.9em]" {...props}>
        {children}
      </code>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  p({ node, children, ...props }: any) {
    const textContent = Array.isArray(children)
      ? children.map((c) => (typeof c === "string" ? c : "")).join("")
      : typeof children === "string"
        ? children
        : "";

    const animMatch = textContent.match(/\[ANIMATION:\s*(.+?)\]/);
    if (animMatch) {
      const topic = animMatch[1].trim();
      return (
        <div className="mb-2 last:mb-0">
          <div>{children}</div>
          <div className="my-4 not-prose w-full">
            <AnimationViewer topicId={topic.toLowerCase().replace(/[^a-z0-9]+/g, "_")} topicName={topic} />
          </div>
        </div>
      );
    }
    return <div className="mb-2 last:mb-0" {...props}>{children}</div>;
  },
};

const PacedMessageBubble = ({
  msg,
  isCurrentPlaying,
  currentSpeechIndex,
  isSmall = false,
}: {
  msg: Message;
  isCurrentPlaying: boolean;
  currentSpeechIndex: number;
  isSmall?: boolean;
}) => {
  if (msg.role !== "ai") {
    return <>{msg.content}</>;
  }

  // If this message is actively being spoken/taught, reveal sentences in sync with currentSpeechIndex
  if (isCurrentPlaying && currentSpeechIndex !== 1000) {
    const { speechSegments } = parseTutorResponse(msg.content);
    if (speechSegments && speechSegments.length > 0) {
      const activeIdx = Math.max(0, currentSpeechIndex);
      const visibleSpeech = speechSegments
        .slice(0, activeIdx + 1)
        .filter(Boolean)
        .join(" ");

      return (
        <div className={`prose ${isSmall ? "prose-xs" : "prose-sm"} max-w-none dark:prose-invert prose-p:leading-relaxed`}>
          <p className="leading-relaxed">
            {visibleSpeech || "..."}
            <span
              className="inline-block w-2 h-2 ml-2 rounded-full bg-secondary animate-pulse align-middle"
              title="Speaking & writing on board..."
            />
          </p>
        </div>
      );
    }
  }

  // Full formatted Markdown once speech finishes or for prior history messages
  return (
    <div className={`prose ${isSmall ? "prose-xs" : "prose-sm"} max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-[#1e1e1e] prose-pre:text-[#d4d4d4] prose-pre:border prose-pre:border-outline-variant`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {stripTutorTags(msg.content)}
      </ReactMarkdown>
    </div>
  );
};

export default function TutorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isDesktopSidebarOpen, toggleDesktopSidebar } = useSidebar();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isQuizAnswered, setIsQuizAnswered] = useState(true);
  const [sessionMeta, setSessionMeta] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const isCreatingSession = useRef(false);
  const activeTurnIdRef = useRef<string | null>(null);
  const activeStepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAwaitingUserAnswerRef = useRef<boolean>(false);

  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);
  const [authGateTitle, setAuthGateTitle] = useState("");
  const [authGateDesc, setAuthGateDesc] = useState("");

  // YT Videos State
  const [ytVideos, setYtVideos] = useState<{ id: string; title: string }[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  // Learning Preferences & Settings State (Persisted in localStorage)
  const [tutorSettings, setTutorSettings] = useState<TutorSettings>(DEFAULT_TUTOR_SETTINGS);
  const [showPreferencesMenu, setShowPreferencesMenu] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("guiedteach_tutor_settings");
        if (stored) {
          setTutorSettings((prev) => ({ ...prev, ...JSON.parse(stored) }));
        }
      } catch { }
    }
  }, []);

  const updateTutorSettings = (updates: Partial<TutorSettings>) => {
    setTutorSettings((prev) => {
      const next = { ...prev, ...updates };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("guiedteach_tutor_settings", JSON.stringify(next));
        } catch { }
      }
      return next;
    });
  };

  // File Upload State
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Orchestration Queue State
  const [lastPlayedMessageIndex, setLastPlayedMessageIndex] = useState<number>(-1);
  const lastPlayedMsgRef = useRef<number>(-1);
  const isSpeakingRef = useRef<boolean>(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWhiteboardMode, setIsWhiteboardMode] = useState(true);
  const [isLandscapeLecture, setIsLandscapeLecture] = useState(false);
  const [isDevicePortrait, setIsDevicePortrait] = useState(false);
  const [currentSpeechIndex, setCurrentSpeechIndex] = useState(-1);
  const [currentSpeechDuration, setCurrentSpeechDuration] = useState(0);
  const [guestCreditsLeft, setGuestCreditsLeft] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [isServerWarmingUp, setIsServerWarmingUp] = useState(false);

  // Monitor Render free tier cold-start
  useEffect(() => {
    let warmTimer: any = null;
    let isMounted = true;

    const checkServer = async () => {
      warmTimer = setTimeout(() => {
        if (isMounted) setIsServerWarmingUp(true);
      }, 3000);

      try {
        const res = await fetch(`${API_URL}/api/health`);
        if (res.ok && isMounted) {
          clearTimeout(warmTimer);
          setIsServerWarmingUp(false);
        }
      } catch {
        // Will clear once backend wakes up
      }
    };
    checkServer();

    return () => {
      isMounted = false;
      if (warmTimer) clearTimeout(warmTimer);
    };
  }, []);

  const [showFloatingChat, setShowFloatingChat] = useState(false);
  const [pendingAskQuestion, setPendingAskQuestion] = useState<string | null>(null);
  const [askInputValue, setAskInputValue] = useState("");
  const [requiresAction, setRequiresAction] = useState<string[]>([]);

  // Automatically track mobile portrait/landscape orientation
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
      setIsDevicePortrait(isPortrait);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  const toggleLandscapeLecture = async () => {
    const next = !isLandscapeLecture;
    setIsLandscapeLecture(next);

    if (next) {
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
        if (screen.orientation && "lock" in screen.orientation) {
          await (screen.orientation as any).lock("landscape");
        }
      } catch { }
    } else {
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          await document.exitFullscreen();
        }
        if (screen.orientation && "unlock" in screen.orientation) {
          (screen.orientation as any).unlock();
        }
      } catch { }
    }
  };

  const floatingScrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const ttsManagerRef = useRef<any>(null);

  const handleAskSubmit = async () => {
    if (!askInputValue.trim() || loading) return;
    const answer = askInputValue.trim();
    setPendingAskQuestion(null);
    setAskInputValue("");
    isAwaitingUserAnswerRef.current = false;
    await sendMessage(activeSessionId ?? undefined, answer, true);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("guiedteach_device_id");
      if (!id) {
        id = "dev_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem("guiedteach_device_id", id);
      }
      setDeviceId(id);
    }
  }, []);

  useEffect(() => {
    if (deviceId && !user) {
      fetch(`${API_URL}/api/tutor/guest/credits?device_id=${deviceId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.credits_left !== undefined) {
            setGuestCreditsLeft(data.credits_left);
          }
        })
        .catch((err) => console.error("Error fetching guest credits:", err));
    }
  }, [deviceId, user]);

  useEffect(() => {
    import("@/utils/tts").then(({ TTSManager }) => {
      const manager = new TTSManager();
      manager.onSegmentStart = (idx, duration) => {
        setCurrentSpeechIndex(idx);
        setCurrentSpeechDuration(duration || 0);
      };
      manager.onFinished = () => {
        if (!isSpeakingRef.current) return;
        if (activeStepTimerRef.current) {
          clearTimeout(activeStepTimerRef.current);
          activeStepTimerRef.current = null;
        }
        isSpeakingRef.current = false;
        setCurrentSpeechIndex(1000);
        setCurrentSpeechDuration(0);
        setIsPlaying(false);
        if (!isAwaitingUserAnswerRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "step_ack",
            step_index: currentStepIndexRef.current
          }));
        }
      };
      ttsManagerRef.current = manager;
    });

    return () => {
      ttsManagerRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (isSpeakingRef.current) return;

    const nextIdx = messages.findIndex(
      (m, i) => i > lastPlayedMsgRef.current && m.role === "ai" && m.content.includes("```component")
    );
    if (nextIdx !== -1) {
      lastPlayedMsgRef.current = nextIdx;
      setLastPlayedMessageIndex(nextIdx);
      isSpeakingRef.current = true;
      setIsPlaying(true);
      setCurrentSpeechIndex(-1);

      const aiMsg = messages[nextIdx];
      // Surface interactive socratic check question if present in component payload
      let asksQuestion = false;
      try {
        const compMatch = /```component\s*(\{[\s\S]*?\})\s*```/i.exec(aiMsg.content);
        if (compMatch) {
          const compData = JSON.parse(compMatch[1]);
          const questionText = compData.ask || compData.intent?.socratic_check;
          if (questionText && (compData.intent?.yield === "ask" || compData.ask)) {
            setPendingAskQuestion(questionText);
            asksQuestion = true;
          }
        }
      } catch (e) { }
      isAwaitingUserAnswerRef.current = asksQuestion;

      const { speechSegments } = parseTutorResponse(aiMsg.content);
      if (activeStepTimerRef.current) {
        clearTimeout(activeStepTimerRef.current);
        activeStepTimerRef.current = null;
      }

      if (tutorSettings.speechEnabled && speechSegments.length > 0 && speechSegments.some((s) => s.trim().length > 0)) {
        ttsManagerRef.current?.speak(speechSegments);
        // Safety Watchdog: in case audio context stops or network drops without onFinished callback
        const approxDurationMs = Math.max(4500, speechSegments.join(" ").split(" ").length * 550 + 2000);
        activeStepTimerRef.current = setTimeout(() => {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setCurrentSpeechIndex(1000);
            setIsPlaying(false);
            if (!isAwaitingUserAnswerRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "step_ack",
                step_index: currentStepIndexRef.current
              }));
            }
          }
        }, approxDurationMs);
      } else {
        // Fast, fluid transition when speech is muted
        const pauseMs = 400;
        activeStepTimerRef.current = setTimeout(() => {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setCurrentSpeechIndex(1000);
            setIsPlaying(false);
            if (!isAwaitingUserAnswerRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "step_ack",
                step_index: currentStepIndexRef.current
              }));
            }
          }
        }, pauseMs);
      }
    }
  }, [messages, tutorSettings.speechEnabled]);

  // Auto-scroll floating chat feed when messages update
  useEffect(() => {
    if (floatingScrollRef.current) {
      floatingScrollRef.current.scrollTop = floatingScrollRef.current.scrollHeight;
    }
  }, [messages, showFloatingChat]);

  // Listen to quiz submissions
  useEffect(() => {
    const handleQuizSubmitted = async (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;

      const { selectedIndex, correctIndex, isCorrect, question, explanation } = customEvent.detail;
      const session = activeSessionId || "guest";

      try {
        const payload = {
          selected_index: selectedIndex,
          correct_index: correctIndex,
          is_correct: isCorrect,
          question: question || "",
          concept_tested: explanation || "",
        };

        if (user) {
          await fetchWithAuth(`/api/tutor/sessions/${session}/quiz-answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          await fetch(`${API_URL}/api/tutor/sessions/${session}/quiz-answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
      } catch (err) {
        console.error("Error submitting quiz answer to backend:", err);
      }
    };

    window.addEventListener("quiz_submitted", handleQuizSubmitted);
    return () => {
      window.removeEventListener("quiz_submitted", handleQuizSubmitted);
    };
  }, [activeSessionId, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      setAuthGateTitle("File Attachments");
      setAuthGateDesc("Sign in to upload PDFs, text files, and source code to share with your AI Tutor.");
      setIsAuthGateOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Max size is 10MB.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/api/tutor/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAttachments((prev) => [...prev, data]);
      } else {
        alert("Failed to upload file.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  // WebSocket connection for live teaching loop
  const wsRef = useRef<WebSocket | null>(null);
  const currentStepIndexRef = useRef<number>(0);

  const attachWsListeners = useCallback((ws: WebSocket) => {
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.turn_id && activeTurnIdRef.current && msg.turn_id !== activeTurnIdRef.current) {
          return;
        }

        if (msg.step_index !== undefined) {
          currentStepIndexRef.current = msg.step_index;
        }

        if (msg.type === "chat" || msg.type === "step") {
          setMessages((prev) => [...prev, msg.data]);
        } else if (msg.type === "ask") {
          setPendingAskQuestion(msg.question);
          isAwaitingUserAnswerRef.current = true;
          setLoading(false);
        } else if (msg.type === "yield") {
          if (msg.reason === "ask") {
            isAwaitingUserAnswerRef.current = true;
          }
          setLoading(false);
        } else if (msg.type === "status" && msg.data === "teaching_finished") {
          setLoading(false);
        }
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WS error:", err);
      setLoading(false);
    };

    ws.onclose = () => {
      setLoading(false);
    };
  }, []);

  useEffect(() => {
    const sessionKey = activeSessionId || "guest";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = API_URL ? API_URL.replace(/^http(s?):\/\//, `${protocol}//`) : `${protocol}//${window.location.host}`;

    const ws = new WebSocket(`${baseUrl}/api/tutor/ws/${sessionKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to teaching loop WS for session:", sessionKey);
    };

    attachWsListeners(ws);

    return () => {
      ws.close();
    };
  }, [activeSessionId, attachWsListeners]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (user) {
      try {
        const res = await fetchWithAuth(`/api/tutor/sessions`);
        if (res.ok) setSessions(await res.json());
      } catch { }
    } else {
      // Guest users: chats are strictly temporary and not stored in localStorage
      try {
        localStorage.removeItem("guiedteach_guest_sessions");
      } catch { }
      setSessions([]);
    }
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Quiz answered listener
  useEffect(() => {
    const handleQuizSubmitted = () => {
      setIsQuizAnswered(true);
    };
    window.addEventListener("quiz_submitted", handleQuizSubmitted);
    return () => window.removeEventListener("quiz_submitted", handleQuizSubmitted);
  }, []);

  // Monitor messages for quizzes
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "ai" && lastMsg.content.includes("UnderstandingCheck")) {
        setIsQuizAnswered(false);
      } else {
        setIsQuizAnswered(true);
      }
    } else {
      setIsQuizAnswered(true);
    }
  }, [messages]);

  // Fetch YT videos when topic changes
  useEffect(() => {
    const fetchVideos = async () => {
      const query = sessionMeta?.topic_name || sessionMeta?.title;
      if (!query || query === "New Chat") {
        setYtVideos([]);
        return;
      }
      setLoadingVideos(true);
      try {
        const res = await fetchWithAuth(`/api/yt-search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setYtVideos(data.videos || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingVideos(false);
      }
    };
    fetchVideos();
  }, [sessionMeta?.topic_name, sessionMeta?.title]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (floatingScrollRef.current) {
      floatingScrollRef.current.scrollTop = floatingScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const openSession = async (id: number | string) => {
    ttsManagerRef.current?.stop();
    setCurrentSpeechIndex(1000);
    setActiveSessionId(id);
    if (user) {
      window.history.replaceState({}, "", `/tutor?session=${id}`);
    } else {
      window.history.replaceState({}, "", "/tutor");
    }
    setLoading(true);

    if (user) {
      try {
        const [metaRes, msgsRes] = await Promise.all([
          fetchWithAuth(`/api/tutor/sessions/${id}`),
          fetchWithAuth(`/api/tutor/sessions/${id}/messages`),
        ]);
        if (metaRes.ok) setSessionMeta(await metaRes.json());
        if (msgsRes.ok) {
          const rawMsgs = await msgsRes.json();
          setMessages(rawMsgs.map((m: any) => ({ ...m, role: m.role === "assistant" ? "ai" : m.role })));
          lastPlayedMsgRef.current = rawMsgs.length - 1;
          setLastPlayedMessageIndex(rawMsgs.length - 1);
        }
      } catch { }
    } else {
      // Guest: in-memory state only
      setSessionMeta(null);
      setMessages([]);
      lastPlayedMsgRef.current = -1;
      isSpeakingRef.current = false;
      setLastPlayedMessageIndex(-1);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const createAndOpen = async (
    opts: { title?: string; category?: string; subject_id?: number; topic_id?: number },
    initialPrompt?: string
  ) => {
    ttsManagerRef.current?.stop();
    setCurrentSpeechIndex(-1);
    if (isCreatingSession.current) return;
    isCreatingSession.current = true;

    if (user) {
      try {
        const res = await fetchWithAuth(`/api/tutor/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: opts.title || "New Chat",
            category: opts.category || "free",
            subject_id: opts.subject_id || null,
            topic_id: opts.topic_id || null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          window.dispatchEvent(new CustomEvent("tutor_sessions_updated"));
          await loadSessions();
          setActiveSessionId(data.id);
          window.history.replaceState({}, "", `/tutor?session=${data.id}`);
          setSessionMeta({ ...data });

          const msgsRes = await fetchWithAuth(`/api/tutor/sessions/${data.id}/messages`);
          const existingMessages = msgsRes.ok ? await msgsRes.json() : [];
          setMessages(existingMessages);
          lastPlayedMsgRef.current = existingMessages.length - 1;
          setLastPlayedMessageIndex(existingMessages.length - 1);

          if (initialPrompt && existingMessages.length === 0) {
            setTimeout(() => sendMessage(data.id, initialPrompt), 200);
          } else {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }
      } catch (e) {
        console.error("CREATE SESSION EXCEPTION:", e);
      } finally {
        isCreatingSession.current = false;
      }
    } else {
      if (opts.category === "subject" || opts.category === "topic") {
        setAuthGateTitle(opts.category === "subject" ? "Subject Learning" : "Topic Deep Dive");
        setAuthGateDesc(`Sign in to create dedicated ${opts.category} learning environments, sync your curriculum maps, and track your progress.`);
        setIsAuthGateOpen(true);
        isCreatingSession.current = false;
        return;
      }

      const guestId = "guest_" + Date.now();
      const newSession: Session = {
        id: guestId,
        title: opts.title || "New Chat",
        category: "free",
        subject_id: null,
        topic_id: null,
        subject_name: null,
        topic_name: null,
        message_count: 0,
        last_message: null,
        updated_at: new Date().toISOString(),
        is_big_topic: false,
        agenda: null,
        current_index: 0,
      };

      // Guest session is strictly temporary in memory
      setActiveSessionId(guestId);
      window.history.replaceState({}, "", "/tutor");
      setSessionMeta(newSession);
      setMessages([]);
      lastPlayedMsgRef.current = -1;
      isSpeakingRef.current = false;
      setLastPlayedMessageIndex(-1);
      isCreatingSession.current = false;

      if (initialPrompt) {
        setTimeout(() => sendMessage(guestId, initialPrompt), 200);
      } else {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  };

  const handleStartFresh = () => {
    handleStopGeneration();
    setActiveSessionId(null);
    setMessages([]);
    lastPlayedMsgRef.current = -1;
    isSpeakingRef.current = false;
    setLastPlayedMessageIndex(-1);
    setSessionMeta(null);
    setInput("");
    window.history.replaceState({}, "", "/tutor");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Sync with Sidebar Events
  useEffect(() => {
    const handleOpenSessionEvent = (e: any) => {
      if (e.detail?.id) openSession(e.detail.id);
    };
    const handleNewSessionEvent = () => {
      handleStartFresh();
    };

    window.addEventListener("open_tutor_session", handleOpenSessionEvent);
    window.addEventListener("new_tutor_session", handleNewSessionEvent);

    return () => {
      window.removeEventListener("open_tutor_session", handleOpenSessionEvent);
      window.removeEventListener("new_tutor_session", handleNewSessionEvent);
    };
  }, []);

  // Handle URL params on mount & ensure guest is always clean
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const sessionId = searchParams.get("session");
    const isNew = searchParams.get("new");
    const prompt = searchParams.get("prompt");
    const subjectId = searchParams.get("subject_id");
    const topicId = searchParams.get("topic_id");

    if (!user) {
      // Unauthenticated / guest users: strictly temporary session!
      // Any reload or back navigation must start completely fresh.
      if (sessionId || isNew) {
        window.history.replaceState({}, "", "/tutor");
      }
      setActiveSessionId(null);
      setMessages([]);
      setSessionMeta(null);
      lastPlayedMsgRef.current = -1;
      setLastPlayedMessageIndex(-1);
      isSpeakingRef.current = false;
      return;
    }

    if (sessionId) {
      openSession(parseInt(sessionId));
    } else if (isNew && prompt) {
      createAndOpen(
        {
          title: prompt.slice(0, 30),
          category: topicId ? "topic" : subjectId ? "subject" : "free",
          subject_id: subjectId ? parseInt(subjectId) : undefined,
          topic_id: topicId ? parseInt(topicId) : undefined,
        },
        prompt
      );
    } else if (subjectId) {
      createAndOpen({
        title: "Subject Session",
        category: "subject",
        subject_id: parseInt(subjectId),
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendFromEmptyState = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    const title = text.trim().slice(0, 30) + (text.trim().length > 30 ? "..." : "");
    await createAndOpen({ category: "free", title }, text.trim());
  };

  const handleStopGeneration = () => {
    if (activeStepTimerRef.current) {
      clearTimeout(activeStepTimerRef.current);
      activeStepTimerRef.current = null;
    }
    isSpeakingRef.current = false;
    setIsPlaying(false);
    setLoading(false);
    ttsManagerRef.current?.stop();
    setCurrentSpeechIndex(1000);
    activeTurnIdRef.current = generateUUID();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: "cancel" }));
      } catch {}
    }
  };

  const sendMessage = async (sessionId?: number | string, overrideMsg?: string, isFreeReply: boolean = false) => {
    const targetSession = sessionId || activeSessionId;
    const userMessage = overrideMsg || input;
    if (!userMessage.trim() || !targetSession || loading) return;

    ttsManagerRef.current?.stop();
    setCurrentSpeechIndex(-1);
    setPendingAskQuestion(null);
    isAwaitingUserAnswerRef.current = false;

    if (!isQuizAnswered) {
      const msgClean = userMessage.trim().toLowerCase();
      const bypassKeywords = ["continue", "next", "go on", "skip", "next concept", "move on", "proceed"];
      if (bypassKeywords.includes(msgClean)) {
        alert("Please attempt the Knowledge Check question first!");
        return;
      }
    }

    const currentTurnId = generateUUID();
    activeTurnIdRef.current = currentTurnId;

    const newMsg: Message = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    const wsPayload = {
      type: "message",
      message: userMessage,
      student_id: user ? user.id : "guest",
      turn_id: currentTurnId,
      session_id: String(targetSession),
      device_id: deviceId,
      preferences: {
        teaching_style: tutorSettings.teachingStyle,
        animations_enabled: tutorSettings.animationsEnabled,
        speech_enabled: tutorSettings.speechEnabled,
        difficulty_level: tutorSettings.difficultyLevel,
        auto_draw_visuals: tutorSettings.autoDrawVisuals,
      },
    };

    // Helper: try sending via WebSocket (waiting for open if connecting)
    const sendViaWs = async (): Promise<boolean> => {
      // 1. If currently OPEN
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(wsPayload));
          return true;
        } catch {
          return false;
        }
      }

      // 2. If CONNECTING, wait for open up to 2.5s
      if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
        const socket = wsRef.current;
        return new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 2500);
          const handleOpen = () => {
            clearTimeout(timeout);
            socket.removeEventListener("open", handleOpen);
            try {
              socket.send(JSON.stringify(wsPayload));
              resolve(true);
            } catch {
              resolve(false);
            }
          };
          socket.addEventListener("open", handleOpen);
        });
      }

      // 3. If closed or missing, establish connection immediately
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const baseUrl = API_URL ? API_URL.replace(/^http(s?):\/\//, `${protocol}//`) : `${protocol}//${window.location.host}`;
        const newWs = new WebSocket(`${baseUrl}/api/tutor/ws/${targetSession}`);
        wsRef.current = newWs;
        attachWsListeners(newWs);

        return new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 3000);
          newWs.onopen = () => {
            clearTimeout(timeout);
            try {
              newWs.send(JSON.stringify(wsPayload));
              resolve(true);
            } catch {
              resolve(false);
            }
          };
        });
      } catch {
        return false;
      }
    };

    const wsSuccess = await sendViaWs();
    if (wsSuccess) {
      setAttachments([]);
      window.dispatchEvent(new CustomEvent("tutor_sessions_updated"));
      return;
    }

    // Fallback to HTTP only if WebSocket fails completely
    if (user) {
      try {
        const payload: any = {
          content: userMessage,
          message: userMessage,
          turn_id: currentTurnId,
          preferences: {
            teaching_style: tutorSettings.teachingStyle,
            animations_enabled: tutorSettings.animationsEnabled,
            speech_enabled: tutorSettings.speechEnabled,
            difficulty_level: tutorSettings.difficultyLevel,
            auto_draw_visuals: tutorSettings.autoDrawVisuals,
          },
          is_free_reply: isFreeReply,
        };
        if (attachments.length > 0) {
          payload.attachments = attachments.map((a) => a.id);
        }

        const res = await fetchWithAuth(`/api/tutor/sessions/${targetSession}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          setAttachments([]);
          const data = await res.json();
          if (data.requires_action) {
            setRequiresAction(data.requires_action);
          }
          window.dispatchEvent(new CustomEvent("tutor_sessions_updated"));
        } else {
          setMessages((prev) => [...prev, { role: "ai", content: "Error communicating with AI tutor." }]);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error sending message:", err);
        setMessages((prev) => [...prev, { role: "ai", content: "Network error occurred." }]);
        setLoading(false);
      }
    } else {
      // Guest HTTP fallback
      try {
        const backendHistory = messages.map((m) => ({
          role: m.role === "ai" ? "assistant" : "user",
          content: m.content,
        }));
        backendHistory.push({ role: "user", content: userMessage });

        const payload = {
          content: userMessage,
          message: userMessage,
          location: "general_chat",
          preferences: {
            teaching_style: tutorSettings.teachingStyle,
            animations_enabled: tutorSettings.animationsEnabled,
            speech_enabled: tutorSettings.speechEnabled,
            difficulty_level: tutorSettings.difficultyLevel,
            auto_draw_visuals: tutorSettings.autoDrawVisuals,
          },
          history: backendHistory,
          device_id: deviceId,
        };

        const res = await fetch(`${API_URL}/api/tutor/sessions/${targetSession}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 403) {
          const errData = await res.json().catch(() => ({ detail: "Guest credits used up." }));
          setAuthGateTitle("Guest Limit Reached");
          setAuthGateDesc(errData.detail || "You have used all 10 free guest credits. Create a free account to continue!");
          setIsAuthGateOpen(true);
          setLoading(false);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          const aiMsg: Message = { role: "ai", content: data.response || "No response." };
          setMessages((prev) => [...prev, aiMsg]);

          if (data.guest_credits_left !== undefined) {
            setGuestCreditsLeft(data.guest_credits_left);
          }
        } else {
          setMessages((prev) => [...prev, { role: "ai", content: "Error communicating with tutor." }]);
        }
      } catch {
        setMessages((prev) => [...prev, { role: "ai", content: "Connection error." }]);
      } finally {
        setLoading(false);
      }
    }
  };

  const sendActionMessage = (actionType: string) => {
    if (actionType === "next_concept") {
      sendMessage(undefined, "continue", true);
    } else if (actionType === "take_quiz") {
      sendMessage(undefined, "Give me a quick quiz to test my understanding", false);
    }
  };

  const categoryMeta = sessionMeta?.category ? CATEGORY_CONFIG[sessionMeta.category] : CATEGORY_CONFIG.free;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-on-background relative min-w-0">
      {/* Central Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Render Free Tier Warm-up Indicator */}
        <AnimatePresence>
          {isServerWarmingUp && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs backdrop-blur-md flex items-center gap-2 shadow-xl select-none pointer-events-none"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>AI Server is waking up (Render free tier spin-up ~10-15s)...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Header Bar (ChatGPT / Gemini style) */}
        <header className={`${isLandscapeLecture ? "hidden" : "flex"} items-center justify-between px-4 lg:px-6 h-14 border-b border-outline-variant/70 bg-surface/80 backdrop-blur-md flex-shrink-0 z-20`}>
          {/* Left: Mobile spacer + Desktop Sidebar Expand Toggle + Session Title info */}
          <div className="flex items-center gap-2 min-w-0 pl-10 lg:pl-0">
            {!isDesktopSidebarOpen && (
              <button
                onClick={toggleDesktopSidebar}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors mr-1 flex-shrink-0"
                title="Expand sidebar (Ctrl+B)"
                aria-label="Expand sidebar"
              >
                <span className="material-symbols-outlined text-[18px]">dock_to_right</span>
              </button>
            )}
            {sessionMeta?.title ? (
              <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-xs md:max-w-md lg:max-w-lg">
                <span className={`material-symbols-outlined text-[17px] ${categoryMeta.color} shrink-0`}>
                  {categoryMeta.icon}
                </span>
                <h1 className="text-sm font-semibold text-primary whitespace-nowrap overflow-hidden text-ellipsis truncate leading-tight">
                  {sessionMeta.title}
                </h1>
              </div>
            ) : null}
          </div>

          {/* Right Action Tray: Parameters/Settings, Chalkboard Mode, YT Videos & Quick New Chat */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Socratic Chalkboard Mode Toggle */}
            <button
              onClick={() => setIsWhiteboardMode(!isWhiteboardMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${isWhiteboardMode
                  ? "bg-secondary text-on-secondary shadow-md shadow-secondary/20"
                  : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low border border-outline-variant/60"
                }`}
              title="Toggle Socratic Chalkboard"
            >
              <span className={`material-symbols-outlined text-[16px] ${isWhiteboardMode ? "icon-fill" : ""}`}>
                co_present
              </span>
              <span className="hidden sm:inline">Chalkboard</span>
            </button>

            {/* Related YT Videos Toggle */}
            <button
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 ${rightSidebarOpen
                  ? "bg-primary text-on-primary shadow-md shadow-primary/20"
                  : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low border border-outline-variant/60"
                }`}
              title="Toggle Related Video Resources"
            >
              <span className="material-symbols-outlined text-[16px]">smart_display</span>
              <span className="hidden sm:inline">Videos</span>
            </button>

            {/* New Chat Button */}
            <button
              onClick={handleStartFresh}
              className="p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors"
              title="Start New Chat"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
        </header>

        {/* Main Content Area: Messages Stream OR Chalkboard OR Empty State */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {activeSessionId || messages.length > 0 || isWhiteboardMode ? (
            !isWhiteboardMode ? (
              /* Chat Stream View */
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 scroll-smooth">
                <div className="max-w-3xl mx-auto flex flex-col gap-6">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3.5 ${msg.role === "user" ? "justify-end" : "justify-start"} group`}>
                      {msg.role === "ai" && (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-secondary/20 to-primary/20 border border-secondary/30 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm text-secondary">
                          <span className="material-symbols-outlined text-[16px]">psychology</span>
                        </div>
                      )}

                      <div
                        className={`max-w-[90%] sm:max-w-[85%] min-w-0 p-4 rounded-2xl shadow-xs transition-all ${msg.role === "ai"
                            ? "bg-surface-container-lowest border border-outline-variant/80 rounded-tl-sm text-on-surface"
                            : "bg-primary text-on-primary rounded-tr-sm whitespace-pre-wrap font-body-md"
                          }`}
                      >
                        <PacedMessageBubble
                          msg={msg}
                          isCurrentPlaying={idx === lastPlayedMessageIndex && isPlaying}
                          currentSpeechIndex={currentSpeechIndex}
                        />
                      </div>

                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary">
                          <span className="material-symbols-outlined text-[16px]">person</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-3.5 items-start">
                      <div className="w-8 h-8 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center flex-shrink-0 text-secondary">
                        <span className="material-symbols-outlined text-[16px] animate-pulse">psychology</span>
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl rounded-tl-sm p-4 text-on-surface-variant text-sm shadow-xs flex items-center gap-2">
                        <span className="text-xs font-medium text-secondary">Socratic Tutor thinking</span>
                        <div className="flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Chalkboard Whiteboard Workspace */
              <div
                id="mobile-whiteboard-container"
                className={`transition-all duration-300 ${isLandscapeLecture
                    ? isDevicePortrait
                      ? "fixed z-[100] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100dvh] h-[100dvw] rotate-90 bg-[#0c131d] flex overflow-hidden p-1 sm:p-2 shadow-2xl"
                      : "fixed inset-0 z-[100] w-full h-[100dvh] bg-[#0c131d] flex overflow-hidden p-1.5 sm:p-3"
                    : "flex-1 flex relative overflow-hidden bg-surface-container-lowest/40"
                  }`}
              >
                {/* Floating Controls in Normal Mode: White bg, no borders */}
                {!isLandscapeLecture && (
                  <>
                    <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
                      <button
                        onClick={toggleLandscapeLecture}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-gray-900 shadow-md hover:bg-gray-100 border-0 outline-none active:scale-95 transition-all"
                        title="Enter Lecture Mode"
                      >
                        <span className="material-symbols-outlined text-[16px]">screen_rotation</span>
                        <span>Lecture Mode</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setShowFloatingChat(!showFloatingChat)}
                      className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-gray-900 shadow-md hover:bg-gray-100 border-0 outline-none active:scale-95 transition-all"
                      title="Toggle Conversation Feed"
                    >
                      <span className="material-symbols-outlined text-[16px]">forum</span>
                      <span>Feed {messages.length > 0 ? `(${messages.length})` : ""}</span>
                    </button>
                  </>
                )}

                {/* Top Controls Overlay in Lecture Mode: Black bg, no borders */}
                {isLandscapeLecture && (
                  <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-none">
                    {/* Left: Exit Lecture Button */}
                    <div className="pointer-events-auto flex items-center gap-2">
                      <button
                        onClick={toggleLandscapeLecture}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-black/85 text-white shadow-lg active:scale-95 transition-all hover:bg-black border-0 outline-none"
                        title="Exit Widescreen Lecture Mode"
                      >
                        <span className="material-symbols-outlined text-[16px]">close_fullscreen</span>
                        <span>Exit Lecture</span>
                      </button>
                    </div>

                    {/* Right: Lecture Controls (Voice & Feed) */}
                    <div className="pointer-events-auto flex items-center gap-2">
                      <button
                        onClick={() => updateTutorSettings({ speechEnabled: !tutorSettings.speechEnabled })}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-lg transition-all border-0 outline-none ${tutorSettings.speechEnabled
                            ? "bg-black/85 text-white hover:bg-black"
                            : "bg-black/60 text-white/50 hover:bg-black/75"
                          }`}
                        title={tutorSettings.speechEnabled ? "Mute Voice" : "Enable Voice"}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {tutorSettings.speechEnabled ? "volume_up" : "volume_off"}
                        </span>
                      </button>

                      <button
                        onClick={() => setShowFloatingChat(!showFloatingChat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-all border-0 outline-none ${showFloatingChat
                            ? "bg-secondary text-on-secondary shadow-secondary/25"
                            : "bg-black/85 text-white hover:bg-black"
                          }`}
                        title="Toggle Conversation Feed"
                      >
                        <span className="material-symbols-outlined text-[16px]">forum</span>
                        <span>Feed {messages.length > 0 ? `(${messages.length})` : ""}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Slide-out / Floating Chat Feed Panel */}
                <AnimatePresence>
                  {showFloatingChat && (
                    <motion.div
                      initial={{ opacity: 0, x: 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 60 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 top-0 bottom-0 z-40 w-full sm:w-80 md:w-96 bg-surface/95 backdrop-blur-xl border-l border-outline-variant shadow-2xl flex flex-col overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between flex-shrink-0 bg-surface/80">
                        <span className="font-headline-sm text-sm text-primary font-bold flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary">forum</span>
                          Conversation Feed
                        </span>
                        <button
                          onClick={() => setShowFloatingChat(false)}
                          className="p-1 rounded-full hover:bg-surface-container-low text-on-surface-variant transition-colors"
                          title="Close Chat Feed"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>

                      <div ref={floatingScrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
                        {messages.length === 0 ? (
                          <div className="text-center text-xs text-on-surface-variant/80 py-12">
                            No messages yet. Ask a question below to start the lesson!
                          </div>
                        ) : (
                          messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              {msg.role === "ai" && (
                                <div className="w-6 h-6 rounded-full bg-secondary/15 flex items-center justify-center flex-shrink-0 mt-0.5 text-secondary">
                                  <span className="material-symbols-outlined text-[12px]">psychology</span>
                                </div>
                              )}
                              <div
                                className={`max-w-[85%] min-w-0 p-3 text-xs leading-relaxed break-words rounded-2xl ${msg.role === "ai"
                                    ? "bg-surface-container border border-outline-variant/60 rounded-tl-sm text-on-surface"
                                    : "bg-primary text-on-primary rounded-tr-sm whitespace-pre-wrap font-body-md"
                                  }`}
                              >
                                <PacedMessageBubble
                                  msg={msg}
                                  isCurrentPlaying={idx === lastPlayedMessageIndex && isPlaying}
                                  currentSpeechIndex={currentSpeechIndex}
                                  isSmall={true}
                                />
                              </div>
                              {msg.role === "user" && (
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary">
                                  <span className="material-symbols-outlined text-[12px]">person</span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                        {loading && (
                          <div className="flex gap-2.5 items-center">
                            <div className="w-6 h-6 rounded-full bg-secondary/15 flex items-center justify-center flex-shrink-0 text-secondary">
                              <span className="material-symbols-outlined text-[12px] animate-pulse">psychology</span>
                            </div>
                            <div className="bg-surface-container border border-outline-variant/60 rounded-xl rounded-tl-sm px-3 py-2 text-on-surface-variant text-xs flex items-center gap-1.5">
                              <span>Professor is writing on the board...</span>
                              <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Message Input inside Chat Feed - Only visible in lecture mode */}
                      {isLandscapeLecture && (
                        <div className="p-3 border-t border-outline-variant bg-surface/90 backdrop-blur-sm flex-shrink-0">
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (input.trim() && !loading) {
                                if (activeSessionId) {
                                  sendMessage();
                                } else {
                                  handleSendFromEmptyState(input);
                                }
                              }
                            }}
                            className="flex items-center gap-2 bg-surface-container rounded-full px-3 py-1.5 border border-outline-variant focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary"
                          >
                            <input
                              type="text"
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              placeholder="Ask Guidy..."
                              className="flex-1 bg-transparent text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none font-body-md py-1 px-1 min-w-0"
                              autoFocus
                            />
                            {input.trim() && (
                              <button
                                type="button"
                                onClick={() => setInput("")}
                                className="text-on-surface-variant/60 hover:text-on-surface p-1 flex items-center justify-center shrink-0"
                                title="Clear input"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                            )}
                            <button
                              type="submit"
                              disabled={!input.trim() || loading}
                              className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center hover:bg-secondary/90 disabled:opacity-40 transition-all shrink-0"
                              title="Send question"
                            >
                              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                            </button>
                          </form>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex-1 h-full p-0 lg:p-4 flex flex-col min-w-0 relative">
                  {(() => {
                    const activeAiMessage =
                      lastPlayedMessageIndex !== -1 && lastPlayedMessageIndex < messages.length
                        ? messages[lastPlayedMessageIndex].content
                        : "";
                    const { boardSegments, speechSegments } = parseTutorResponse(activeAiMessage);
                    return (
                      <Whiteboard
                        boardSegments={boardSegments}
                        speechSegments={speechSegments}
                        currentSpeechIndex={currentSpeechIndex}
                        currentSpeechDuration={currentSpeechDuration}
                        onSendMessage={sendMessage}
                        animationsEnabled={tutorSettings.animationsEnabled}
                        theme={tutorSettings.chalkboardTheme}
                        isLectureMode={isLandscapeLecture}
                      />
                    );
                  })()}

                  {/* Ask Tool Floating Box */}
                  <AnimatePresence>
                    {pendingAskQuestion && (currentSpeechIndex === 1000 || currentSpeechIndex === -1) && (
                      <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl bg-surface/95 backdrop-blur-md border border-outline-variant rounded-2xl p-5 shadow-2xl"
                      >
                        <div className="flex flex-col gap-3">
                          <h3 className="text-base font-bold text-primary flex items-center gap-2">
                            <span className="material-symbols-outlined text-secondary">help</span>
                            Question for you:
                          </h3>
                          <p className="text-on-surface text-sm">{pendingAskQuestion}</p>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAskSubmit();
                            }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              value={askInputValue}
                              onChange={(e) => setAskInputValue(e.target.value)}
                              placeholder="Type your answer..."
                              className="flex-1 bg-surface-container border border-outline rounded-xl px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary"
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={!askInputValue.trim() || loading}
                              className="px-4 py-2 bg-primary rounded-xl text-xs font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-all"
                            >
                              Submit
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </div>
            )
          ) : (
            /* ChatGPT / Gemini Style Empty State Hero */
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
              <div className="text-center w-full max-w-2xl mx-auto space-y-6">
                {/* Brand Logo */}
                <div className="w-16 h-16 rounded-2xl p-2 bg-surface-container-lowest border border-outline-variant/60 shadow-xl shadow-primary/10 mx-auto flex items-center justify-center overflow-hidden">
                  <Image src="/logo.png" alt="Exortic AI" width={56} height={56} className="w-12 h-12 object-contain" priority />
                </div>

                <div>
                  <h2 className="font-display-lg text-2xl lg:text-3xl font-bold text-primary tracking-tight">
                    Where would you like to start?
                  </h2>
                  <p className="text-sm text-on-surface-variant/80 mt-2 max-w-2xl mx-auto">
                    Ask a conceptual question, deep-dive into your subject syllabus, or practice with Socratic quizzes.
                  </p>
                </div>

                {/* Quick starter cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
                  <button
                    onClick={() => handleSendFromEmptyState("Explain how Calculus limits and continuity work with visual intuition")}
                    className="p-4 rounded-2xl border border-outline-variant/80 bg-surface-container-lowest hover:border-secondary/60 hover:bg-secondary/5 transition-all text-left group cursor-pointer shadow-xs hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-secondary text-[22px] mb-2 group-hover:scale-110 transition-transform">
                      functions
                    </span>
                    <p className="text-xs font-bold text-primary">Calculus & Limits</p>
                    <p className="text-[11px] text-on-surface-variant/80 mt-1">Intuitive visual foundation</p>
                  </button>

                  <button
                    onClick={() => handleSendFromEmptyState("Help me understand dynamic programming step by step with an example")}
                    className="p-4 rounded-2xl border border-outline-variant/80 bg-surface-container-lowest hover:border-secondary/60 hover:bg-secondary/5 transition-all text-left group cursor-pointer shadow-xs hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-secondary text-[22px] mb-2 group-hover:scale-110 transition-transform">
                      code_blocks
                    </span>
                    <p className="text-xs font-bold text-primary">Dynamic Programming</p>
                    <p className="text-[11px] text-on-surface-variant/80 mt-1">Algorithmic recursion & memoization</p>
                  </button>

                  <button
                    onClick={() => handleSendFromEmptyState("Quiz me on Newton's Laws of Motion with conceptual problems")}
                    className="p-4 rounded-2xl border border-outline-variant/80 bg-surface-container-lowest hover:border-secondary/60 hover:bg-secondary/5 transition-all text-left group cursor-pointer shadow-xs hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-secondary text-[22px] mb-2 group-hover:scale-110 transition-transform">
                      quiz
                    </span>
                    <p className="text-xs font-bold text-primary">Interactive Physics Quiz</p>
                    <p className="text-[11px] text-on-surface-variant/80 mt-1">Test your mastery with checks</p>
                  </button>

                  <button
                    onClick={() => handleSendFromEmptyState("Create a 2-week structured study roadmap for my upcoming exams")}
                    className="p-4 rounded-2xl border border-outline-variant/80 bg-surface-container-lowest hover:border-secondary/60 hover:bg-secondary/5 transition-all text-left group cursor-pointer shadow-xs hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-secondary text-[22px] mb-2 group-hover:scale-110 transition-transform">
                      calendar_month
                    </span>
                    <p className="text-xs font-bold text-primary">Study Planning</p>
                    <p className="text-[11px] text-on-surface-variant/80 mt-1">Tailored pacing and milestone schedule</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Dock: Parameters, Suggestions & Chatbox */}
          <div className={`${isLandscapeLecture ? "hidden" : "block"} border-t border-outline-variant/70 bg-surface/90 backdrop-blur-md px-2.5 sm:px-4 lg:px-6 py-1.5 sm:py-2.5 flex-shrink-0 z-20`}>
            <div className="max-w-3xl mx-auto space-y-1.5 sm:space-y-2">
              {/* Parameter Bar & Quick Actions (Hidden on mobile portrait to maximize chalkboard canvas) */}
              <div className="hidden sm:flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs">
                {/* Learning Parameter Chips (Persisted Locally) */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Style Toggle Chip */}
                  <button
                    onClick={() =>
                      updateTutorSettings({
                        teachingStyle: tutorSettings.teachingStyle === "detailed" ? "brief" : "detailed",
                      })
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-container text-on-surface-variant border border-outline-variant/40 hover:text-primary transition-colors capitalize"
                    title="Toggle Detailed vs Brief Explanation"
                  >
                    <span className="material-symbols-outlined text-[13px]">format_align_left</span>
                    <span>{tutorSettings.teachingStyle}</span>
                  </button>

                  {/* Animations Toggle Chip */}
                  <button
                    onClick={() =>
                      updateTutorSettings({ animationsEnabled: !tutorSettings.animationsEnabled })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      tutorSettings.animationsEnabled
                        ? "bg-secondary/15 text-secondary border border-secondary/30"
                        : "bg-surface-container text-on-surface-variant/60 border border-outline-variant/40"
                    }`}
                    title="Toggle Chalkboard Reveal Animations"
                  >
                    <span className="material-symbols-outlined text-[13px]">animation</span>
                    <span>Animations {tutorSettings.animationsEnabled ? "ON" : "OFF"}</span>
                  </button>

                  {/* Speech Voice Narration Toggle Chip */}
                  <button
                    onClick={() =>
                      updateTutorSettings({ speechEnabled: !tutorSettings.speechEnabled })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      tutorSettings.speechEnabled
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "bg-surface-container text-on-surface-variant/60 border border-outline-variant/40"
                    }`}
                    title="Toggle Professor Voice Audio"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {tutorSettings.speechEnabled ? "volume_up" : "volume_off"}
                    </span>
                    <span>Voice {tutorSettings.speechEnabled ? "ON" : "OFF"}</span>
                  </button>

                  {/* All Settings Quick Link */}
                  <button
                    onClick={() => setShowPreferencesMenu(true)}
                    className="p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                    title="More Settings"
                  >
                    <span className="material-symbols-outlined text-[15px]">tune</span>
                  </button>
                </div>

                {/* Socratic Action suggestions */}
                {activeSessionId && requiresAction.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {requiresAction.includes("next") && (
                      <button
                        onClick={() => sendActionMessage("next_concept")}
                        disabled={loading || !isQuizAnswered}
                        className="px-3 py-1 rounded-full bg-secondary text-on-secondary text-[11px] font-bold shadow-xs hover:bg-secondary/90 disabled:opacity-50 transition-all flex items-center gap-1"
                      >
                        <span>Continue</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    )}
                    {requiresAction.includes("quiz") && (
                      <button
                        onClick={() => sendActionMessage("take_quiz")}
                        disabled={loading}
                        className="px-3 py-1 rounded-full border border-secondary text-secondary text-[11px] font-bold hover:bg-secondary/10 transition-colors"
                      >
                        Take Quiz
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    {["Visual Animation", "Give Example", "Quiz Me", "Summarize"].map((act) => (
                      <button
                        key={act}
                        onClick={() => {
                          if (activeSessionId) {
                            sendMessage(undefined, act);
                          } else {
                            handleSendFromEmptyState(act);
                          }
                        }}
                        disabled={loading}
                        className="px-2.5 py-1 rounded-full border border-outline-variant/60 text-on-surface-variant/80 hover:text-primary hover:bg-surface-container text-[11px] transition-colors disabled:opacity-40"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input Container */}
              <div className="relative bg-surface-container-lowest border border-outline-variant/80 focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary/20 rounded-2xl flex flex-col p-1.5 sm:p-2 shadow-sm transition-all overflow-hidden">
                {/* File Attachment previews */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-2 border-b border-outline-variant/40 mb-1.5">
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 bg-surface-container rounded-lg px-2.5 py-1 text-xs border border-outline-variant/60"
                      >
                        <span className="material-symbols-outlined text-[14px] text-secondary">description</span>
                        <span className="truncate max-w-[130px] font-medium">{file.filename}</span>
                        <button
                          onClick={() => removeAttachment(idx)}
                          className="text-on-surface-variant hover:text-error ml-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  {/* Tight Leading Button Cluster (Zero extra gap on mobile to prevent Send button overflow) */}
                  <div className="flex items-center gap-0 sm:gap-1 shrink-0 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPreferencesMenu(true)}
                      className="sm:hidden w-7 h-7 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors flex items-center justify-center"
                      title="Tutor Settings & Preferences"
                    >
                      <span className="material-symbols-outlined text-[17px]">tune</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTutorSettings({ speechEnabled: !tutorSettings.speechEnabled })}
                      className={`sm:hidden w-7 h-7 rounded-lg transition-colors flex items-center justify-center ${
                        tutorSettings.speechEnabled
                          ? "text-primary hover:bg-surface-container"
                          : "text-on-surface-variant/40 hover:bg-surface-container"
                      }`}
                      title={tutorSettings.speechEnabled ? "Mute Voice" : "Enable Voice"}
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        {tutorSettings.speechEnabled ? "volume_up" : "volume_off"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-on-surface-variant hover:text-secondary hover:bg-surface-container transition-colors disabled:opacity-50 flex items-center justify-center"
                      title="Attach file (PDF, code, notes)"
                    >
                      <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${uploading ? "animate-spin" : ""}`}>
                        {uploading ? "refresh" : "attach_file"}
                      </span>
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".txt,.py,.js,.jsx,.ts,.tsx,.json,.html,.css,.md,.csv,.pdf"
                  />

                  {/* Main Text Input */}
                  <input
                    ref={inputRef}
                    className="flex-1 min-w-0 bg-transparent border-none text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant/60 py-1 sm:py-1.5 px-1 outline-none font-body-md"
                    placeholder="Ask a question or request a topic explanation..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (activeSessionId) {
                          sendMessage();
                        } else {
                          handleSendFromEmptyState(input);
                        }
                      }
                    }}
                    disabled={loading}
                  />

                  {/* Send / Stop Button */}
                  {loading || isPlaying || (currentSpeechIndex !== -1 && currentSpeechIndex < 1000) ? (
                    <button
                      onClick={handleStopGeneration}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-error/15 text-error flex items-center justify-center hover:bg-error/25 transition-colors flex-shrink-0 shrink-0"
                      title="Stop Response"
                    >
                      <span className="material-symbols-outlined text-[17px]">stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (activeSessionId) {
                          sendMessage();
                        } else {
                          handleSendFromEmptyState(input);
                        }
                      }}
                      disabled={loading || (!input.trim() && attachments.length === 0)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex-shrink-0 shrink-0 shadow-sm"
                      title="Send message"
                    >
                      <span className="material-symbols-outlined text-[17px]">arrow_upward</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Guest status hint */}
              {!user && guestCreditsLeft !== null && (
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant/70 text-center">
                  <span className="material-symbols-outlined text-[13px] text-secondary">energy_savings_leaf</span>
                  <span>{guestCreditsLeft} of 10 free messages remaining</span>
                  <Link href="/signup" className="text-secondary font-semibold underline ml-1">
                    Sign Up Free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Overlay for Related YouTube Videos (Comes on top of board, doesn't squeeze it) */}
      <AnimatePresence>
        {rightSidebarOpen && (
          <>
            {/* Backdrop on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRightSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="fixed lg:absolute right-0 top-0 bottom-0 w-80 sm:w-96 bg-surface/95 backdrop-blur-xl border-l border-outline-variant/80 flex flex-col z-50 shadow-2xl"
            >
              <div className="flex items-center justify-between px-4 h-14 border-b border-outline-variant/70 flex-shrink-0">
                <span className="font-display-lg text-sm text-primary font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px]">play_circle</span>
                  Relevant Videos
                </span>
                <button
                  onClick={() => setRightSidebarOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {loadingVideos ? (
                  <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined animate-spin text-[28px] mb-2 text-secondary">refresh</span>
                    <p className="text-xs font-medium">Finding videos...</p>
                  </div>
                ) : ytVideos.length > 0 ? (
                  ytVideos.map((vid) => (
                    <div
                      key={vid.id}
                      className="bg-surface-container-lowest border border-outline-variant/80 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-video w-full bg-black">
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${vid.id}`}
                          title={vid.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                      <div className="p-3">
                        <h4
                          className="text-xs font-semibold text-primary line-clamp-2 leading-snug"
                          dangerouslySetInnerHTML={{ __html: vid.title }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[32px] mb-2 opacity-40">videocam_off</span>
                    <p className="text-xs font-medium">No videos found for this topic.</p>
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Tutor Parameters & Learning Settings Modal (Persisted in localStorage) */}
      <AnimatePresence>
        {showPreferencesMenu && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-2xl bg-surface border border-outline-variant/80 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[20px]">tune</span>
                  </div>
                  <div>
                    <h3 className="font-display-lg text-base font-bold text-primary">Tutor Parameters & Style</h3>
                    <p className="text-[11px] text-on-surface-variant">Saved locally in your browser</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreferencesMenu(false)}
                  className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Teaching Style / Verbosity */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Explanation Depth
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "detailed", label: "Detailed", desc: "Deep intuition & steps", icon: "menu_book" },
                    { id: "brief", label: "Brief", desc: "Quick takeaways & bullets", icon: "bolt" },
                    { id: "socratic", label: "Socratic", desc: "Guided inquiry questions", icon: "psychology" },
                    { id: "step_by_step", label: "Step-by-Step", desc: "Structured progression", icon: "format_list_numbered" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateTutorSettings({ teachingStyle: opt.id as any })}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                        tutorSettings.teachingStyle === opt.id
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40"
                          : "bg-surface-container-lowest border-outline-variant/70 hover:border-outline hover:bg-surface-container-low"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="material-symbols-outlined text-[18px] text-primary">{opt.icon}</span>
                        {tutorSettings.teachingStyle === opt.id && (
                          <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-primary">{opt.label}</p>
                      <p className="text-[10px] text-on-surface-variant/80">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pedagogical Rigor Level */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Pedagogical Depth
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "intuitive", label: "Intuitive", desc: "Visual analogies", icon: "lightbulb" },
                    { id: "rigorous", label: "Rigorous", desc: "Formal proofs", icon: "functions" },
                    { id: "exam_prep", label: "Exam Prep", desc: "Problem solving", icon: "assignment" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateTutorSettings({ difficultyLevel: opt.id as any })}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                        tutorSettings.difficultyLevel === opt.id
                          ? "bg-secondary/15 border-secondary shadow-xs ring-1 ring-secondary/40 text-secondary"
                          : "bg-surface-container-lowest border-outline-variant/70 hover:border-outline hover:bg-surface-container-low text-on-surface"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[10px] text-on-surface-variant/80">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chalkboard Background Theme */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Chalkboard Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "emerald", label: "Classic Green", bg: "bg-[#1b4332] border-[#3a2a18]" },
                    { id: "slate", label: "Dark Slate", bg: "bg-[#0f172a] border-[#334155]" },
                    { id: "ocean", label: "Deep Ocean", bg: "bg-[#0c1e3d] border-[#1e3a8a]" },
                  ].map((th) => (
                    <button
                      key={th.id}
                      onClick={() => updateTutorSettings({ chalkboardTheme: th.id as any })}
                      className={`p-2.5 rounded-2xl border-2 text-left transition-all flex items-center gap-2 ${
                        tutorSettings.chalkboardTheme === th.id
                          ? "border-primary shadow-xs ring-2 ring-primary/30"
                          : "border-outline-variant/60 hover:border-outline"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 ${th.bg} shadow-inner flex-shrink-0`} />
                      <span className="text-xs font-semibold text-primary">{th.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature Toggles: Animations & Speech */}
              <div className="space-y-3 border-t border-outline-variant/60 pt-4">
                {/* 3D Chalkboard Animations */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/70">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">animation</span>
                    <div>
                      <p className="text-xs font-bold text-primary">Chalkboard Reveal Animations</p>
                      <p className="text-[11px] text-on-surface-variant">Step-by-step visual chalkboard rendering</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateTutorSettings({ animationsEnabled: !tutorSettings.animationsEnabled })}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      tutorSettings.animationsEnabled ? "bg-primary" : "bg-outline-variant"
                    }`}
                  >
                    <div
                      className={`bg-surface w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        tutorSettings.animationsEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Speech Voice Narration */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/70">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">volume_up</span>
                    <div>
                      <p className="text-xs font-bold text-primary">Professor Voice Narration</p>
                      <p className="text-[11px] text-on-surface-variant">Audio narration of teaching speech</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateTutorSettings({ speechEnabled: !tutorSettings.speechEnabled })}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                      tutorSettings.speechEnabled ? "bg-primary" : "bg-outline-variant"
                    }`}
                  >
                    <div
                      className={`bg-surface w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        tutorSettings.speechEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-outline-variant/60 pt-4">
                <span className="text-[11px] text-on-surface-variant/70 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px] text-emerald-500">check</span>
                  Auto-saved locally
                </span>
                <button
                  onClick={() => setShowPreferencesMenu(false)}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                >
                  Apply & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Gate Modal */}
      <AuthGateModal
        isOpen={isAuthGateOpen}
        onClose={() => setIsAuthGateOpen(false)}
        title={authGateTitle}
        description={authGateDesc}
      />

      {/* User Feedback Modal (triggered once per user after engaging) */}
      <FeedbackModal
        messageCount={messages.filter((m) => m.role === "ai").length}
      />
    </div>
  );
}
