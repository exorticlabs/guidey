"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AIChatInput from "@/components/AIChatInput";
import TopicSearchInput from "@/components/TopicSearchInput";
import NotificationsPanel from "@/components/NotificationsPanel";
import DarkModeToggle from "@/components/DarkModeToggle";
import GlobalSearchInput from "@/components/GlobalSearchInput";
import { fetchWithAuth } from "@/utils/api";
import { useAuth } from "@/components/AuthContext";
import AuthGateModal from "@/components/AuthGateModal";


function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guestPrompt, setGuestPrompt] = useState("");
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [gateTitle, setGateTitle] = useState("");
  const [gateDesc, setGateDesc] = useState("");

  const handleGuestAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestPrompt.trim()) return;
    router.push(`/tutor?new=1&prompt=${encodeURIComponent(guestPrompt)}`);
  };

  const triggerAuthGate = (feature: string) => {
    setGateTitle(`${feature} Required`);
    setGateDesc(`This feature requires a free account to persist state, map your weaknesses, and track learning history.`);
    setShowAuthGate(true);
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const loadData = async () => {
      try {
        const [profileRes, statsRes, moduleRes, subjectsRes, trendingRes, announcementsRes] = await Promise.all([
          fetchWithAuth("/api/user/profile"),
          fetchWithAuth("/api/user/stats"),
          fetchWithAuth("/api/user/active-module"),
          fetchWithAuth("/api/subjects/active"),
          fetchWithAuth("/api/recommendations/trending"),
          fetchWithAuth("/api/user/announcements")
        ]);

        if (profileRes.ok) {
          setData({
            profile: await profileRes.json(),
            stats: await statsRes.json(),
            activeModule: await moduleRes.json(),
            subjects: await subjectsRes.json(),
            trending: await trendingRes.json(),
            announcements: announcementsRes.ok ? await announcementsRes.json() : []
          });
        }
      } catch (e) {
        console.error("Failed to load home data", e);
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

  // Guest View
  if (!user) {
    return (
      <>
        {/* Decorative Background Blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]"></div>
        </div>

        <main className="flex-1 pb-24 lg:pb-8 overflow-y-auto relative z-0">
          <section className="px-container-margin lg:px-8 py-md mt-sm max-w-screen-xl mx-auto space-y-8">
            {/* Greeting */}
            <div>
              <h1 className="font-display-lg text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-primary">
                Welcome, Guest Learner! 👋
              </h1>
              <p className="font-body-md text-sm sm:text-base text-on-surface-variant mt-1.5 max-w-2xl">
                Experience advanced Socratic AI tutoring. Ask questions, explore topics, or browse standard subject templates.
              </p>
            </div>

            {/* Quick Socratic Prompt Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                </div>
                <span className="font-bold text-primary text-sm sm:text-base">Ask AI Socratic Tutor</span>
              </div>
              <form onSubmit={handleGuestAsk} className="flex flex-col sm:flex-row gap-2.5 sm:gap-2">
                <input
                  type="text"
                  placeholder="e.g. Explain how gravity works using an analogy..."
                  value={guestPrompt}
                  onChange={(e) => setGuestPrompt(e.target.value)}
                  className="w-full flex-1 bg-surface border border-outline-variant rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-primary text-sm focus:outline-none focus:border-secondary transition-all"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 sm:px-6 sm:py-3 bg-secondary text-white rounded-xl font-bold text-sm hover:shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                >
                  <span>Start Socratic Chat</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </form>
            </div>

            {/* Public Curriculum Templates */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display-lg text-xl font-bold text-primary">Explore Subject Templates</h2>
                <Link href="/subjects" className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1">
                  View All Templates <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { title: "JEE Mains - Physics", code: "JEE-MAIN-PHY", tag: "JEE Mains", desc: "Kinematics, Laws of Motion, Electrostatics, Thermodynamics, Modern Physics." },
                  { title: "NEET - Biology", code: "NEET-BIO", tag: "NEET", desc: "Diversity in Living World, Plant & Human Physiology, Genetics, Ecology." },
                  { title: "UPSC Civil Services - Indian Polity", code: "UPSC-POLITY", tag: "UPSC", desc: "Constitution, Preamble, Fundamental Rights, Parliament, Federalism." },
                  { title: "SSC Board - Science & Technology", code: "SSC-SCI", tag: "SSC Board", desc: "Gravitation, Periodic Classification, Chemical Reactions, Lenses, Carbon Compounds." }
                ].map((item) => (
                  <div key={item.code} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-medium bg-surface-container border border-outline-variant px-2.5 py-0.5 rounded text-on-surface-variant uppercase tracking-wider">{item.tag}</span>
                        <span className="text-xs font-bold text-secondary font-mono">{item.code}</span>
                      </div>
                      <h3 className="font-bold text-lg text-primary mb-2">{item.title}</h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => triggerAuthGate("Syllabus Graph Access")}
                      className="w-full py-2 bg-secondary/10 border border-secondary/20 hover:bg-secondary hover:text-white rounded-xl text-xs font-bold text-secondary transition-all text-center"
                    >
                      Start Learning Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Showcase Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm hover:border-secondary/40 transition-colors">
                <span className="material-symbols-outlined text-secondary text-2xl mb-3">psychology</span>
                <h3 className="font-bold text-primary text-base mb-1">Socratic Dialogues</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">Engage in structured step-by-step questioning to build first-principle understanding.</p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm hover:border-secondary/40 transition-colors">
                <span className="material-symbols-outlined text-secondary text-2xl mb-3">grid_view</span>
                <h3 className="font-bold text-primary text-base mb-1">Interactive Graphs</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">Visualize relationships and prerequisites between academic concepts dynamically.</p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm hover:border-secondary/40 transition-colors">
                <span className="material-symbols-outlined text-secondary text-2xl mb-3">warning</span>
                <h3 className="font-bold text-primary text-base mb-1">Weakness Identification</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">AI analyzes quizzes and mistakes to pinpoint exact learning gaps.</p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 shadow-sm hover:border-secondary/40 transition-colors">
                <span className="material-symbols-outlined text-secondary text-2xl mb-3">architecture</span>
                <h3 className="font-bold text-primary text-base mb-1">AI Projects Mentor</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">Map coding milestones and receive guidance from a software planning agent.</p>
              </div>
            </div>

            {/* Registration Banner */}
            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 border border-secondary/20 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
              <div>
                <h3 className="font-display-lg text-xl font-bold text-primary mb-2">Ready to unlock your full potential?</h3>
                <p className="text-sm text-on-surface-variant max-w-2xl w-full">Create a free account to track your syllabus progress, persist tutor history, identify misconceptions, and build projects.</p>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <Link href="/signup" className="flex-1 md:flex-initial text-center px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-sm hover:shadow-lg transition-all">Sign Up Free</Link>
                <Link href="/login" className="flex-1 md:flex-initial text-center px-6 py-3 border border-outline text-primary rounded-xl font-bold text-sm bg-surface/50 hover:bg-surface-container-low transition-all">Sign In</Link>
              </div>
            </div>
          </section>
        </main>
        
        <AuthGateModal
          isOpen={showAuthGate}
          onClose={() => setShowAuthGate(false)}
          title={gateTitle}
          description={gateDesc}
        />
      </>
    );
  }

  const { profile, stats, activeModule, subjects, trending } = data;


  return (
    <>

      {/* Decorative Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]"></div>
      </div>

      <main className="flex-1 pb-24 lg:pb-8 overflow-y-auto relative z-0">
        {/* Hero Section */}
        <section className="px-container-margin lg:px-8 py-md mt-sm max-w-screen-xl mx-auto">
          <div className="lg:flex lg:gap-lg lg:items-start">
            {/* Left: Greeting + AI */}
            <div className="lg:flex-1">
              <h1 className="font-headline-md text-xl sm:text-2xl lg:text-3xl font-bold text-primary mb-xs">
                {getGreeting()}, {profile?.name || user?.name || "Student"}
              </h1>
              <p className="font-body-md text-sm sm:text-base text-on-surface-variant mb-md">
                You are {profile?.overall_progress}% through your syllabus
              </p>

              {/* AI Assistant */}
              <div className="mt-md bg-surface-container-lowest border border-outline-variant rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-secondary text-sm">
                    robot_2
                  </span>
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    AI Assistant
                  </span>
                </div>
                <AIChatInput subjectId={activeModule?.subject_id || 1} />
              </div>
            </div>

            {/* Right: Continue Module Card */}
            <div className="mt-md lg:mt-0 lg:w-96">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-sm">
                  <div>
                    <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed/30 px-2 py-1 rounded-sm uppercase mb-2 inline-block">
                      Continue
                    </span>
                    <h2 className="font-headline-sm text-headline-sm text-primary">
                      {activeModule?.module_name || "Get Started"}
                    </h2>
                  </div>
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 36 36"
                    >
                      <path
                        className="text-surface-container-high"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></path>
                      <path
                        className="text-secondary"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={`${activeModule?.progress || 0}, 100`}
                        strokeWidth="4"
                      ></path>
                    </svg>
                    <span className="absolute font-label-sm text-label-sm text-primary">
                      {Math.round(activeModule?.progress || 0)}%
                    </span>
                  </div>
                </div>
                <Link
                  href={`/subject/${activeModule?.subject_id || 1}`}
                  className="w-full bg-secondary text-white py-3 rounded-lg font-body-md text-body-md font-semibold hover:bg-secondary/90 hover:shadow-md transition-all flex justify-center items-center gap-2 mt-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    play_arrow
                  </span>
                  Resume Learning
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Continue Learning */}
        <section className="py-md mt-xs">
          <div className="px-container-margin sm:px-10 lg:px-8 mb-sm flex justify-between items-center max-w-screen-xl mx-auto">
            <h3 className="font-headline-sm text-headline-sm text-primary">
              Continue Learning
            </h3>
            <Link
              className="font-label-md text-label-md text-secondary hover:underline"
              href="/subjects"
            >
              View All
            </Link>
          </div>
          <div className="flex sm:width-100 overflow-x-auto no-scrollbar gap-sm snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:overflow-x-visible mx-container-margin px-container-margin lg:mx-auto lg:px-8 max-w-screen-xl">
            {subjects?.map((course: any) => (
              <Link
                key={course.id}
                href={`/subject/${course.id}`}
                className="w-[280px] flex-none lg:w-auto bg-surface-container-lowest border border-outline-variant rounded-lg p-sm shadow-sm hover:shadow-md transition-all cursor-pointer relative snap-start"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-1 rounded-sm">
                    {course.tag}
                  </span>
                  <span className="material-symbols-outlined text-outline-variant text-sm">
                    bookmark
                  </span>
                </div>
                <h4 className="font-body-md text-body-md font-semibold text-primary mb-1 truncate">
                  {course.title}
                </h4>
                <p className="font-label-sm text-label-sm text-outline mb-sm">
                  Last opened {course.time}
                </p>
                <div className="w-full bg-surface-container-high rounded-full h-1.5 mb-1">
                  <div
                    className="bg-secondary h-1.5 rounded-full"
                    style={{ width: `${course.progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="font-label-sm text-label-sm text-secondary">
                    {course.progress}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* What do you want to learn */}
        <section className="px-container-margin lg:px-8 py-xl bg-gradient-to-b from-surface-container-low to-surface border-y border-outline-variant my-sm relative overflow-hidden">
          {/* Subtle pattern for background */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <div className="max-w-2xl mx-auto text-center relative z-10">
            <h3 className="font-headline-md text-headline-md text-primary mb-md">
              What do you want to learn today?
            </h3>
            <div className="bg-surface-container-lowest/80 backdrop-blur-md rounded-xl shadow-lg border border-outline-variant/50 p-2 mb-md">
              <TopicSearchInput />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="font-label-md text-label-md text-on-surface-variant py-1">
                Trending topics:
              </span>
              {trending?.map((trend: string, idx: number) => (
                <Link
                  key={idx}
                  href={`/tutor?new=1&prompt=${encodeURIComponent(trend)}`}
                  className="font-label-sm text-label-sm text-on-surface bg-surface-container border border-outline-variant rounded-full py-1 px-3 cursor-pointer hover:border-secondary transition-colors"
                >
                  {trend}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Progress Snapshot & Mastery Link */}
        <section className="px-container-margin lg:px-8 py-md max-w-screen-xl mx-auto flex flex-col lg:flex-row gap-md">
          {/* Snapshot Grid */}
          <div className="flex-1">
            <h3 className="font-headline-sm text-headline-sm text-primary mb-sm">
              Progress Snapshot
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-sm lg:h-[calc(100%-2.5rem)]">
              <div className="bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant rounded-xl p-sm shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                <span className="material-symbols-outlined text-secondary mb-1">
                  schedule
                </span>
                <h4 className="font-headline-sm text-headline-sm text-primary">
                  {stats?.learning_hours_this_week}h
                </h4>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  This Week
                </p>
              </div>
              <div className="bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant rounded-xl p-sm shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                <span className="material-symbols-outlined text-green-600 mb-1">
                  check_circle
                </span>
                <h4 className="font-headline-sm text-headline-sm text-primary">
                  {stats?.topics_completed}
                </h4>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Topics Completed
                </p>
              </div>
              <div className="bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant rounded-xl p-sm shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                <span className="material-symbols-outlined text-secondary mb-1">
                  trending_up
                </span>
                <h4 className="font-headline-sm text-headline-sm text-primary">
                  {profile?.overall_progress}%
                </h4>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Overall Progress
                </p>
              </div>
              <div className="bg-surface-container-lowest/80 backdrop-blur-md border border-outline-variant rounded-xl p-sm shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                <span className="material-symbols-outlined text-primary mb-1">
                  menu_book
                </span>
                <h4 className="font-headline-sm text-headline-sm text-primary">
                  {subjects?.length || 0}
                </h4>
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Active Subjects
                </p>
              </div>
            </div>
          </div>

          {/* Announcements */}
          <div className="lg:w-[30%]">
            <h3 className="font-headline-sm text-headline-sm text-primary mb-sm">
              Announcements
            </h3>
            <div className="flex flex-col gap-2">
              {data?.announcements?.length === 0 ? (
                <div className="bg-surface-container-lowest p-sm rounded-xl border border-outline-variant shadow-sm text-on-surface-variant text-sm italic">
                  No recent announcements.
                </div>
              ) : (
                data?.announcements?.map((a: any, i: number) => (
                  <div key={a.id} className={`bg-surface-container-lowest border-l-4 ${i === 0 ? 'border-error' : 'border-secondary'} p-sm rounded-r-xl border-y border-r border-outline-variant shadow-sm hover:-translate-y-0.5 transition-transform`}>
                    <p className="font-body-md text-body-md text-primary font-medium">{a.title}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-1 line-clamp-2">{a.content}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-2 opacity-70">
                      — {a.author_name} on {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mastery Dashboard Link Card */}
          <div className="lg:w-[30%]">
            <h3 className="font-headline-sm text-headline-sm text-primary mb-sm lg:opacity-0">
              Mastery
            </h3>
            <Link href="/my-knowledge" className="block h-full lg:h-[calc(100%-2.5rem)] relative overflow-hidden rounded-xl border border-secondary/30 bg-gradient-to-br from-surface-container-lowest to-secondary/5 group hover:shadow-lg transition-all hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-tr from-secondary/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="p-md h-full flex flex-col justify-between relative z-10">
                <div>
                  <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-secondary">hub</span>
                  </div>
                  <h4 className="font-headline-sm text-primary mb-1">Mastery Dashboard</h4>
                  <p className="font-body-sm text-on-surface-variant">
                    Visualize your knowledge graph, discover weaknesses, and track topic mastery with heatmaps.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-secondary font-medium text-sm">
                  Explore Mastery <span className="material-symbols-outlined text-sm ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
