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

export default function TermsOfService() {
  const [activeSection, setActiveSection] = useState<string>("acceptance");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const sections: Section[] = [
    {
      id: "acceptance",
      title: "1. Acceptance of Terms",
      icon: "gavel",
      content: (
        <div className="space-y-4">
          <p>By accessing, browsing, registering for, purchasing, licensing, integrating with, or otherwise using guiEDTeach, its websites, applications, APIs, software, educational tools, AI systems, services, content, features, and related technologies (collectively, the "Service"), you acknowledge that you have read, understood, and agree to be legally bound by these Terms of Service.</p>
          <p>If you do not agree with these Terms, you must immediately discontinue use of the Service.</p>
          <p>If you are accessing the Service on behalf of an educational institution, business, organization, government entity, or other legal entity, you represent and warrant that you have authority to bind such entity to these Terms.</p>
          <p>Users must comply with all applicable local, state, national, and international laws and regulations.</p>
        </div>
      )
    },
    {
      id: "eligibility",
      title: "2. Eligibility",
      icon: "verified_user",
      content: (
        <div className="space-y-4">
          <p>You represent and warrant that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You have the legal capacity to enter into these Terms.</li>
            <li>Information provided to us is accurate and current.</li>
            <li>You will maintain the accuracy of your account information.</li>
            <li>You will not use the Service if prohibited by applicable law.</li>
          </ul>
        </div>
      )
    },
    {
      id: "description",
      title: "3. Description of Service",
      icon: "description",
      content: (
        <div className="space-y-4">
          <p>guiEDTeach is an AI-powered educational and learning platform that may provide:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Conversational AI learning experiences.</li>
            <li>Interactive educational content.</li>
            <li>Assessments and evaluations.</li>
            <li>Analytics and learning insights.</li>
            <li>Educational resource generation.</li>
            <li>Curriculum support.</li>
            <li>Research assistance.</li>
            <li>Institutional management tools.</li>
            <li>APIs and integrations.</li>
            <li>Future products, services, and features.</li>
          </ul>
          <p>Features may be added, modified, suspended, restricted, or discontinued at any time.</p>
          <p>We do not guarantee uninterrupted availability of any feature, model, capability, output, integration, or service component.</p>
        </div>
      )
    },
    {
      id: "disclaimer",
      title: "4. Educational Use and AI Disclaimer",
      icon: "warning",
      content: (
        <div className="space-y-4">
          <p>The Service is intended to assist learning and education.</p>
          <div className="p-4 bg-error-container/10 border-l-4 border-error text-on-surface rounded-r-2xl">
            <strong className="text-error flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-lg">warning</span>
              AI Disclaimer
            </strong>
            AI-generated content may contain inaccuracies, omissions, outdated information, hallucinations, or errors.
          </div>
          <p>Users remain solely responsible for independently verifying information before relying on it for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Academic submissions.</li>
            <li>Research.</li>
            <li>Medical decisions.</li>
            <li>Financial decisions.</li>
            <li>Legal decisions.</li>
            <li>Professional advice.</li>
            <li>Safety-critical activities.</li>
          </ul>
          <p>The Service does not provide licensed legal, financial, medical, engineering, or professional advice.</p>
        </div>
      )
    },
    {
      id: "acceptable-use",
      title: "5. Acceptable Use Policy",
      icon: "rule",
      content: (
        <div className="space-y-4">
          <p>You agree to use the Service only for lawful and authorized purposes.</p>
          <div className="p-5 bg-secondary/5 rounded-2xl border border-secondary/10">
            <h4 className="font-semibold text-secondary flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-lg">done_all</span>
              You may:
            </h4>
            <ul className="list-disc pl-6 space-y-1.5 text-on-surface-variant">
              <li>Learn cybersecurity concepts.</li>
              <li>Study programming.</li>
              <li>Learn ethical hacking concepts.</li>
              <li>Research security methodologies.</li>
              <li>Analyze vulnerabilities in authorized environments.</li>
              <li>Discuss offensive and defensive security techniques for educational purposes.</li>
            </ul>
          </div>
          <div className="p-5 bg-error/5 rounded-2xl border border-error/10 pt-4">
            <h4 className="font-semibold text-error flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-lg">dangerous</span>
              You may not:
            </h4>
            <ul className="list-disc pl-6 space-y-1.5 text-on-surface-variant text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <li>Gain unauthorized access to systems.</li>
              <li>Bypass authentication mechanisms.</li>
              <li>Circumvent security controls.</li>
              <li>Access unauthorized databases or logs.</li>
              <li>Interfere with Service availability.</li>
              <li>Conduct denial-of-service attacks.</li>
              <li>Deploy malware or malicious code.</li>
              <li>Steal credentials or harvest info.</li>
              <li>Perform automated abuse / scraping.</li>
              <li>Attempt prompt or model extraction.</li>
              <li>Extract source code.</li>
              <li>Reverse engineer systems.</li>
              <li>Exploit vulnerabilities.</li>
              <li>Perform unauthorized pen testing.</li>
              <li>Upload viruses.</li>
              <li>Impersonate others or engage in fraud.</li>
              <li>Violate intellectual property rights.</li>
              <li>Use the Service for illegal activities.</li>
            </ul>
          </div>
          <p className="mt-4 text-on-surface-variant/80 italic text-sm">Any attempt to exploit vulnerabilities, bypass restrictions, obtain unauthorized information, access databases, compromise infrastructure, escalate privileges, access other users' accounts, extract proprietary information, manipulate service behavior, evade usage controls, or otherwise attack the Service is strictly prohibited.</p>
        </div>
      )
    },
    {
      id: "security",
      title: "6. Security and Monitoring",
      icon: "security",
      content: (
        <div className="space-y-4">
          <p>To protect users and systems, we may:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Monitor usage and log activities.</li>
            <li>Detect abuse and analyze traffic.</li>
            <li>Investigate suspicious behavior.</li>
            <li>Restrict access or suspend accounts.</li>
            <li>Preserve evidence and cooperate with law enforcement.</li>
          </ul>
          <p>We reserve the right to immediately suspend or terminate accounts engaged in suspicious, abusive, unauthorized, or harmful activities.</p>
          <p>Users have no expectation of unrestricted access to any internal systems, infrastructure, databases, logs, models, prompts, configurations, security mechanisms, or proprietary assets.</p>
        </div>
      )
    },
    {
      id: "accounts",
      title: "7. Accounts and Credentials",
      icon: "account_circle",
      content: (
        <div className="space-y-4">
          <p>Users are responsible for:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Maintaining credential confidentiality.</li>
            <li>Securing devices.</li>
            <li>Preventing unauthorized account access.</li>
            <li>Monitoring account activity.</li>
          </ul>
          <p>You are responsible for all activities occurring under your account.</p>
          <p>You must notify us immediately upon becoming aware of any unauthorized access.</p>
        </div>
      )
    },
    {
      id: "user-content",
      title: "8. User Content",
      icon: "chat",
      content: (
        <div className="space-y-4">
          <p>You retain ownership of content you submit where permitted by law.</p>
          <p>By submitting content, prompts, files, documents, messages, feedback, or materials, you grant us a worldwide, non-exclusive, royalty-free license to host, process, analyze, store, reproduce, modify, display, and use such content as necessary to operate, improve, secure, develop, and provide the Service.</p>
          <p>You represent that you possess all rights necessary to submit such content.</p>
          <p>You must not upload content that is unlawful, infringes intellectual property, contains malware, violates privacy, or contains harmful material.</p>
        </div>
      )
    },
    {
      id: "data-collection",
      title: "9. Data Collection and Service Improvement",
      icon: "database",
      content: (
        <div className="space-y-4">
          <p>By using the Service, you acknowledge and agree that we may collect, process, analyze, store, and use information including:</p>
          <ul className="list-disc pl-6 space-y-1 text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <li>Account information</li>
            <li>Usage data and metrics</li>
            <li>Device information</li>
            <li>Interaction logs</li>
            <li>Educational progress</li>
            <li>Diagnostic info & error reports</li>
            <li>AI interaction history</li>
            <li>Feedback and analytics</li>
          </ul>
          <p className="mt-2">Such information may be used to operate the Service, improve platform quality, train AI models, improve educational outcomes, enhance security, detect abuse, and conduct research.</p>
          <p>Data may be aggregated, anonymized, or de-identified for analytics, research, training, testing, and service improvement purposes where permitted by law.</p>
        </div>
      )
    },
    {
      id: "intellectual-property",
      title: "10. Intellectual Property",
      icon: "copyright",
      content: (
        <div className="space-y-4">
          <p>All rights, title, and interest in the Service remain the exclusive property of guiEDTeach and its licensors. This includes:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <li>Software and algorithms</li>
            <li>AI Models and prompts</li>
            <li>User interfaces and designs</li>
            <li>Branding and logos</li>
            <li>Educational systems and databases</li>
            <li>Documentation and content</li>
          </ul>
          <p className="mt-2">No ownership rights are transferred to users.</p>
        </div>
      )
    },
    {
      id: "third-party",
      title: "11. Third-Party Services",
      icon: "link",
      content: (
        <div className="space-y-4">
          <p>The Service may integrate with third-party providers. We are not responsible for third-party availability, content, security practices, or services.</p>
          <p>Use of third-party services may be governed by separate terms.</p>
        </div>
      )
    },
    {
      id: "availability",
      title: "12. Service Availability",
      icon: "cloud_done",
      content: (
        <div className="space-y-4">
          <p>We do not guarantee continuous uptime, error-free operation, uninterrupted access, permanent feature availability, or device compatibility.</p>
          <p>Maintenance, upgrades, outages, security events, and technical issues may affect availability.</p>
        </div>
      )
    },
    {
      id: "suspension",
      title: "13. Suspension and Termination",
      icon: "block",
      content: (
        <div className="space-y-4">
          <p>We may suspend, restrict, investigate, or terminate access at any time if we believe a user violates these Terms, creates security risks, harms others, misuses the Service, or engages in prohibited conduct.</p>
          <p>Termination may occur without prior notice where reasonably necessary.</p>
        </div>
      )
    },
    {
      id: "indemnification",
      title: "14. Indemnification",
      icon: "policy",
      content: (
        <div className="space-y-4">
          <p>You agree to defend, indemnify, and hold harmless guiEDTeach, its owners, officers, employees, contractors, affiliates, licensors, and partners from claims, liabilities, damages, losses, costs, and expenses arising from:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your use of the Service.</li>
            <li>Your violation of these Terms.</li>
            <li>Your violation of applicable law.</li>
            <li>Your infringement of rights belonging to others.</li>
          </ul>
        </div>
      )
    },
    {
      id: "disclaimer-warranties",
      title: "15. Disclaimer of Warranties",
      icon: "gpp_maybe",
      content: (
        <div className="space-y-4 text-on-surface-variant font-mono text-sm bg-surface-container/50 backdrop-blur-md p-6 rounded-2xl border border-outline-variant/30">
          <p className="font-semibold text-error">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE."</p>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, INCLUDING:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>MERCHANTABILITY</li>
            <li>FITNESS FOR A PARTICULAR PURPOSE</li>
            <li>NON-INFRINGEMENT</li>
            <li>ACCURACY</li>
            <li>RELIABILITY</li>
            <li>AVAILABILITY</li>
          </ul>
          <p className="mt-4">USE OF THE SERVICE IS AT YOUR OWN RISK.</p>
        </div>
      )
    },
    {
      id: "limitation-liability",
      title: "16. Limitation of Liability",
      icon: "limit_click",
      content: (
        <div className="space-y-4 text-on-surface-variant font-mono text-sm bg-surface-container/50 backdrop-blur-md p-6 rounded-2xl border border-outline-variant/30">
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, guiEDTeach SHALL NOT BE LIABLE FOR:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES</li>
            <li>LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL</li>
            <li>BUSINESS INTERRUPTION</li>
          </ul>
          <p className="mt-4">IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT PAID BY THE USER TO USE THE SERVICE DURING THE TWELVE MONTHS PRECEDING THE CLAIM.</p>
        </div>
      )
    },
    {
      id: "changes-terms",
      title: "17. Changes to Terms",
      icon: "edit_note",
      content: (
        <div className="space-y-4">
          <p>We may update these Terms periodically. Updated Terms become effective upon publication or as otherwise communicated.</p>
          <p>Continued use of the Service after updates constitutes acceptance of the revised Terms.</p>
        </div>
      )
    },
    {
      id: "governing-law",
      title: "18. Governing Law",
      icon: "balance",
      content: (
        <div className="space-y-4">
          <p>These Terms shall be governed by and construed in accordance with applicable laws of the jurisdiction in which guiEDTeach operates, without regard to conflict-of-law principles.</p>
        </div>
      )
    },
    {
      id: "severability",
      title: "19. Severability",
      icon: "grid_view",
      content: (
        <div className="space-y-4">
          <p>If any provision is found unenforceable, the remaining provisions shall remain in full force and effect.</p>
        </div>
      )
    },
    {
      id: "entire-agreement",
      title: "20. Entire Agreement",
      icon: "fact_check",
      content: (
        <div className="space-y-4">
          <p>These Terms constitute the entire agreement between you and guiEDTeach regarding the Service and supersede all prior agreements, communications, and understandings.</p>
        </div>
      )
    },
    {
      id: "contact",
      title: "21. Contact",
      icon: "mail",
      content: (
        <div className="space-y-4">
          <p>For legal inquiries, notices, or questions regarding these Terms:</p>
          <div className="p-4 bg-primary-container/20 rounded-2xl border border-primary-container/30 inline-flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl">contact_mail</span>
            <div>
              <p className="text-xs text-on-surface-variant font-medium">Legal Department Email</p>
              <a href="mailto:social@exortic.com" className="text-secondary hover:text-primary transition-colors font-bold underline">
                social@exortic.com
              </a>
            </div>
          </div>
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
      <title>Terms of Service | guiEDTeach</title>
      {/* Dynamic Glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[0]">
        <div className="absolute top-[-10%] left-[-15%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] animate-[pulse_10s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-[-10%] right-[-15%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-[120px] animate-[pulse_12s_ease-in-out_infinite]"></div>
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
                Terms of Service
              </h1>
              <p className="text-on-surface-variant/80 font-medium">Last Updated: June 2026</p>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-high/60 border border-outline-variant/30 px-4 py-2.5 rounded-2xl w-fit text-sm font-semibold text-on-surface-variant">
              <span className="material-symbols-outlined text-secondary text-lg">menu_book</span>
              <span>8 min read</span>
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
                  placeholder="Filter sections..."
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

              <h3 className="text-xs font-bold text-secondary uppercase tracking-widest mb-4 px-2">Table of Contents</h3>
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

            {/* Quick Support Callout */}
            <div className="bg-primary-container/20 border border-primary-container/30 rounded-3xl p-6 shadow-md">
              <h4 className="font-semibold text-on-surface mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">help</span>
                Need Clarification?
              </h4>
              <p className="text-xs text-on-surface-variant/90 leading-relaxed mb-4">
                If you have questions about these terms or our educational operations, please get in touch with us.
              </p>
              <Link href="mailto:social@exortic.com" className="inline-flex items-center gap-2 text-xs font-bold text-secondary hover:underline">
                Contact Legal Department
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </Link>
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
