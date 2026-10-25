"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { API_URL } from "@/utils/api";

type SearchResult = {
  subjects: Array<{
    type: string;
    id: number;
    name: string;
    code: string;
    tag: string;
  }>;
  topics: Array<{
    type: string;
    id: number;
    name: string;
    subject_name: string;
    subject_id: number;
  }>;
};

export default function GlobalSearchInput() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (input.trim().length < 2) {
      setResults(null);
      setShowResults(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(
        `${API_URL}/api/search?q=${encodeURIComponent(input.trim())}`
      )
        .then((r) => r.json())
        .then((data) => {
          setResults(data);
          setShowResults(true);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const hasResults =
    results &&
    ((results.subjects?.length ?? 0) > 0 || (results.topics?.length ?? 0) > 0);

  return (
    <div className="relative w-full min-w-[250px] lg:min-w-[400px]" ref={containerRef}>
      <div className="relative flex items-center w-full bg-surface-container-lowest border border-outline-variant rounded-full focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary transition-all">
        <span className="material-symbols-outlined absolute left-3 text-on-surface-variant">
          search
        </span>
        <input
          id="global-search"
          className="w-full bg-transparent border-none py-2 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:ring-0 rounded-full h-10 outline-none"
          placeholder="Search anything..."
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => {
            if (results) setShowResults(true);
          }}
        />
      </div>
      {showResults && (
        <div className="absolute top-12 left-0 right-0 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
          {!hasResults ? (
            <div className="p-4 text-center text-on-surface-variant font-body-md text-sm">
              No results for &quot;{input}&quot;
            </div>
          ) : (
            <>
              {results!.subjects.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Subjects
                  </div>
                  {results!.subjects.map((s) => (
                    <Link
                      key={`s-${s.id}`}
                      href={`/subject/${s.id}`}
                      onClick={() => {
                        setShowResults(false);
                        setInput("");
                      }}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-secondary text-sm">
                        menu_book
                      </span>
                      <div>
                        <p className="font-body-md text-sm text-primary">
                          {s.name}
                        </p>
                        <p className="font-label-sm text-label-sm text-outline">
                          {s.code} · {s.tag}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {results!.topics.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-1 font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Topics
                  </div>
                  {results!.topics.map((t) => (
                    <Link
                      key={`t-${t.id}`}
                      href={`/tutor?new=1&topic_id=${t.id}`}
                      onClick={() => {
                        setShowResults(false);
                        setInput("");
                      }}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-secondary text-sm">
                        topic
                      </span>
                      <div>
                        <p className="font-body-md text-sm text-primary">
                          {t.name}
                        </p>
                        <p className="font-label-sm text-label-sm text-outline">
                          {t.subject_name}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
