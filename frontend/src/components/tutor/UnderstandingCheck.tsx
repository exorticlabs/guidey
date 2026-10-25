"use client";

import { useState } from "react";

interface UnderstandingCheckProps {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  onSubmit?: (selectedIndex: number, isCorrect: boolean) => void;
}

export default function UnderstandingCheck({ question, options, correctIndex, explanation, onSubmit }: UnderstandingCheckProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isCorrect = selected === correctIndex;

  return (
    <div className="w-full my-4 border border-outline-variant rounded-xl overflow-hidden bg-surface shadow-sm max-w-2xl">
      <div className="bg-primary/5 border-b border-outline-variant px-4 py-3 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary mt-0.5 flex-shrink-0">quiz</span>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm text-primary mb-1">Knowledge Check</h4>
          <p className="text-sm text-on-surface break-words whitespace-normal">{question}</p>
        </div>
      </div>
      
      <div className="p-4 space-y-2">
        {options.map((opt, idx) => {
          let btnClass = "border-outline-variant hover:border-primary hover:bg-surface-variant/50 text-on-surface";
          
          if (submitted) {
            if (idx === correctIndex) {
              btnClass = "border-green-500 bg-green-50 text-green-900"; // success
            } else if (idx === selected) {
              btnClass = "border-error bg-error/10 text-error"; // error
            } else {
              btnClass = "border-outline-variant/50 text-on-surface-variant/50 opacity-50"; // muted
            }
          } else if (selected === idx) {
            btnClass = "border-secondary bg-secondary/5 text-primary";
          }

          return (
            <button
              key={idx}
              onClick={() => !submitted && setSelected(idx)}
              disabled={submitted}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all duration-200 flex items-center justify-between gap-3 ${btnClass}`}
            >
              <span className="flex-1 min-w-0 break-words whitespace-normal">{opt}</span>
              {submitted && idx === correctIndex && (
                <span className="material-symbols-outlined text-green-600 flex-shrink-0">check_circle</span>
              )}
              {submitted && idx === selected && idx !== correctIndex && (
                <span className="material-symbols-outlined text-error flex-shrink-0">cancel</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-3 bg-surface-container-lowest border-t border-outline-variant flex flex-col gap-3">
        {!submitted ? (
          <div className="flex justify-end">
            <button
              onClick={() => {
                setSubmitted(true);
                window.dispatchEvent(new CustomEvent("quiz_submitted", {
                  detail: {
                    selectedIndex: selected,
                    correctIndex: correctIndex,
                    isCorrect: selected === correctIndex,
                    question,
                    explanation
                  }
                }));
                if (onSubmit) {
                  onSubmit(selected!, selected === correctIndex);
                }
              }}
              disabled={selected === null}
              className="px-4 py-1.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Answer
            </button>
          </div>
        ) : (
          <div className={`p-3 rounded-lg text-sm ${isCorrect ? "bg-green-50 text-green-900" : "bg-error/10 text-error-800"} flex gap-3 animate-in fade-in slide-in-from-bottom-2`}>
            <span className="material-symbols-outlined shrink-0 mt-0.5">
              {isCorrect ? "verified" : "info"}
            </span>
            <div>
              <p className="font-medium mb-1">
                {isCorrect ? "Correct!" : "Not quite right."}
              </p>
              <p className="opacity-90 leading-relaxed">{explanation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
