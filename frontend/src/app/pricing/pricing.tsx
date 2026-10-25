"use client";

import Link from "next/link";
import Image from "next/image";
import PublicFooter from "@/components/PublicFooter";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-secondary/30 relative overflow-hidden font-body-md flex flex-col">
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
            <Link href="/pricing" className="text-sm font-semibold text-primary transition-colors">
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

      <main className="flex-grow relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header text */}
          <div className="text-center mb-16 sm:mb-20">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-headline-md font-extrabold tracking-tight text-on-surface mb-6">
              Simple, transparent plans.
            </h1>
            <p className="text-lg sm:text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              Whether you are an individual learner or a large school, choose the plan built to unlock your learning potential.
            </p>
          </div>

          {/* Pricing cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
            {/* Free Plan Card */}
            <div className="bg-surface/40 backdrop-blur-xl border border-outline-variant rounded-[2rem] p-8 sm:p-10 shadow-lg flex flex-col justify-between hover:border-primary/50 transition-all duration-300 relative group">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-primary">Solo Learner</h3>
                  <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Free</span>
                </div>
                <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                  Ideal for independent students, solo developers, and self-taught learners.
                </p>
                <div className="flex items-baseline mb-8">
                  <span className="text-5xl font-extrabold text-on-surface tracking-tight">$0</span>
                  <span className="text-on-surface-variant text-sm font-semibold ml-2">/ month</span>
                </div>

                <div className="border-t border-outline-variant/30 pt-8 mb-8">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-4">Included Features</h4>
                  <ul className="space-y-4">
                    {[
                      "Stateless Socratic dialogues",
                      "Default templates (JEE, NEET, UPSC)",
                      "Interactive curriculum prereqs DAG graph",
                      "AI coding project milestone guidance",
                      "Adaptive weaknesses & mistake reports",
                      "Earn tokens via referring peers"
                    ].map((feat, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-green-500 text-[18px] flex-shrink-0">check_circle</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8">
                <Link 
                  href="/signup" 
                  className="w-full py-4 bg-primary text-on-primary font-bold rounded-xl text-center flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-98 text-sm"
                >
                  Start Learning Free
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Contact Sales Plan Card */}
            <div className="bg-surface/40 backdrop-blur-xl border border-outline-variant rounded-[2rem] p-8 sm:p-10 shadow-lg flex flex-col justify-between hover:border-secondary/50 transition-all duration-300 relative group">
              {/* Highlight badge overlay */}
              <div className="absolute -top-3.5 left-10 bg-secondary text-on-primary text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-secondary shadow-md">
                For Institutions
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-6 mt-2">
                  <h3 className="text-2xl font-bold text-secondary">Organisations</h3>
                  <span className="bg-secondary/10 text-secondary border border-secondary/20 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">Custom</span>
                </div>
                <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
                  Tailored for schools, tutoring centers, universities, coaching classes, and departments.
                </p>
                <div className="flex items-baseline mb-8">
                  <span className="text-3xl font-extrabold text-on-surface tracking-tight">Contact Sales</span>
                </div>

                <div className="border-t border-outline-variant/30 pt-8 mb-8">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider mb-4">Enterprise Features</h4>
                  <ul className="space-y-4">
                    {[
                      "Structured syllabus PDF ingestion",
                      "Classroom & group user management",
                      "Custom domain branding mapping",
                      "Institutional teacher-admin dashboard",
                      "Dynamic cohort heatmaps & progress metrics",
                      "Dedicated tutor model tuning",
                      "Enterprise SLA & API rate limits"
                    ].map((feat, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-secondary text-[18px] flex-shrink-0">check_circle</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8">
                <a 
                  href="mailto:social@exortic.com" 
                  className="w-full py-4 border border-outline hover:bg-surface-variant/30 text-on-surface font-bold rounded-xl text-center flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-98 text-sm"
                >
                  Contact Sales Team
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
