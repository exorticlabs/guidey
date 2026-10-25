"use client";

import { useState } from "react";

interface Step {
  name: string;
  detail: string;
}

interface ConceptBreakdownProps {
  title: string;
  steps: Step[];
}

export default function ConceptBreakdown({ title, steps }: ConceptBreakdownProps) {
  const [activeStep, setActiveStep] = useState<number>(0);

  return (
    <div className="w-full my-4 border border-outline-variant rounded-xl overflow-hidden bg-surface shadow-sm">
      <div className="bg-surface-container-lowest border-b border-outline-variant px-4 py-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
        <span className="font-medium text-sm text-primary">{title}</span>
      </div>
      
      <div className="flex flex-col md:flex-row">
        {/* Step list */}
        <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-outline-variant bg-surface-container-lowest/50">
          {steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setActiveStep(index)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors border-l-2 flex items-center gap-2 ${
                activeStep === index 
                  ? "border-secondary bg-secondary/5 text-primary font-medium" 
                  : "border-transparent text-on-surface-variant hover:bg-surface-variant/50"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                activeStep === index ? "bg-secondary text-white" : "bg-outline-variant text-surface"
              }`}>
                {index + 1}
              </div>
              <span className="truncate">{step.name}</span>
            </button>
          ))}
        </div>
        
        {/* Step detail */}
        <div className="md:w-2/3 p-4 min-h-[120px] flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-300">
          <h4 className="font-medium text-primary text-sm mb-2">{steps[activeStep]?.name}</h4>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {steps[activeStep]?.detail}
          </p>
        </div>
      </div>
    </div>
  );
}
