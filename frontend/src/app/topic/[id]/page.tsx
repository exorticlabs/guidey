"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/utils/api";

export default function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [topic, setTopic] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetchWithAuth(`/api/topics/${id}`);
        if (res.ok) {
          setTopic(await res.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  if (!topic) return <div className="p-4">Topic not found.</div>;

  return (
    <div className="bg-background text-on-background font-body-md text-body-md antialiased pb-24 lg:pb-8 h-full">
      <main className="px-container-margin lg:px-8 pt-4 sm:pt-6 flex flex-col gap-6 max-w-screen-xl mx-auto">
        {/* Topic Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href={topic.subject_id ? `/subject/${topic.subject_id}` : "/subjects"}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-outline-variant/60 hover:bg-surface-container transition-colors text-on-surface"
              title="Back"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </Link>
            <div className="flex flex-col">
              <h1 className="font-headline-sm text-lg sm:text-xl font-bold text-primary tracking-tight leading-tight">
                {topic.name}
              </h1>
              <span className="font-label-sm text-xs text-on-surface-variant uppercase">
                {topic.subject_name}
              </span>
            </div>
          </div>
          <div className="relative w-10 h-10 flex items-center justify-center self-end sm:self-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface-variant"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              ></path>
              <path
                className="text-tertiary-fixed-dim"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${topic.mastery_level || 0}, 100`}
                strokeLinecap="round"
                strokeWidth="4"
              ></path>
            </svg>
            <span className="absolute font-label-sm text-label-sm text-primary text-[10px]">
              {Math.round(topic.mastery_level || 0)}%
            </span>
          </div>
        </div>
        <section className="flex flex-wrap gap-xs">
          <Link
            href={`/tutor?new=1&topic_id=${id}&prompt=${encodeURIComponent(`I want to practice ${topic.name}`)}`}
            className="flex-1 bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg flex items-center justify-center gap-base shadow-[0_4px_12px_rgba(15,23,42,0.05)] active:scale-95 transition-transform hover:bg-primary/90"
          >
            <span className="material-symbols-outlined icon-fill">
              play_arrow
            </span>
            Start Practice
          </Link>
          <Link
            href={`/tutor?new=1&topic_id=${id}`}
            className="flex-1 border border-outline text-primary font-label-md text-label-md px-md py-sm rounded-lg flex items-center justify-center gap-base hover:bg-surface-container-low active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">psychology</span>
            Ask AI Tutor
          </Link>
        </section>

        <div className="lg:grid lg:grid-cols-3 lg:gap-lg">
          <div className="lg:col-span-2 flex flex-col gap-lg">
            {/* Resources list */}
            <section className="flex flex-col gap-md">
              <h3 className="font-headline-sm text-headline-sm text-primary">
                Learning Resources
              </h3>
              <div className="flex flex-col gap-sm">
                {topic.resources?.map((res: any) => (
                  <a
                    key={res.id}
                    href={res.url}
                    className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex items-start justify-between hover:shadow-md hover:border-secondary/50 transition-all group"
                  >
                    <div className="flex items-start gap-md">
                      <div className={`p-2 rounded-lg flex items-center justify-center ${
                        res.type === 'video' ? 'bg-error-container/20 text-error' :
                        res.type === 'article' ? 'bg-secondary/10 text-secondary' :
                        'bg-tertiary-container/30 text-tertiary-fixed-dim'
                      }`}>
                        <span className="material-symbols-outlined">
                          {res.type === 'video' ? 'play_circle' :
                           res.type === 'article' ? 'article' : 'quiz'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-body-lg text-body-lg text-primary font-medium group-hover:text-secondary transition-colors">
                          {res.title}
                        </h4>
                        <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                          {res.type} • {res.duration || res.read_time || `${res.questions} questions`}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                      open_in_new
                    </span>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-lg mt-lg lg:mt-0">
            {/* Mini-concept Map */}
            <section className="flex flex-col gap-md">
              <h3 className="font-headline-sm text-headline-sm text-primary">
                Topic Map
              </h3>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
                <div className="flex flex-col items-center gap-4 relative">
                  <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-outline-variant -translate-x-1/2 z-0"></div>
                  {topic.mini_concept_map?.map((node: any, idx: number) => (
                    <div key={node.id} className="relative z-10 w-full flex justify-center">
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm w-full max-w-[200px] justify-center transition-transform hover:scale-105 ${
                        node.status === 'completed' ? 'bg-tertiary-container/30 border-tertiary-fixed-dim text-primary' :
                        node.status === 'active' ? 'bg-secondary/10 border-secondary text-primary font-medium' :
                        'bg-surface-container border-outline-variant text-on-surface-variant'
                      }`}>
                        <span className={`material-symbols-outlined text-[16px] ${
                          node.status === 'completed' ? 'text-tertiary-fixed-dim' :
                          node.status === 'active' ? 'text-secondary' : 'text-on-surface-variant'
                        }`}>
                          {node.status === 'completed' ? 'check_circle' : node.status === 'active' ? 'play_circle' : 'lock'}
                        </span>
                        <span className="text-sm truncate">{node.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Topic Prerequisites */}
            {topic.prerequisites && topic.prerequisites.length > 0 && (
              <section className="flex flex-col gap-sm bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
                <div className="flex items-center gap-sm text-primary mb-2">
                  <span className="material-symbols-outlined text-secondary">account_tree</span>
                  <h3 className="font-headline-sm text-headline-sm">Required Knowledge</h3>
                </div>
                <div className="flex flex-col gap-xs">
                  {topic.prerequisites.map((req: any) => (
                    <div key={req.id} className="flex items-center justify-between p-sm rounded-lg bg-surface-container/50 border border-outline-variant/50">
                      <span className="font-body-md text-body-md text-primary">
                        {req.name}
                      </span>
                      <span className="material-symbols-outlined text-tertiary-fixed-dim text-[20px]">
                        {req.status === 'completed' ? 'check_circle' : 'circle'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
