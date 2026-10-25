import Link from "next/link";
import Image from "next/image";

export default function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-outline-variant/30 py-16 bg-surface-container-lowest text-on-surface-variant text-sm mt-auto">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
        
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <Image src="/logo.png" alt="Exortic AI" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            <span className="font-display-lg text-xl tracking-tight font-bold text-primary">
              Exortic <span className="text-secondary">AI</span>
            </span>
          </div>
          <p className="text-sm text-on-surface-variant/80 mb-6 leading-relaxed">
            The intelligent AI Operating System designed to scale Socratic tutoring and curriculum mastery across modern institutions.
          </p>
          <p className="text-xs text-on-surface-variant/60">
            © {new Date().getFullYear()} Exortic AI. All rights reserved.
          </p>
        </div>

        {/* Links Column 1 */}
        <div className="md:col-span-1">
          <h4 className="font-bold text-on-surface mb-6 uppercase tracking-wider text-xs">Platform</h4>
          <ul className="space-y-4">
            <li>
              <Link href="/#features" className="hover:text-primary transition-colors">Features</Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-primary transition-colors">Pricing Plans</Link>
            </li>
            <li>
              <a href="mailto:social@exortic.com" className="hover:text-primary transition-colors">Enterprise Sales</a>
            </li>
            <li>
              <Link href="/login" className="hover:text-primary transition-colors">Portal Login</Link>
            </li>
          </ul>
        </div>

        {/* Legal Column */}
        <div className="md:col-span-1">
          <h4 className="font-bold text-on-surface mb-6 uppercase tracking-wider text-xs">Legal</h4>
          <ul className="space-y-4">
            <li>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-primary transition-colors">Contact Us</Link>
            </li>
          </ul>
        </div>

        {/* Contact Column */}
        <div className="md:col-span-1">
          <h4 className="font-bold text-on-surface mb-6 uppercase tracking-wider text-xs">Contact</h4>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-lg text-primary">mail</span>
              <a href="mailto:social@exortic.com" className="hover:text-primary transition-colors break-all">
                social@exortic.com
              </a>
            </li>
            {/* <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-lg text-primary">location_on</span>
              <span>San Francisco, CA<br/>United States</span>
            </li> */}
          </ul>
        </div>

      </div>
    </footer>
  );
}
