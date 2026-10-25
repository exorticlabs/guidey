"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { useEffect } from "react";

export default function OrganisationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !["admin", "clg"].includes(user.role || ""))) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  if (loading || !user || !["admin", "clg"].includes(user.role || "")) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-on-background">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">refresh</span>
          <p className="text-sm font-medium">Checking authorization...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { name: "Overview", href: "/organisation" },
    { name: "Subjects", href: "/organisation/subjects" },
    { name: "Students", href: "/organisation/students" },
    { name: "Staff", href: "/organisation/staff" },
    { name: "Announcements", href: "/organisation/announcements" },
    { name: "Settings", href: "/organisation/settings" }
  ];

  return (
    <div className="bg-background text-on-background pb-24 lg:pb-8 h-full overflow-y-auto">
      {/* Organisation Sub Navigation Tabs */}
      <nav aria-label="Organisation Sub Navigation" className="bg-surface/95 backdrop-blur-md w-full border-b border-outline-variant/80 mb-6">
        <div className="px-container-margin lg:px-8 flex gap-6 overflow-x-auto no-scrollbar pt-2">
          {tabs.map(tab => {
            const isActive = tab.href === "/organisation" ? pathname === "/organisation" : pathname.startsWith(tab.href);
            return (
              <Link 
                key={tab.name}
                href={tab.href} 
                className={`pb-3 px-1 font-label-lg text-label-lg whitespace-nowrap border-b-2 transition-colors duration-200 ${
                  isActive 
                    ? "border-secondary text-secondary font-bold" 
                    : "border-transparent text-on-surface-variant hover:text-primary hover:border-outline"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </nav>
      
      <div className="px-container-margin lg:px-8 max-w-screen-xl mx-auto">
        {children}
      </div>
    </div>
  );
}
