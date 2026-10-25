"use client";

import Link from "next/link";

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

export default function AuthGateModal({ isOpen, onClose, title, description }: AuthGateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <div className="relative bg-surface border border-outline-variant rounded-3xl max-w-2xl w-full p-8 shadow-2xl animate-in zoom-in-95 duration-200 z-10 text-center flex flex-col items-center">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {/* Locked Lock Icon */}
        <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-6 border border-secondary/20 shadow-inner">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>

        {/* Content */}
        <h2 className="font-display-lg text-2xl font-bold text-primary mb-3">
          {title}
        </h2>
        <p className="font-body-md text-sm text-on-surface-variant mb-8 leading-relaxed">
          {description}
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <Link 
            href="/signup" 
            className="w-full py-3.5 bg-primary text-on-primary rounded-full font-bold hover:shadow-lg transition-all text-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            Create Free Account
          </Link>
          <Link 
            href="/login" 
            className="w-full py-3.5 border border-outline text-primary rounded-full font-bold hover:bg-surface-container-low transition-all text-sm active:scale-98"
          >
            Sign In
          </Link>
          <button 
            onClick={onClose}
            className="w-full py-2.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors mt-2"
          >
            Continue browsing as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
