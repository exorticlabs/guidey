"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AIChatInput({ subjectId }: { subjectId: number }) {
  const [input, setInput] = useState("");
  const router = useRouter();

  const handleSend = () => {
    if (input.trim()) {
      router.push(`/tutor?new=1&subject_id=${subjectId}&prompt=${encodeURIComponent(input)}`);
    } else {
      router.push(`/tutor?new=1&subject_id=${subjectId}`);
    }
  };

  return (
    <div className="relative flex items-center w-full bg-surface border border-outline-variant rounded-md focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-all">
      <input
        className="w-full bg-transparent border-none py-2 px-3 text-body-md text-on-surface placeholder:text-outline focus:ring-0 rounded-md outline-none"
        placeholder="Ask AI anything... e.g., 'Explain Fourier Series'"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
        }}
      />
      <button
        onClick={handleSend}
        className="absolute right-2 text-secondary p-1 hover:bg-secondary-fixed/50 rounded-md transition-colors"
      >
        <span className="material-symbols-outlined">send</span>
      </button>
    </div>
  );
}
