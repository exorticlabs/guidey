"use client";

import { useState } from "react";

interface ExplanationPanelProps {
  title: string;
  content: string;
}

export default function ExplanationPanel({ title, content }: ExplanationPanelProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="w-full my-4 border border-secondary/30 rounded-xl overflow-hidden bg-surface shadow-sm transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-secondary/10 hover:bg-secondary/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">lightbulb</span>
          <span className="font-medium text-sm text-primary">{title}</span>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>
      
      <div 
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="p-4 text-sm text-on-surface leading-relaxed border-t border-secondary/10">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
