import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Exortic AI | Advanced Socratic AI Tutor & Learning Platform",
  description: "Exortic AI with Guidy is a state-of-the-art AI-powered Socratic learning engine. Explore interactive curriculum graphs, personalized Socratic tutoring paths, and real-time knowledge mapping.",
  keywords: [
    "AI tutor",
    "Socratic method",
    "personalized learning",
    "Exortic AI",
    "Guidy",
    "curriculum mapping",
    "interactive animation",
    "adaptive learning engine",
    "Socratic tutoring app"
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-secondary/30 relative overflow-hidden font-body-md flex flex-col">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "guiEDTeach",
            "operatingSystem": "All",
            "applicationCategory": "EducationalApplication",
            "description": "An advanced AI-powered Socratic tutoring and learning operating system featuring interactive curriculum graphs, adaptive weakness mapping, and individualized study flows.",
            "offers": {
              "@type": "Offer",
              "price": "0.00",
              "priceCurrency": "USD"
            },
            "publisher": {
              "@type": "Organization",
              "name": "guiEDTeach",
              "url": "https://guidey.exortic.com"
            }
          })
        }}
      />
      {/* Dynamic Background Animations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[0]">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-primary/10 blur-[120px] animate-[pulse_8s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full bg-secondary/10 blur-[120px] animate-[pulse_10s_ease-in-out_infinite_reverse]"></div>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background"></div>
      </div>
      
      <nav className="relative z-50 border-b border-outline-variant/20 bg-background/60 backdrop-blur-xl sticky top-0 w-full transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
              <Image src="/logo.png" alt="Exortic AI" width={40} height={40} className="w-full h-full object-contain" priority />
            </div>
            <span className="font-display-lg text-2xl tracking-tight font-bold text-primary">
              Exortic <span className="text-secondary">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              Contact
            </Link>
            <Link href="/terms" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">
              Privacy
            </Link>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <a href="mailto:social@exortic.com" className="text-sm font-medium text-on-surface hover:text-primary transition-colors hidden sm:block">
              Book a demo
            </a>
            <Link 
              href="/login"
              className="text-sm font-semibold bg-on-surface text-surface px-5 py-2.5 rounded-full hover:bg-on-surface/90 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative z-10 pt-20 pb-24 sm:pt-32 sm:pb-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface/50 border border-outline-variant/30 backdrop-blur-md mb-8 animate-fade-in-up hover:bg-surface/80 transition-colors cursor-default shadow-sm">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(var(--color-secondary),0.8)]"></span>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">Enterprise AI Agent for Education</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-headline-md font-extrabold tracking-tighter text-on-surface mb-8 leading-[1.05] animate-fade-in-up text-balance mx-auto" style={{ animationDelay: '100ms' }}>
              Advanced Socratic <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary bg-300% animate-gradient inline-block mt-2 sm:mt-4">
                AI Tutor Platform.
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl md:text-2xl text-on-surface-variant mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in-up text-balance" style={{ animationDelay: '200ms' }}>
              Transform your institution with intelligent Socratic tutoring, real-time curriculum DAGs, and interactive mastery tracking. Built for scale, engineered for actual learning.
            </p>

             <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 animate-fade-in-up w-full sm:w-auto" style={{ animationDelay: '300ms' }}>
              <Link 
                href="/home"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-primary text-on-primary font-semibold text-lg hover:bg-primary/90 transition-all shadow-[0_0_40px_-10px_rgba(var(--color-primary),0.5)] hover:shadow-[0_0_60px_-15px_rgba(var(--color-primary),0.7)] hover:-translate-y-1 flex items-center justify-center gap-2 group"
              >
                test demo
                <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_forward</span>
              </Link>
              <a 
                href="mailto:social@exortic.com"
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-surface/50 backdrop-blur-md border border-outline-variant/50 text-on-surface hover:bg-surface-variant/50 transition-all font-medium text-lg hover:-translate-y-1 shadow-sm"
              >
                For schools & institutes
              </a>
            </div>
          </div>

          {/* Dashboard Preview Mockup */}
          <div className="mt-24 sm:mt-32 max-w-6xl mx-auto relative group animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <div className="absolute inset-[-4px] rounded-3xl bg-gradient-to-r from-primary via-secondary to-primary opacity-30 blur-2xl group-hover:opacity-70 transition-opacity duration-700 animate-gradient bg-300%"></div>
            <div className="relative rounded-2xl sm:rounded-[2rem] bg-surface/40 backdrop-blur-2xl border border-outline-variant/20 shadow-2xl overflow-hidden ring-1 ring-white/10">
              {/* Window Controls */}
              <div className="h-12 bg-surface/40 border-b border-outline-variant/10 flex items-center px-6 gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-sm"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-sm"></div>
                <div className="ml-4 flex-1 flex justify-center">
                  <div className="h-6 w-48 bg-surface-variant/30 rounded-md border border-outline-variant/10 flex items-center justify-center px-3">
                    <span className="text-[10px] text-on-surface-variant/50 font-mono">guidey.exortic.com</span>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-8 aspect-[4/3] sm:aspect-video flex flex-col md:flex-row gap-4 sm:gap-6 bg-surface/20">
                {/* Fake Sidebar */}
                <div className="w-1/4 hidden md:flex flex-col gap-4 border-r border-outline-variant/10 pr-6">
                  <div className="h-10 bg-primary/20 rounded-xl w-full mb-6 flex items-center px-4 gap-3 border border-primary/10">
                    <div className="w-5 h-5 rounded-md bg-primary/50"></div>
                    <div className="h-3 bg-primary/40 rounded w-16"></div>
                  </div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={`h-8 rounded-lg w-full flex items-center px-3 gap-3 ${i === 1 ? 'bg-surface-variant/30' : 'hover:bg-surface-variant/20 transition-colors cursor-pointer'}`}>
                      <div className="w-4 h-4 rounded bg-on-surface-variant/30"></div>
                      <div className="h-2 bg-on-surface-variant/20 rounded w-20"></div>
                    </div>
                  ))}
                </div>
                {/* Fake Main Content */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="flex justify-between items-end pb-4 border-b border-outline-variant/10">
                    <div>
                      <div className="h-8 bg-on-surface/80 rounded-lg w-48 mb-2"></div>
                      <div className="h-4 bg-on-surface-variant/50 rounded-md w-32"></div>
                    </div>
                    <div className="h-10 bg-secondary/20 rounded-full w-10 flex-shrink-0 border border-secondary/30"></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-28 bg-surface-variant/10 rounded-2xl border border-outline-variant/10 p-4 flex flex-col justify-between hover:bg-surface-variant/20 transition-colors cursor-pointer group shadow-sm hover:shadow-md">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <div className="w-4 h-4 rounded-sm bg-primary/50 group-hover:scale-110 transition-transform"></div>
                        </div>
                        <div>
                          <div className="h-6 bg-on-surface/70 rounded w-16 mb-2"></div>
                          <div className="h-3 bg-on-surface-variant/40 rounded w-24"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 bg-surface-variant/5 rounded-2xl border border-outline-variant/10 p-6 flex flex-col gap-4 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="h-5 bg-on-surface/60 rounded-md w-32"></div>
                      <div className="h-5 bg-primary/20 rounded-md w-16"></div>
                    </div>
                    <div className="flex-1 flex items-end gap-2">
                      {[40, 70, 45, 90, 65, 80, 50, 100, 75, 85].map((height, i) => (
                        <div key={i} className="flex-1 bg-secondary/20 rounded-t-sm hover:bg-secondary/40 transition-colors relative group" style={{ height: `${height}%` }}>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity border border-outline-variant/30 text-on-surface">{height}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="relative z-10 py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-surface-container-lowest/50 border-y border-outline-variant/10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 sm:mb-24">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-on-surface mb-6 tracking-tight">The flow of mastery.</h2>
              <p className="text-on-surface-variant text-lg sm:text-xl max-w-2xl mx-auto text-balance">
                A seamless pipeline from institutional onboarding to individualized student success.
              </p>
            </div>

            <div className="space-y-24 sm:space-y-40">
              {[
                {
                  step: 1,
                  title: "Upload Syllabus",
                  desc: "Simply drag and drop your existing PDF syllabus. Our AI instantly parses it into a structured Curriculum DAG, mapping out prerequisites and learning objectives automatically.",
                  color: "primary",
                  mockup: (
                    <div className="w-full h-full bg-surface-variant/10 flex flex-col items-center justify-center p-8 gap-6 group">
                      <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-primary/50 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors group-hover:scale-105 duration-300">
                        <span className="material-symbols-outlined text-4xl text-primary">upload_file</span>
                      </div>
                      <div className="space-y-3 w-full max-w-xs">
                        <div className="h-2 bg-on-surface-variant/20 rounded-full w-full overflow-hidden">
                          <div className="h-full bg-primary w-2/3 rounded-full animate-pulse"></div>
                        </div>
                        <div className="text-center text-xs text-on-surface-variant font-mono">Parsing curriculum DAG...</div>
                      </div>
                    </div>
                  )
                },
                {
                  step: 2,
                  title: "Assign Credentials",
                  desc: "Manage your institution effortlessly. Add students, assign them to specific groups or semesters, and securely provision their access credentials in seconds.",
                  color: "secondary",
                  reverse: true,
                  mockup: (
                    <div className="w-full h-full bg-surface-variant/10 p-6 flex flex-col gap-4">
                      <div className="h-8 w-1/3 bg-secondary/20 rounded-md mb-2"></div>
                      {[1, 2, 3, 4].map((i) => (
                        <div className="bg-surface/50 p-4 rounded-xl border border-outline-variant/10 flex items-center gap-4 hover:-translate-y-1 transition-transform cursor-pointer shadow-sm hover:shadow-md" key={i}>
                          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-secondary text-sm">person</span>
                          </div>
                          <div className="flex-1">
                            <div className="h-4 w-24 bg-on-surface/60 rounded mb-2"></div>
                            <div className="h-3 w-32 bg-on-surface-variant/40 rounded"></div>
                          </div>
                          <div className="w-8 h-4 bg-green-500/20 rounded-full"></div>
                        </div>
                      ))}
                    </div>
                  )
                },
                {
                  step: 3,
                  title: "Learn from AI",
                  desc: "Students interact with a stateful Socratic tutor. The AI doesn't just give answers; it guides them step-by-step through complex concepts and generates dynamic micro-quizzes.",
                  color: "primary",
                  mockup: (
                    <div className="w-full h-full bg-surface-variant/10 p-6 flex flex-col">
                      <div className="flex-1 overflow-hidden flex flex-col gap-4">
                        <div className="self-end bg-primary/20 text-on-surface p-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm shadow-sm">
                          Can you explain how backpropagation works?
                        </div>
                        <div className="self-start bg-surface text-on-surface p-4 rounded-2xl rounded-tl-sm max-w-[90%] text-sm border border-outline-variant/10 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded bg-primary/30 flex items-center justify-center"><span className="material-symbols-outlined text-[12px]">smart_toy</span></div>
                            <span className="font-semibold text-xs text-primary">Socratic Tutor</span>
                          </div>
                          <div className="space-y-2">
                            <div className="h-2 w-full bg-on-surface-variant/30 rounded"></div>
                            <div className="h-2 w-5/6 bg-on-surface-variant/30 rounded"></div>
                            <div className="h-2 w-4/5 bg-on-surface-variant/30 rounded"></div>
                          </div>
                        </div>
                        <div className="self-start bg-secondary/10 p-3 rounded-xl border border-secondary/20 w-[70%] shadow-sm">
                          <div className="text-xs font-semibold text-secondary mb-2">Quick Check</div>
                          <div className="flex gap-2">
                            <div className="w-4 h-4 rounded-full border border-secondary/40"></div>
                            <div className="h-3 w-3/4 bg-secondary/30 rounded"></div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 h-12 bg-surface rounded-full border border-outline-variant/10 flex items-center px-4 shadow-sm">
                        <div className="h-4 w-1/3 bg-on-surface-variant/20 rounded"></div>
                      </div>
                    </div>
                  )
                },
                {
                  step: 4,
                  title: "Check Analytics",
                  desc: "Teachers and admins get real-time insights. View mastery heatmaps, track engagement metrics, and identify exactly where students are getting stuck.",
                  color: "secondary",
                  reverse: true,
                  mockup: (
                    <div className="w-full h-full bg-surface-variant/10 p-6 flex flex-col gap-6">
                      <div className="flex gap-4">
                        <div className="flex-1 h-24 bg-surface rounded-2xl border border-outline-variant/10 p-4 flex flex-col justify-between shadow-sm">
                          <span className="text-xs text-on-surface-variant font-semibold uppercase">Avg Mastery</span>
                          <span className="text-3xl font-bold text-primary">84%</span>
                        </div>
                        <div className="flex-1 h-24 bg-surface rounded-2xl border border-outline-variant/10 p-4 flex flex-col justify-between shadow-sm">
                          <span className="text-xs text-on-surface-variant font-semibold uppercase">Engagement</span>
                          <span className="text-3xl font-bold text-secondary">92%</span>
                        </div>
                      </div>
                      <div className="flex-1 bg-surface rounded-2xl border border-outline-variant/10 p-4 flex flex-col gap-2 shadow-sm">
                        <span className="text-sm font-semibold text-on-surface mb-2">Topic Mastery Heatmap</span>
                        <div className="grid grid-cols-6 gap-2 flex-1">
                          {[
                            4, 3, 2, 5, 4, 3,
                            3, 5, 4, 3, 2, 4,
                            5, 4, 3, 2, 5, 3,
                            2, 3, 5, 4, 3, 4
                          ].map((level, i) => (
                            <div key={i} className={`rounded-md ${
                              level === 5 ? 'bg-green-500/60' : 
                              level === 4 ? 'bg-green-500/40' : 
                              level === 3 ? 'bg-green-500/20' : 
                              level === 2 ? 'bg-yellow-500/30' : 'bg-red-500/30'
                            }`}></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                }
              ].map((item) => (
                <div key={item.step} className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-24 ${item.reverse ? 'lg:flex-row-reverse' : ''}`}>
                  <div className="flex-1 space-y-6 sm:space-y-8 text-center lg:text-left">
                    <div className={`w-14 h-14 rounded-2xl bg-${item.color}/10 flex items-center justify-center text-${item.color} font-bold text-2xl mx-auto lg:mx-0 shadow-inner ring-1 ring-${item.color}/20`}>
                      {item.step}
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight">{item.title}</h3>
                    <p className="text-lg sm:text-xl text-on-surface-variant leading-relaxed text-balance">
                      {item.desc}
                    </p>
                  </div>
                  <div className="flex-1 w-full max-w-md lg:max-w-none mx-auto perspective-[1000px]">
                    <div className={`relative rounded-[2rem] bg-surface/40 backdrop-blur-md border border-outline-variant/20 shadow-2xl overflow-hidden aspect-[4/3] sm:aspect-square lg:aspect-[4/3] transform transition-transform duration-500 hover:rotate-y-[5deg] hover:rotate-x-[5deg] shadow-${item.color}/20`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent z-10 pointer-events-none"></div>
                      {item.mockup}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" className="relative z-10 py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 sm:mb-24">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-on-surface mb-6 tracking-tight">Engineered for Mastery.</h2>
              <p className="text-on-surface-variant text-lg sm:text-xl max-w-2xl mx-auto text-balance">
                Not just another LLM wrapper. guiEDTeach uses specialized multi-agent architectures mapped directly to an intelligent curriculum graph.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
              {[
                {
                  icon: "psychology",
                  title: "Socratic Execution Engine",
                  desc: "Our stateful tutor guides students step-by-step instead of dumping answers, ensuring true comprehension through dynamic dialog.",
                  colSpan: "lg:col-span-2",
                  bg: "from-primary/10 to-surface/5"
                },
                {
                  icon: "hub",
                  title: "Curriculum DAGs",
                  desc: "Every subject mapped as a Directed Acyclic Graph to automatically track prerequisites and bridge knowledge gaps.",
                  colSpan: "lg:col-span-1",
                  bg: "from-secondary/10 to-surface/5"
                },
                {
                  icon: "insert_chart",
                  title: "Real-time Mastery Tracking",
                  desc: "Instant heatmaps and progress tracking update as students interact with the AI.",
                  colSpan: "lg:col-span-1",
                  bg: "from-surface-variant/20 to-surface/5"
                },
                {
                  icon: "code_blocks",
                  title: "Multi-Agent Architecture",
                  desc: "Dedicated agents for grading, curriculum generation, and specialized tutoring work in concert to provide a seamless educational experience.",
                  colSpan: "lg:col-span-2",
                  bg: "from-primary/5 via-secondary/5 to-surface/5"
                }
              ].map((feat, i) => (
                <div key={i} className={`group relative p-8 sm:p-10 rounded-[2rem] bg-surface/40 backdrop-blur-xl border border-outline-variant/30 hover:border-outline-variant/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-xl ${feat.colSpan}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${feat.bg} opacity-50 group-hover:opacity-100 transition-opacity duration-500`}></div>
                  <div className="relative z-10 h-full flex flex-col">
                    <div className="w-16 h-16 rounded-2xl bg-surface/80 shadow-sm flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-surface transition-all duration-500 border border-outline-variant/20">
                      <span className="material-symbols-outlined text-3xl text-on-surface">{feat.icon}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-on-surface mb-4 tracking-tight">{feat.title}</h3>
                    <p className="text-on-surface-variant text-lg leading-relaxed flex-grow">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative z-10 py-24 sm:py-32 px-4 sm:px-6 lg:px-8 mb-12">
          <div className="max-w-5xl mx-auto rounded-[3rem] p-10 sm:p-16 text-center relative overflow-hidden shadow-2xl group">
            {/* Animated glowing background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary bg-[length:200%_200%] animate-[gradient_5s_ease_infinite] opacity-90"></div>
            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PHBhdGggZD0iTTAgMGgyNHYyNEgwem0xIDEyaDIydjFIMXptMTItMTF2MjJoLTFWMXoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-40"></div>
            
            <div className="relative z-10">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 tracking-tight">Ready to deploy the future?</h2>
              <p className="text-white/90 text-lg sm:text-xl max-w-2xl mx-auto mb-10 font-medium text-balance">
                Bring the power of autonomous AI tutoring to your institution today. Custom integrations and dedicated support included.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-primary font-bold text-lg hover:scale-105 transition-transform shadow-xl hover:shadow-2xl flex items-center justify-center gap-2"
                >
                  Start Learning Now
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </Link>
                <a 
                  href="mailto:social@exortic.com"
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-transparent hover:bg-white/10 text-white font-medium text-lg border border-white/30 hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                  Contact Sales Team
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
