"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TopicSearchInput() {
  const [input, setInput] = useState("");
  const router = useRouter();

  const handleSearch = () => {
    if (input.trim()) {
      router.push(`/tutor?new=1&prompt=${encodeURIComponent(input)}`);
    }
  };

  return (
    <div className="relative flex items-center w-full bg-surface-container-lowest border border-outline-variant rounded-md focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-all mb-3">
      <span className="material-symbols-outlined absolute left-3 text-secondary">
        explore
      </span>
      <input
        className="w-full bg-transparent border-none py-3 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:ring-0 rounded-md outline-none"
        placeholder="Type a topic, skill, or question..."
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
      />
      {input.trim() && (
        <button
          onClick={handleSearch}
          className="absolute right-2 text-secondary p-1 hover:bg-secondary-fixed/50 rounded-md transition-colors"
        >
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      )}
    </div>
  );
}
