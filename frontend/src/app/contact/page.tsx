import PublicFooter from "@/components/PublicFooter";
import Link from "next/link";

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-background text-on-background selection:bg-secondary/30 relative overflow-hidden font-body-md flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[0]">
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/10 blur-[150px] animate-[pulse_10s_ease-in-out_infinite_reverse]"></div>
      </div>

      <main className="flex-1 relative z-10 pt-24 pb-20 px-6 max-w-5xl mx-auto w-full">
        <div className="mb-12 text-center md:text-left">
          <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-secondary transition-colors text-sm font-medium mb-8">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-6xl font-headline-md font-extrabold tracking-tight text-on-surface mb-6">
            Get in touch.
          </h1>
          <p className="text-xl text-on-surface-variant max-w-2xl leading-relaxed">
            Whether you are looking to deploy our AI Tutor across your campus, or just want to learn more about our Socratic execution engine, we're here to help.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mt-16">
          {/* Contact Methods */}
          <div className="space-y-8">
            <div className="bg-surface/50 backdrop-blur-md p-8 rounded-3xl border border-outline-variant/30 hover:border-secondary/30 transition-colors shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-2xl text-primary">storefront</span>
              </div>
              <h3 className="text-2xl font-bold text-on-surface mb-2">Enterprise Sales</h3>
              <p className="text-on-surface-variant mb-6 leading-relaxed">
                Interested in custom integrations, dedicated AI models, or campus-wide deployment? Speak directly with our sales team.
              </p>
              <a href="mailto:social@exortic.com" className="inline-flex items-center gap-2 text-secondary font-medium hover:text-primary transition-colors text-lg">
                social@exortic.com
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>

            <div className="bg-surface/50 backdrop-blur-md p-8 rounded-3xl border border-outline-variant/30 hover:border-secondary/30 transition-colors shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-2xl text-primary">support_agent</span>
              </div>
              <h3 className="text-2xl font-bold text-on-surface mb-2">Technical Support</h3>
              <p className="text-on-surface-variant mb-6 leading-relaxed">
                Existing partners can reach our engineering support team 24/7 for critical deployment assistance.
              </p>
              <a href="mailto:social@exortic.com" className="inline-flex items-center gap-2 text-secondary font-medium hover:text-primary transition-colors text-lg">
                social@exortic.com
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </a>
            </div>
          </div>

          {/* Location & Info */}
          <div className="bg-gradient-to-br from-primary to-secondary p-1 rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-surface h-full w-full rounded-[1.4rem] p-10 flex flex-col justify-between">
              <div>
                <h3 className="text-3xl font-bold text-on-surface mb-8">Headquarters</h3>
                <div className="flex items-start gap-4 mb-8">
                  <span className="material-symbols-outlined text-primary text-2xl mt-1">location_on</span>
                  <div>
                    <p className="text-lg font-medium text-on-surface mb-1">India</p>
                    <p className="text-on-surface-variant leading-relaxed">
                      Hyderabad,
                      Telangana
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pt-8 border-t border-outline-variant/30 mt-auto">
                <p className="text-sm text-on-surface-variant italic">
                  Note: For security reasons, on-site campus visits require prior arrangement with our sales team.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
