"use client";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/SidebarContext";

export default function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isDesktopSidebarOpen } = useSidebar();
  const PUBLIC_ROUTES = ["/", "/login", "/signup", "/privacy", "/terms", "/contact", "/pricing"];
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  return (
    <div
      className={`flex-1 flex flex-col min-w-0 w-full transition-[padding] duration-300 ease-in-out ${
        isPublic ? "" : isDesktopSidebarOpen ? "lg:pl-72" : "lg:pl-0"
      }`}
    >
      {children}
    </div>
  );
}

