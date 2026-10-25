"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/utils/api";

export default function SubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [detailsRes, syllabusRes, weaknessesRes, nextRecRes, prereqRes] = await Promise.all([
          fetchWithAuth(`/api/subjects/${id}/details`),
          fetchWithAuth(`/api/subjects/${id}/syllabus`),
          fetchWithAuth(`/api/subjects/${id}/weaknesses`),
          fetchWithAuth(`/api/subjects/${id}/next`),
          fetchWithAuth(`/api/subjects/${id}/prerequisites`)
        ]);

        if (detailsRes.status === 403 || syllabusRes.status === 403) {
          setError("Access Denied. You are not assigned to this subject.");
          setLoading(false);
          return;
        }
        if (detailsRes.status === 404) {
          setError("Subject not found.");
          setLoading(false);
          return;
        }

        if (detailsRes.ok) {
          const syllabus = await syllabusRes.json();
          setData({
            details: await detailsRes.json(),
            syllabus,
            weaknesses: await weaknessesRes.json(),
            nextRec: await nextRecRes.json(),
            prerequisites: await prereqRes.json()
          });
          
          const initialExpanded: Record<number, boolean> = {};
          syllabus.forEach((u: any) => {
            if (u.status === 'active' || u.status === 'completed') initialExpanded[u.id] = true;
          });
          setExpandedUnits(initialExpanded);
        } else {
          setError("Failed to load subject details.");
        }
      } catch (e) {
        console.error(e);
        setError("An error occurred while loading this page.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const toggleUnit = (unitId: number) => {
    setExpandedUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const handleShareSubject = async () => {
    setSharing(true);
    try {
      const res = await fetchWithAuth(`/api/subjects/${id}/share`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setShareCode(data.share_code);
        setShowShareModal(true);
      } else {
        alert("Failed to generate share code.");
      }
    } catch {
      alert("Error sharing subject.");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-on-background px-4 text-center">
        <span className="material-symbols-outlined text-error text-6xl mb-4">gpp_bad</span>
        <h1 className="font-headline-sm text-headline-sm text-primary mb-2">Access Restricted</h1>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-6">
          {error}
        </p>
        <Link
          href="/"
          className="bg-primary text-on-primary font-label-md px-6 py-2.5 rounded-full shadow hover:bg-primary/95 transition-all"
        >
          Go Back Home
        </Link>
      </div>
    );
  }

  if (!data || !data.details) return <div className="p-4">Subject not found.</div>;

  const { details, syllabus, weaknesses, nextRec, prerequisites } = data;

  return (
    <div className="bg-background text-on-background font-body-md text-body-md antialiased pb-24 lg:pb-8 flex flex-col min-h-screen">
      <main className="px-container-margin lg:px-8 pt-4 sm:pt-6 flex flex-col gap-6 max-w-screen-xl mx-auto w-full">
        {/* Subject Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <Link
              href="/subjects"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-outline-variant/60 hover:bg-surface-container transition-colors text-on-surface"
              title="Back to Subjects"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </Link>
            <div className="flex flex-col">
              <h1 className="font-headline-sm text-lg sm:text-xl font-bold text-primary tracking-tight leading-tight">
                {details.name}
              </h1>
              <span className="font-label-sm text-xs text-on-surface-variant uppercase">
                {details.code}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto">
            <button
              onClick={handleShareSubject}
              disabled={sharing}
              className="border border-outline hover:bg-surface-container-high text-primary rounded-xl px-3.5 py-1.5 font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {sharing ? (
                <span className="material-symbols-outlined animate-spin text-[16px]">refresh</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">share</span>
              )}
              Share
            </button>
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-variant"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                ></path>
                <path
                  className="text-secondary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${details.progress}, 100`}
                  strokeLinecap="round"
                  strokeWidth="4"
                ></path>
              </svg>
              <span className="absolute font-label-sm text-label-sm text-primary text-[10px]">
                {details.progress}%
              </span>
            </div>
          </div>
        </div>
        {/* Action buttons */}
        <section className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/tutor?new=1&subject_id=${id}&prompt=${encodeURIComponent("I want to resume my learning from where I left off.")}`}
            className="flex-1 bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg flex items-center justify-center gap-base shadow-[0_4px_12px_rgba(15,23,42,0.05)] active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined icon-fill">
              play_arrow
            </span>
            Resume
          </Link>
          <Link
            href={`/tutor?new=1&subject_id=${id}`}
            className="flex-1 border border-outline text-primary font-label-md text-label-md px-md py-sm rounded-lg flex items-center justify-center gap-base hover:bg-surface-container-low active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">psychology</span>
            Ask AI
          </Link>
          <Link 
            href={`/tutor?new=1&subject_id=${id}&prompt=${encodeURIComponent("I want to practice concepts I am weak in.")}`}
            className="flex-1 border border-outline text-primary font-label-md text-label-md px-md py-sm rounded-lg flex items-center justify-center gap-base hover:bg-surface-container-low active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">edit_note</span>
            Practice
          </Link>
        </section>

        {/* Desktop: two column layout */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-lg">
          {/* Left column: syllabus */}
          <div className="lg:col-span-2 flex flex-col gap-lg">
            {/* Active module card */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-bl-[100px] -z-0 pointer-events-none transition-transform group-hover:scale-110"></div>
              <div className="flex justify-between items-start z-10">
                <div className="flex flex-col gap-base">
                  <span className="font-label-sm text-label-sm text-tertiary-fixed-dim uppercase bg-tertiary-container/10 w-max px-2 py-1 rounded">
                    Active Module
                  </span>
                  <h2 className="font-headline-sm text-headline-sm text-primary">
                    {details.active_module}
                  </h2>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    schedule
                  </span>{" "}
                  {details.time}
                </span>
              </div>
              <div className="flex items-center gap-md mt-sm z-10">
                <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
                  <div
                    className="h-full bg-tertiary-fixed-dim rounded-full"
                    style={{ width: `${details.active_module_progress}%` }}
                  ></div>
                </div>
                <span className="font-label-md text-label-md text-primary">{details.active_module_progress}%</span>
              </div>
            </section>

            {/* Syllabus */}
            <section className="flex flex-col gap-md">
              <h3 className="font-headline-sm text-headline-sm text-primary">
                Syllabus
              </h3>
              <div className="flex flex-col gap-xs">
                {syllabus.map((unit: any) => (
                  <div key={unit.id} className={`bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden ${unit.status === 'locked' ? 'opacity-70' : ''}`}>
                    <button 
                      onClick={() => toggleUnit(unit.id)}
                      disabled={unit.status === 'locked'}
                      className="w-full flex items-center justify-between p-md text-left border-b border-outline-variant hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-center gap-sm">
                        {unit.status === 'completed' && (
                          <span className="material-symbols-outlined text-tertiary-fixed-dim">check_circle</span>
                        )}
                        {unit.status === 'active' && (
                          <span className="material-symbols-outlined text-secondary" style={{ transform: "rotate(90deg)" }}>contrast</span>
                        )}
                        {unit.status === 'locked' && (
                          <span className="material-symbols-outlined text-on-surface-variant">lock</span>
                        )}
                        <span className="font-body-lg text-body-lg text-primary font-medium">
                          {unit.name}
                        </span>
                      </div>
                      {unit.status !== 'locked' && (
                        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${expandedUnits[unit.id] ? 'rotate-180' : ''}`}>
                          expand_more
                        </span>
                      )}
                    </button>
                    {expandedUnits[unit.id] && unit.status !== 'locked' && (
                      <div className="p-sm flex flex-col gap-base bg-surface-bright relative">
                        <div className="absolute left-[28px] top-4 bottom-4 w-[1px] bg-outline-variant z-0"></div>
                        {unit.topics?.map((topic: any) => (
                          <div key={topic.id} className={`flex items-center gap-sm p-xs z-10 ${topic.status === 'active' ? 'bg-surface-container-lowest rounded-lg border border-outline-variant shadow-sm ml-6' : ''}`}>
                            {topic.status === 'completed' ? (
                              <>
                                <div className="w-6 h-6 rounded-full bg-tertiary-fixed-dim flex items-center justify-center shadow-sm">
                                  <span className="material-symbols-outlined text-[12px] text-tertiary-container">check</span>
                                </div>
                                <Link href={`/topic/${topic.id}`} className="font-body-md text-body-md text-on-surface line-through decoration-outline-variant hover:text-secondary hover:underline transition-colors flex-1">
                                  {topic.name}
                                </Link>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full bg-secondary ml-2"></div>
                                <Link href={`/topic/${topic.id}`} className="font-body-md text-body-md text-primary font-medium flex-1 hover:text-secondary hover:underline transition-colors">
                                  {topic.name}
                                </Link>
                                <span className="font-label-sm text-label-sm text-secondary bg-secondary/10 px-2 py-1 rounded">
                                  Active
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Prerequisite Map (DAG) */}
            {prerequisites && (
              <section className="flex flex-col gap-md">
                <h3 className="font-headline-sm text-headline-sm text-primary">
                  Subject Knowledge Graph (DAG)
                </h3>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden relative min-h-[400px] shadow-sm">
                  <ForceGraph data={{
                    nodes: prerequisites.nodes?.map((n: any) => ({
                      id: n.id,
                      label: n.name,
                      val: 10,
                      group: n.status === 'completed' ? 3 : n.status === 'active' ? 2 : 1
                    })) || [],
                    links: prerequisites.edges?.map((e: any) => ({
                      source: e.from,
                      target: e.to
                    })) || []
                  }} />
                </div>
              </section>
            )}
          </div>

          {/* Right column: weak areas + recommendation */}
          <div className="flex flex-col gap-md mt-md lg:mt-0">
            {weaknesses.length > 0 && (
              <section className="flex flex-col gap-sm bg-error-container/20 border border-error-container rounded-xl p-md">
                <div className="flex items-center gap-sm text-error">
                  <span className="material-symbols-outlined">warning</span>
                  <h3 className="font-headline-md text-headline-sm">Weak Areas</h3>
                </div>
                <div className="flex flex-col gap-xs">
                  {weaknesses.map((w: any) => (
                    <div key={w.id} className="flex items-center justify-between bg-surface-container-lowest p-sm rounded-lg border border-outline-variant">
                      <span className="font-body-md text-body-md text-primary">
                        {w.concept_name}
                      </span>
                      <Link
                        href={`/tutor?new=1&subject_id=${id}&prompt=${encodeURIComponent(`Help me practice ${w.concept_name}`)}`}
                        className="font-label-sm text-label-sm text-secondary border border-secondary px-2 py-1 rounded hover:bg-secondary/10 transition-colors"
                      >
                        {w.needs_practice ? "Practice" : "Relearn"}
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {nextRec && (
              <section className="flex flex-col gap-sm">
                <h3 className="font-headline-sm text-headline-sm text-primary">
                  Recommended Next
                </h3>
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md flex flex-col gap-sm items-start hover:border-secondary transition-colors cursor-pointer group">
                  <span className="material-symbols-outlined text-tertiary-fixed-dim text-[32px] group-hover:scale-110 transition-transform">
                    account_tree
                  </span>
                  <div>
                    <h4 className="font-body-lg text-body-lg text-primary font-medium">
                      {nextRec.name}
                    </h4>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {nextRec.reason}
                    </p>
                  </div>
                  <button className="mt-xs text-secondary font-label-md text-label-md flex items-center gap-1 group-hover:underline">
                    Start Module{" "}
                    <span className="material-symbols-outlined text-[16px]">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {showShareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-center">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline-sm text-primary font-bold text-lg">Share Subject</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="text-sm text-on-surface-variant mb-4">
              Share this code with other students. They can import this subject with all its units, topics, and curriculum graph settings.
            </p>
            <div className="flex items-center gap-2 bg-surface-container border border-outline-variant rounded-xl p-3 mb-6 justify-center">
              <span className="font-mono text-lg font-bold text-secondary tracking-widest">{shareCode}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareCode);
                  alert("Copied to clipboard!");
                }}
                className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center"
                title="Copy share code"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="w-full bg-primary text-on-primary hover:bg-primary/95 py-2.5 rounded-xl font-semibold transition-all text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable ForceGraph component isolated from mastery page
function ForceGraph({ data }: { data: { nodes: any[], links: any[] } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ w: 800, h: 400 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setDimensions({ w: width, h: height });

    const nodeCount = data.nodes.length;
    const radius = Math.min(width, height) * 0.35;
    const cx = width / 2;
    const cy = height / 2;

    const positionedNodes = data.nodes.map((node, i) => {
      const angle = (i / nodeCount) * 2 * Math.PI;
      const r = radius * (0.6 + Math.random() * 0.4);
      return {
        ...node,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        vx: 0,
        vy: 0
      };
    });

    setNodes(positionedNodes);
    setLinks(data.links);
  }, [data]);

  useEffect(() => {
    if (nodes.length === 0) return;
    
    let animationFrameId: number;
    let currentNodes = [...nodes];
    const { w, h } = dimensions;
    const cx = w / 2;
    const cy = h / 2;

    let alpha = 1.0;

    const tick = () => {
      if (alpha < 0.005) return;
      let moved = false;
      
      currentNodes = currentNodes.map((node) => {
        let fx = (cx - node.x) * 0.005;
        let fy = (cy - node.y) * 0.005;

        currentNodes.forEach((other) => {
          if (other.id !== node.id) {
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 240) {
              const force = (240 - dist) * 0.7 * alpha;
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
          }
        });

        links.forEach(link => {
          if (link.source === node.id || link.target === node.id) {
            const otherId = link.source === node.id ? link.target : link.source;
            const other = currentNodes.find(n => n.id === otherId);
            if (other) {
              const dx = other.x - node.x;
              const dy = other.y - node.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const targetDist = 200;
              const k = 0.02;
              const force = (dist - targetDist) * k * alpha;
              fx += (dx / dist) * force;
              fy += (dy / dist) * force;
            }
          }
        });

        const vx = (node.vx + fx) * 0.6;
        const vy = (node.vy + fy) * 0.6;
        
        if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) moved = true;

        const radius = 8 + (node.val || 5) * 0.6;
        return {
          ...node,
          x: Math.max(radius + 10, Math.min(w - radius - 10, node.x + vx)),
          y: Math.max(radius + 10, Math.min(h - radius - 10, node.y + vy)),
          vx: vx * 0.9,
          vy: vy * 0.9
        };
      });

      setNodes(currentNodes);
      alpha *= 0.98;
      
      if (moved) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [links, dimensions.w, dimensions.h]);

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0">
      <svg className="w-full h-full absolute inset-0">
        {links.map((link, i) => {
          const sourceNode = nodes.find(n => n.id === link.source);
          const targetNode = nodes.find(n => n.id === link.target);
          if (!sourceNode || !targetNode) return null;
          
          const isHighlighted = hoveredNode === sourceNode.id || hoveredNode === targetNode.id;
          
          return (
            <line
              key={i}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke={isHighlighted ? "var(--secondary)" : "var(--outline-variant)"}
              strokeWidth={isHighlighted ? 2 : 1}
              className="transition-colors duration-300"
            />
          );
        })}

        {nodes.map((node) => {
          const isHighlighted = hoveredNode === node.id;
          const isConnected = hoveredNode && links.some(l => 
            (l.source === node.id && l.target === hoveredNode) || 
            (l.target === node.id && l.source === hoveredNode)
          );
          
          const opacity = hoveredNode ? (isHighlighted || isConnected ? 1 : 0.3) : 1;
          const radius = 5 + (node.val || 5) * 0.4;

          return (
            <g 
              key={node.id} 
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer transition-opacity duration-300"
              style={{ opacity }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                r={radius}
                fill={node.group === 1 ? "var(--primary)" : node.group === 3 ? "var(--tertiary-fixed-dim)" : "var(--secondary)"}
                stroke="var(--surface)"
                strokeWidth={2}
                className="transition-transform duration-300 hover:scale-110 drop-shadow-sm"
              />
              <text
                y={radius + 15}

                textAnchor="middle"
                className="text-xs font-medium fill-on-surface select-none pointer-events-none drop-shadow-sm"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
