"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/utils/api";

export default function OrgSubjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [userRole, setUserRole] = useState<string>("student");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [detailsRes, syllabusRes, prereqRes, profileRes] = await Promise.all([
          fetchWithAuth(`/api/subjects/${id}/details`),
          fetchWithAuth(`/api/subjects/${id}/syllabus`),
          fetchWithAuth(`/api/subjects/${id}/prerequisites`),
          fetchWithAuth(`/api/user/profile`)
        ]);

        if (profileRes.ok) {
           const profile = await profileRes.json();
           if (profile.role) setUserRole(profile.role);
        }

        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          const syllabusData = await syllabusRes.json();
          setData({
            details: detailsData,
            syllabus: syllabusData,
            prerequisites: await prereqRes.json()
          });
        }
        
        if (prereqRes.ok) {
          const prereqData = await prereqRes.json();
          const nodes = prereqData.nodes.map((n: any) => ({
            id: n.id,
            label: n.name,
            val: 10,
            group: n.status === 'completed' ? 3 : n.status === 'active' ? 2 : 1
          }));
          const links = prereqData.edges.map((e: any) => ({
            source: e.from,
            target: e.to
          }));
          setGraphData({ nodes, links });
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
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="material-symbols-outlined animate-spin text-4xl text-secondary">refresh</span>
      </div>
    );
  }

  if (!data || !data.details) return <div className="p-8 text-on-surface-variant text-center">Subject not found.</div>;

  const { details, syllabus } = data;

  return (
    <div className="bg-background min-h-screen text-on-background font-body-md antialiased pb-24 lg:pb-8 flex flex-col">
      <header className="w-full top-0 sticky bg-surface/90 backdrop-blur-md border-b border-outline-variant z-40 flex items-center justify-between px-container-margin lg:px-8 h-16 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href={userRole === 'admin' ? "/organisation/subjects" : "/home"}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-highest transition-colors active:scale-95 text-on-surface"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex flex-col">
            <h1 className="font-headline-sm text-primary leading-tight">
              {details.name}
            </h1>
            <span className="font-label-sm text-on-surface-variant uppercase">
              {details.code} {userRole === 'admin' ? '• Organization View' : ''}
            </span>
          </div>
        </div>
      </header>

      <main className="px-container-margin lg:px-8 pt-8 flex flex-col gap-8 max-w-screen-xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Knowledge Graph Card */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
              <h2 className="font-headline-sm text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">account_tree</span>
                Subject Knowledge Graph (DAG)
              </h2>
              <p className="text-sm text-on-surface-variant mb-6">
                This is the directed acyclic graph (DAG) representing the subject dependencies and structure. Students see this visual representation in their mastery and subject dashboards.
              </p>
              
              <div className="w-full bg-surface-container rounded-xl overflow-hidden relative border border-outline-variant min-h-[400px]">
                {graphData.nodes.length > 0 ? (
                  <ForceGraph data={graphData} />
                ) : (
                  <div className="flex h-full items-center justify-center text-on-surface-variant p-10">
                    No graph data available for this subject.
                  </div>
                )}
              </div>
            </section>

            {/* Syllabus Detail */}
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
              <h2 className="font-headline-sm text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary">menu_book</span>
                Syllabus Structure
              </h2>
              <div className="flex flex-col gap-4 mt-4">
                {syllabus?.map((unit: any) => (
                  <div key={unit.id} className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest">
                    <div className="p-4 bg-surface-container-low border-b border-outline-variant flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[20px]">folder</span>
                      <span className="font-bold text-primary">{unit.name}</span>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      {unit.topics?.map((topic: any) => (
                        <div key={topic.id} className="flex items-center gap-3 p-3 hover:bg-surface-container-lowest transition-colors rounded-lg ml-4">
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                          <span className="text-on-surface font-medium">{topic.name}</span>
                        </div>
                      ))}
                      {(!unit.topics || unit.topics.length === 0) && (
                        <p className="text-sm text-on-surface-variant ml-8 italic p-2">No topics defined in this unit.</p>
                      )}
                    </div>
                  </div>
                ))}
                {(!syllabus || syllabus.length === 0) && (
                  <p className="text-center p-8 text-on-surface-variant">No structured syllabus found. Use the LLM Curriculum agent to generate the DAG.</p>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-8">
            <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
              <div className="w-24 h-24 relative mb-4">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-surface-variant" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
                    <path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray={`${details.progress}, 100`} strokeLinecap="round" strokeWidth="3"></path>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-bold text-xl text-primary">{details.progress}%</span>
              </div>
              <h3 className="font-bold text-primary mb-1">
                 {userRole === 'admin' ? 'Average Student Progress' : 'Your Progress'}
              </h3>
              {userRole === 'admin' && (
                 <p className="text-sm text-on-surface-variant">Across all assigned groups</p>
              )}
              {userRole !== 'admin' && (
                 <Link href={`/tutor?new=1&subject_id=${id}`} className="mt-4 w-full bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex justify-center items-center gap-2">
                   <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                   Resume Learning
                 </Link>
              )}
            </section>

            {userRole === 'admin' && (
              <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-primary mb-4">Admin Actions</h3>
                <div className="flex flex-col gap-3">
                  <button className="w-full bg-secondary text-white py-2 rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors flex justify-center items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Regenerate DAG
                  </button>
                  <button className="w-full border border-outline text-primary py-2 rounded-lg text-sm font-medium hover:bg-surface-container transition-colors flex justify-center items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                    Edit Subject Info
                  </button>
                </div>
              </section>
            )}
          </div>

        </div>
      </main>
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
            if (dist < 90) {
              fx += (dx / dist) * 0.5 * alpha;
              fy += (dy / dist) * 0.5 * alpha;
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
              if (dist > 120) {
                fx += dx * 0.02 * alpha;
                fy += dy * 0.02 * alpha;
              }
            }
          }
        });

        const vx = (node.vx + fx) * 0.6;
        const vy = (node.vy + fy) * 0.6;
        
        if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) moved = true;

        const nodeRadius = 15 + (node.val || 5) * 1.2;
        return {
          ...node,
          x: Math.max(nodeRadius + 10, Math.min(w - nodeRadius - 10, node.x + vx)),
          y: Math.max(nodeRadius + 10, Math.min(h - nodeRadius - 10, node.y + vy)),
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
          const radius = 15 + (node.val || 5) * 1.2;

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
                fill={node.group === 1 ? "var(--primary)" : "var(--secondary)"}
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
