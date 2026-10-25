'use client';

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import PublicFooter from "@/components/PublicFooter";

interface Section {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

export default function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState<string>("introduction");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const sections: Section[] = [
    {
      id: "introduction",
      title: "1. Introduction",
      icon: "info",
      content: (
        <div className="space-y-4">
          <p>guiEDTeach ("we", "our", "us", or the "Service") respects your privacy and is committed to protecting personal information. This Privacy Policy explains how we collect, use, process, store, share, protect, and manage information obtained through our websites, applications, APIs, educational platforms, AI systems, analytics tools, and related services.</p>
          <p>By accessing or using the Service, you acknowledge that you have read and understood this Privacy Policy.</p>
        </div>
      )
    },
    {
      id: "info-collect",
      title: "2. Information We Collect",
      icon: "find_in_page",
      content: (
        <div className="space-y-6">
          <p>We may collect information directly from users, educational institutions, organizations, devices, integrations, and automated systems.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 bg-surface-container/40 rounded-2xl border border-outline-variant/10">
              <h4 className="font-semibold text-secondary flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-lg">account_box</span>
                Account Information
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-on-surface-variant">
                <li>Name & Email address</li>
                <li>Username & Profile information</li>
                <li>Educational institution details</li>
                <li>Organizational affiliation & Role info</li>
                <li>Authentication information</li>
              </ul>
            </div>

            <div className="p-5 bg-surface-container/40 rounded-2xl border border-outline-variant/10">
              <h4 className="font-semibold text-secondary flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-lg">school</span>
                Learning Information
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-on-surface-variant">
                <li>Subjects & Topics studied</li>
                <li>Skill mastery levels & progress records</li>
                <li>Assessment & quiz performance</li>
                <li>Learning pathways & curriculum completion</li>
                <li>Knowledge competency metrics</li>
              </ul>
            </div>

            <div className="p-5 bg-surface-container/40 rounded-2xl border border-outline-variant/10">
              <h4 className="font-semibold text-secondary flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-lg">forum</span>
                AI Interaction Data
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-on-surface-variant">
                <li>User prompts and AI conversations</li>
                <li>Uploaded files and documents</li>
                <li>Generated outputs & history logs</li>
                <li>Feedback provided to AI responses</li>
              </ul>
              <p className="text-xs text-on-surface-variant/80 mt-3 italic">Authorized personnel may review interactions strictly to improve service quality, investigate abuse, maintain security, and optimize performance.</p>
            </div>

            <div className="p-5 bg-surface-container/40 rounded-2xl border border-outline-variant/10">
              <h4 className="font-semibold text-secondary flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-lg">trending_up</span>
                Usage & Technical Info
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-sm text-on-surface-variant">
                <li>Session duration & feature usage</li>
                <li>IP addresses & Browser/Device data</li>
                <li>Operating system information</li>
                <li>Error logs, diagnostics & security logs</li>
              </ul>
            </div>
          </div>

          <div className="p-5 bg-surface-container/40 rounded-2xl border border-outline-variant/10 mt-4">
            <h4 className="font-semibold text-secondary flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-lg">corporate_fare</span>
              Institution and Organization Data
            </h4>
            <p className="text-sm text-on-surface-variant">Educational institutions and organizations may provide enrollment info, course syllabus definitions, organizational hierarchies, learning requirements, and student academic records authorized for platform use.</p>
          </div>
        </div>
      )
    },
    {
      id: "info-use",
      title: "3. How We Use Information",
      icon: "psychology",
      content: (
        <div className="space-y-4">
          <p>We use collected information to:</p>
          
          <div className="space-y-3.5 mt-2">
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-primary mt-1">task_alt</span>
              <div>
                <strong className="text-on-surface text-sm block">Provide & Personalize Services</strong>
                <span className="text-sm text-on-surface-variant">Deliver educational experiences, generate AI learning assistance, track progress, manage accounts, and authenticate users.</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-primary mt-1">analytics</span>
              <div>
                <strong className="text-on-surface text-sm block">Improve Educational Outcomes & AI Systems</strong>
                <span className="text-sm text-on-surface-variant">Measure learning effectiveness, optimize topic mastery analysis and recommend personalized pathways. Prompts and conversations may be processed to train, validate, and enhance AI response accuracy.</span>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="material-symbols-outlined text-primary mt-1">shield_person</span>
              <div>
                <strong className="text-on-surface text-sm block">Maintain Security & Prevent Abuse</strong>
                <span className="text-sm text-on-surface-variant">Detect abuse, investigate suspicious activities, prevent unauthorized system access, protect users, and enforce system safety controls.</span>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="material-symbols-outlined text-primary mt-1">mail</span>
              <div>
                <strong className="text-on-surface text-sm block">Support & Communications</strong>
                <span className="text-sm text-on-surface-variant">Send crucial system notifications, provide customer support assistance, communicate security updates, and respond to user inquiries.</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-on-surface-variant/80 italic mt-3">Data may be aggregated, anonymized, or de-identified for analytics, research, testing, and service improvement purposes where permitted by law.</p>
        </div>
      )
    },
    {
      id: "ai-content",
      title: "4. AI Conversations and Uploaded Content",
      icon: "chat_bubble",
      content: (
        <div className="space-y-4">
          <p>Information submitted to the Service may be processed by AI systems.</p>
          <div className="p-4 bg-error-container/10 border-l-4 border-error text-on-surface rounded-r-2xl">
            <strong className="text-error flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-lg">warning</span>
              Privacy Best Practice
            </strong>
            Users should avoid submitting passwords, banking details, highly confidential information, trade secrets, or sensitive personal information unless absolutely necessary.
          </div>
          <p>Content submitted to the Service may be stored, processed, analyzed, indexed, reviewed, and used to improve system performance, educational quality, security, reliability, and future platform capabilities.</p>
        </div>
      )
    },
    {
      id: "talent-services",
      title: "5. Talent and Employment Services",
      icon: "work",
      content: (
        <div className="space-y-4">
          <p>The platform may offer talent discovery, skills verification, competency assessment, recruitment assistance, employment matching, portfolio verification, or Talent-as-a-Service (TaaS) features.</p>
          <p>For such services, we may share educational achievements, skill mastery records, assessment results, competency indicators, certifications, portfolios, and public profile data with employers, recruiters, hiring networks, and placement partners.</p>
          <p className="font-semibold text-primary">This sharing only occurs where authorized by the user, educational institution, organization, applicable agreement, or applicable law.</p>
          <p className="p-4 bg-secondary/5 border border-secondary/15 rounded-2xl text-sm text-on-surface-variant">
            <strong>Note:</strong> We do not sell personal information to advertisers or data brokers.
          </p>
        </div>
      )
    },
    {
      id: "info-sharing",
      title: "6. Information Sharing",
      icon: "share",
      content: (
        <div className="space-y-4">
          <p>We may share information under the following circumstances:</p>
          <ul className="space-y-3.5">
            <li className="flex gap-3">
              <span className="material-symbols-outlined text-secondary mt-0.5">cloud</span>
              <div>
                <strong>Service Providers:</strong> Third-party vendors assisting with hosting, infrastructure, analytics, security, customer support, and cloud communications.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="material-symbols-outlined text-secondary mt-0.5">school</span>
              <div>
                <strong>Educational Institutions & Orgs:</strong> Where users access the Service through an institution or organization, relevant information is shared with authorized group administrators.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="material-symbols-outlined text-secondary mt-0.5">gavel</span>
              <div>
                <strong>Legal Requirements:</strong> Compliance with applicable laws, response to legal requests, prevention of fraud, and protection of public safety.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="material-symbols-outlined text-secondary mt-0.5">business_center</span>
              <div>
                <strong>Business Transactions:</strong> Transfers during acquisitions, mergers, investments, corporate restructurings, or asset sales.
              </div>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: "data-retention",
      title: "7. Data Retention",
      icon: "restore_from_trash",
      content: (
        <div className="space-y-4">
          <p>We retain information for as long as necessary to provide services, improve AI systems, meet legal obligations, resolve disputes, maintain security, and enforce agreements.</p>
          <p>Retention periods vary depending on information type and applicable requirements.</p>
        </div>
      )
    },
    {
      id: "security",
      title: "8. Security",
      icon: "lock",
      content: (
        <div className="space-y-4">
          <p>We implement technical, administrative, and organizational safeguards designed to protect information. Such measures include:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <li>Data encryption in transit and at rest</li>
            <li>Strict role-based access controls</li>
            <li>Continuous security monitoring and logging</li>
            <li>Advanced authentication protocols</li>
            <li>Protected network infrastructure</li>
            <li>Robust internal security procedures</li>
          </ul>
          <p className="mt-2 text-on-surface-variant/80 text-sm">No security system can guarantee absolute protection, and users acknowledge that information transmission and storage involve inherent risks.</p>
        </div>
      )
    },
    {
      id: "user-rights",
      title: "9. User Rights and Controls",
      icon: "tune",
      content: (
        <div className="space-y-4">
          <p>Subject to applicable law, users may request controls over their data:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access to and correction of personal information.</li>
            <li>Deletion of personal information.</li>
            <li>Restriction of data processing.</li>
            <li>Export of data (data portability).</li>
            <li>Account closure.</li>
          </ul>
          <p>Certain information may be retained where legally required or operationally necessary.</p>
        </div>
      )
    },
    {
      id: "cookies",
      title: "10. Cookies and Similar Technologies",
      icon: "cookie",
      content: (
        <div className="space-y-4">
          <p>We may use cookies, local storage, analytics trackers, and session identifiers to operate, secure, improve, and personalize the Service.</p>
          <p>You can manage cookie settings through your browser options, though disabling cookies may affect certain platform capabilities.</p>
        </div>
      )
    },
    {
      id: "international",
      title: "11. International Processing",
      icon: "public",
      content: (
        <div className="space-y-4">
          <p>Information may be processed, transferred, and stored in jurisdictions different from the user's location. Users consent to such processing where permitted by applicable law.</p>
        </div>
      )
    },
    {
      id: "children",
      title: "12. Children's Privacy",
      icon: "child_care",
      content: (
        <div className="space-y-4">
          <p>Where applicable, educational institutions, parents, guardians, or authorized parties are responsible for obtaining required permissions before providing children's information to the Service.</p>
        </div>
      )
    },
    {
      id: "changes",
      title: "13. Changes to this Policy",
      icon: "edit",
      content: (
        <div className="space-y-4">
          <p>We may update this Privacy Policy periodically. Changes become effective when published unless otherwise stated.</p>
          <p>Continued use of the Service after changes constitutes acceptance of the revised Privacy Policy.</p>
        </div>
      )
    },
    {
      id: "contact",
      title: "14. Contact Information",
      icon: "contact_support",
      content: (
        <div className="space-y-4">
          <p>Questions regarding this Privacy Policy may be directed to:</p>
          <div className="p-4 bg-primary-container/20 rounded-2xl border border-primary-container/30 inline-flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">alternate_email</span>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">Privacy Officer Email</p>
              <a href="mailto:social@exortic.com" className="text-secondary hover:text-primary transition-colors font-bold underline">
                social@exortic.com
              </a>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "acknowledgement",
      title: "15. Acknowledgement",
      icon: "check_circle",
      content: (
        <div className="space-y-4 font-medium text-on-surface">
          <p>By accessing or using the Service, you acknowledge that you have read, understood, and agree to the collection, use, processing, storage, sharing, analysis, and management of information as described in this Privacy Policy.</p>
        </div>
      )
    }
  ];

  // Filter sections by search query
  const filteredSections = sections.filter(sec =>
    sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Scroll spy mechanism
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const sec of sections) {
        const el = sectionRefs.current[sec.id];
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sec.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = sectionRefs.current[id];
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 120,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-secondary/30 relative overflow-hidden font-body-md flex flex-col">
      <title>Privacy Policy | guiEDTeach</title>
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[0]">
        <div className="absolute top-[-10%] right-[-15%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] animate-[pulse_10s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-[-10%] left-[-15%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-[120px] animate-[pulse_12s_ease-in-out_infinite]"></div>
      </div>

      {/* Elegant Header Banner */}
      <header className="relative z-10 pt-28 pb-14 px-6 border-b border-outline-variant/20 bg-surface/35 backdrop-blur-md">
        <div className="max-w-7xl mx-auto w-full">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary transition-all duration-200 mb-6 bg-surface-container/50 px-4 py-2 rounded-full border border-outline-variant/15 hover:shadow-sm w-fit group">
            <span className="material-symbols-outlined text-sm transition-transform duration-200 group-hover:-translate-x-1">arrow_back</span>
            Back to Home
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline-md font-extrabold tracking-tight text-on-surface mb-4">
                Privacy Policy
              </h1>
              <p className="text-on-surface-variant/80 font-medium">Last Updated: June 2026</p>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-high/60 border border-outline-variant/30 px-4 py-2.5 rounded-2xl w-fit text-sm font-semibold text-on-surface-variant">
              <span className="material-symbols-outlined text-secondary text-lg">verified_user</span>
              <span>10 min read</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 relative z-10 py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Sticky Sidebar Navigation */}
          <aside className="lg:col-span-4 lg:sticky lg:top-28 h-fit hidden lg:flex flex-col gap-6">
            <div className="bg-surface-container/40 backdrop-blur-md rounded-3xl border border-outline-variant/20 p-6 shadow-xl">
              {/* Search filter */}
              <div className="relative mb-6">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/50 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Filter policy sections..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface-container-high/60 border border-outline-variant/30 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-secondary transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/50 hover:text-on-surface text-lg cursor-pointer"
                  >
                    close
                  </button>
                )}
              </div>

              <h3 className="text-xs font-bold text-secondary uppercase tracking-widest mb-4 px-2">Policy Navigation</h3>
              <nav className="space-y-1 max-h-[450px] overflow-y-auto pr-1 no-scrollbar scroll-smooth">
                {filteredSections.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-3 cursor-pointer ${
                      activeSection === sec.id
                        ? "bg-secondary text-on-secondary-container font-semibold shadow-md translate-x-1"
                        : "hover:bg-surface-container-high/50 text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{sec.icon}</span>
                    <span className="truncate">{sec.title.substring(sec.title.indexOf(" ") + 1)}</span>
                  </button>
                ))}
                {filteredSections.length === 0 && (
                  <p className="text-xs text-on-surface-variant/70 italic p-4 text-center">No matching sections found.</p>
                )}
              </nav>
            </div>

            {/* Privacy Promise Callout */}
            <div className="bg-primary-container/20 border border-primary-container/30 rounded-3xl p-6 shadow-md">
              <h4 className="font-semibold text-on-surface mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">security_agreement</span>
                Our Privacy Promise
              </h4>
              <p className="text-xs text-on-surface-variant/90 leading-relaxed">
                We believe privacy is a fundamental right. We design our platform to collect only the minimal information required to deliver effective personal AI tutoring and ensure complete organizational isolation.
              </p>
            </div>
          </aside>

          {/* Right Document Sections Container */}
          <div className="lg:col-span-8 space-y-8">
            {/* Quick jump for mobile screens */}
            <div className="lg:hidden bg-surface-container/40 backdrop-blur-md rounded-2xl border border-outline-variant/20 p-4 mb-6">
              <label htmlFor="section-select" className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">
                Quick Navigation
              </label>
              <select
                id="section-select"
                value={activeSection}
                onChange={(e) => scrollToSection(e.target.value)}
                className="w-full bg-surface-container-high/60 border border-outline-variant/30 rounded-xl p-2.5 text-sm focus:outline-none focus:border-secondary"
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title}
                  </option>
                ))}
              </select>
            </div>

            {filteredSections.map((sec) => (
              <div
                key={sec.id}
                ref={(el) => {
                  sectionRefs.current[sec.id] = el;
                }}
                className={`bg-surface/40 backdrop-blur-md p-8 md:p-10 rounded-3xl border transition-all duration-300 shadow-xl ${
                  activeSection === sec.id
                    ? "border-secondary/40 shadow-secondary/5"
                    : "border-outline-variant/20"
                }`}
              >
                <div className="flex items-center gap-3.5 border-b border-outline-variant/20 pb-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined">{sec.icon}</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-headline-sm font-bold text-on-surface">
                    {sec.title}
                  </h2>
                </div>
                <div className="font-body-lg text-on-surface-variant leading-relaxed max-w-none">
                  {sec.content}
                </div>
              </div>
            ))}
            
            {filteredSections.length === 0 && (
              <div className="text-center py-20 bg-surface/20 rounded-3xl border border-outline-variant/10">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">search_off</span>
                <h3 className="text-lg font-bold text-on-surface">No Results Matched Your Filter</h3>
                <p className="text-sm text-on-surface-variant/70 mt-1">Try resetting the filter query in the sidebar.</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 bg-secondary text-on-secondary-container text-xs font-bold px-4 py-2 rounded-full cursor-pointer hover:shadow-md"
                >
                  Clear Filter
                </button>
              </div>
            )}
          </div>
          
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
