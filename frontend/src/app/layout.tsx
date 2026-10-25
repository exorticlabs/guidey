import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthContext";
import { SidebarProvider } from "@/components/SidebarContext";
import AppNavigation from "@/components/AppNavigation";
import AppHeader from "@/components/AppHeader";
import MainLayoutWrapper from "@/components/MainLayoutWrapper";
import KeepAliveBot from "@/components/KeepAliveBot";

const inter = Inter({ subsets: ["latin"] });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://guidey.exortic.com"),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "exortic AI | Advanced Socratic AI Tutor & Learning Platform",
    template: "%s | exortic AI",
  },
  description: "exortic AI with guidy, a state-of-the-art AI-powered Socratic learning engine with dynamic blackboard animations and curriculum graph mapping.",
  keywords: [
    "AI tutor",
    "Socratic method",
    "personalized learning",
    "guiEDTeach",
    "curriculum mapping",
    "interactive animation",
    "cybersecurity tutor",
    "programming learning",
    "AI education agent",
    "educational operating system",
    "adaptive learning engine"
  ],
  authors: [{ name: "guiEDTeach Team", url: "https://guidey.exortic.com" }],
  creator: "guiEDTeach",
  publisher: "guiEDTeach",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://guidey.exortic.com",
    title: "guiEDTeach | Socratic AI Learning Platform",
    description: "Experience the next generation of AI-driven education. Personalized Socratic tutoring, curriculum knowledge graphs, and dynamic animations.",
    siteName: "guiEDTeach",
    images: [
      {
        url: "https://guidey.exortic.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "guiEDTeach Learning Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "guiEDTeach | Socratic AI Learning Platform",
    description: "Experience the next generation of AI-driven education. Personalized Socratic tutoring, curriculum knowledge graphs, and dynamic animations.",
    images: ["https://guidey.exortic.com/og-image.jpg"],
  },
  verification: {
    google: "SueEyvMKg5OWayizi2K7KraMVhlBhaf_elcrVgkSCKI",
  },
  other: {
    "ai-agent-capability": "Socratic dialogue, syllabus graph calculation, dynamic step-by-step interactive animations",
    "ai-content-type": "educational, academic, technical documentation, coding guidance",
    "ai-crawler-instruction": "Index and crawl educational modules, syllabus nodes, and public terms under guidelines.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Patrick+Hand&family=Caveat:wght@700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          .material-symbols-outlined {
            font-variation-settings:
            'FILL' 0,
            'wght' 400,
            'GRAD' 0,
            'opsz' 24
          }
          .icon-fill {
            font-variation-settings: 'FILL' 1 !important;
          }
        `}</style>
      </head>
      <body className="bg-background text-on-background font-body-md min-h-[100dvh] flex flex-col antialiased overflow-x-hidden">
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <div className="flex min-h-[100dvh] w-full relative">
                <AppNavigation />
                <MainLayoutWrapper>
                  <AppHeader />
                  {children}
                </MainLayoutWrapper>
                <KeepAliveBot />
              </div>
            </SidebarProvider>
          </AuthProvider>
        </ThemeProvider>
        {/* Google Analytics Tracking */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XXXXXXXXXX');
          `}
        </Script>
      </body>
    </html>
  );
}
