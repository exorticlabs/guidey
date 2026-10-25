"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import rough from "roughjs";

interface FlowNode {
  id: string;
  title: string;
  subtitle?: string;
}

interface FlowLink {
  from: string;
  to: string;
  label?: string;
}

interface ParsedTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

interface ParsedFlow {
  nodes: FlowNode[];
  links: FlowLink[];
}

function healTruncatedSvg(rawSvg: string): string {
  let svg = rawSvg.trim();
  const start = svg.indexOf("<svg");
  if (start > 0) svg = svg.substring(start);

  if (svg.includes("</svg>")) {
    const end = svg.lastIndexOf("</svg>") + 6;
    return svg.substring(0, end);
  }

  // It was cut off mid-stream.
  // 1. If it ends inside an unclosed tag like `<r` or `<line x1="...`, trim back to the last complete `>`
  const lastGt = svg.lastIndexOf(">");
  if (lastGt !== -1) {
    svg = svg.substring(0, lastGt + 1);
  }

  // 2. Ensure trailing closing tags
  if (svg.includes("<defs>") && !svg.includes("</defs>")) {
    svg += "\n</defs>";
  }
  if (!svg.includes("</svg>")) {
    svg += "\n</svg>";
  }
  return svg;
}

export function parseVisualArtifact(content: string): {
  type: "svg" | "table" | "flow" | "image" | "raw";
  svgContent?: string;
  tableData?: ParsedTable;
  flowData?: ParsedFlow;
  imageData?: { url: string; alt?: string };
} {
  if (!content) return { type: "raw" };
  const trimmed = content.trim();

  // 1. Direct SVG Artifact (complete or truncated)
  if (trimmed.includes("<svg")) {
    const healed = healTruncatedSvg(trimmed);
    return {
      type: "svg",
      svgContent: healed,
    };
  }

  // 2. Markdown Image or Direct Image URL
  const markdownImgMatch = trimmed.match(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/);
  if (markdownImgMatch) {
    return {
      type: "image",
      imageData: {
        alt: markdownImgMatch[1] || "Reference Visual",
        url: markdownImgMatch[2],
      },
    };
  }
  const directUrlMatch = trimmed.match(/^(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|svg|webp|gif)(?:\?[^\s]+)?)$/i);
  if (directUrlMatch) {
    return {
      type: "image",
      imageData: {
        alt: "Reference Visual",
        url: directUrlMatch[1],
      },
    };
  }

  // 3. Educational Image Search / Query Token (e.g. IMAGE: mitochondrion, ASSET: quicksort)
  const imageQueryMatch = trimmed.match(/^(?:image|asset|fetch_image|diagram_image):\s*(.+)$/i);
  if (imageQueryMatch) {
    const query = imageQueryMatch[1].trim();
    return {
      type: "image",
      imageData: {
        alt: query,
        url: query,
      },
    };
  }

  const bracketImageMatch = trimmed.match(/^\[?(?:image|asset):\s*([^\]]+)\]?$/i);
  if (bracketImageMatch) {
    const query = bracketImageMatch[1].trim();
    return {
      type: "image",
      imageData: {
        alt: query,
        url: query,
      },
    };
  }

  // 4. Structured JSON Visual Spec
  try {
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(trimmed.substring(jsonStart, jsonEnd + 1));
      if (parsed.type === "table" && Array.isArray(parsed.headers)) {
        return {
          type: "table",
          tableData: {
            title: parsed.title,
            headers: parsed.headers,
            rows: parsed.rows || [],
          },
        };
      }
      if (parsed.type === "flow" && Array.isArray(parsed.nodes)) {
        return {
          type: "flow",
          flowData: {
            nodes: parsed.nodes,
            links: parsed.links || [],
          },
        };
      }
    }
  } catch (e) {
    // Continue to text pattern parser
  }

  // 3. ASCII Table Parser (+---+---+, | col1 | col2 |)
  if (trimmed.includes("+---") || (trimmed.includes("|") && trimmed.split("\n").filter((l) => l.includes("|")).length >= 2)) {
    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    let title: string | undefined;
    const tableLines: string[] = [];

    for (const line of lines) {
      if (line.includes("|") || line.startsWith("+--")) {
        tableLines.push(line);
      } else if (!title && !line.includes("+")) {
        title = line.replace(/[:#]/g, "").trim();
      }
    }

    const rowLines = tableLines.filter((l) => l.includes("|") && !l.includes("---"));
    if (rowLines.length >= 2) {
      const headers = rowLines[0]
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const rows = rowLines.slice(1).map((r) =>
        r
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean)
      );

      if (headers.length > 0 && rows.length > 0) {
        return {
          type: "table",
          tableData: { title, headers, rows },
        };
      }
    }
  }

  // 4. Flow Diagram Parser ([ Node A ] ---> [ Node B ])
  if (trimmed.includes("--->") || trimmed.includes("-->") || trimmed.includes("->")) {
    const rawLines = trimmed.split("\n");
    const mainLine = rawLines.find((l) => l.includes("--->") || l.includes("-->") || l.includes("->")) || "";
    const subLine = rawLines.find((l) => l !== mainLine && l.includes("(")) || "";

    // Extract blocks in [ ... ]
    const blockMatches = Array.from(mainLine.matchAll(/\[\s*([^\]]+)\s*\]/g));
    if (blockMatches.length >= 2) {
      const nodes: FlowNode[] = [];
      const subMatches = Array.from(subLine.matchAll(/\(\s*([^)]+)\s*\)/g));

      blockMatches.forEach((m, idx) => {
        nodes.push({
          id: `fn_${idx}`,
          title: m[1].trim(),
          subtitle: subMatches[idx] ? subMatches[idx][1].trim() : undefined,
        });
      });

      const links: FlowLink[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        links.push({
          from: nodes[i].id,
          to: nodes[i + 1].id,
          label: "maps to",
        });
      }

      return {
        type: "flow",
        flowData: { nodes, links },
      };
    }
  }

  return { type: "raw" };
}

function ChalkImageVisual({
  alt,
  initialUrl,
  width,
  height,
}: {
  alt: string;
  initialUrl: string;
  width: number;
  height: number;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    async function resolveImage() {
      setIsLoading(true);
      setHasError(false);

      // Direct HTTP URL provided
      if (initialUrl && (initialUrl.startsWith("http://") || initialUrl.startsWith("https://"))) {
        setResolvedUrl(initialUrl);
        setIsLoading(false);
        return;
      }

      // Query Wikimedia Commons / Wikipedia API
      const searchQuery = (initialUrl || alt || "").replace(/^(?:image|asset):\s*/i, "").trim();
      if (!searchQuery) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      try {
        // Query 1: Wikimedia Commons Image Search
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
          searchQuery
        )}&gsrlimit=3&prop=imageinfo&iiprop=url|mime&format=json&origin=*`;
        const res = await fetch(commonsUrl);
        const data = await res.json();
        const pages = data?.query?.pages;

        if (pages && !isCancelled) {
          for (const pid of Object.keys(pages)) {
            const info = pages[pid]?.imageinfo?.[0];
            const url = info?.url;
            if (url && (url.endsWith(".svg") || url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".webp"))) {
              setResolvedUrl(url);
              setIsLoading(false);
              return;
            }
          }
        }

        // Query 2: Wikipedia Pageimages Thumbnail API
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${encodeURIComponent(
          searchQuery
        )}&gsrlimit=1&pithumbsize=600&origin=*`;
        const wikiRes = await fetch(wikiUrl);
        const wikiData = await wikiRes.json();
        const wikiPages = wikiData?.query?.pages;

        if (wikiPages && !isCancelled) {
          const firstPid = Object.keys(wikiPages)[0];
          const thumb = wikiPages[firstPid]?.thumbnail?.source;
          if (thumb) {
            setResolvedUrl(thumb);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("[ChalkImageVisual] Image lookup failed:", err);
      }

      if (!isCancelled) {
        setHasError(true);
        setIsLoading(false);
      }
    }

    resolveImage();
    return () => {
      isCancelled = true;
    };
  }, [initialUrl, alt]);

  const handleImgError = async () => {
    // If direct URL failed, attempt Wikipedia search
    if (resolvedUrl && resolvedUrl.startsWith("http") && !resolvedUrl.includes("wikimedia.org") && !resolvedUrl.includes("wikipedia.org")) {
      const fallbackQuery = alt || "educational diagram";
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${encodeURIComponent(
          fallbackQuery
        )}&gsrlimit=1&pithumbsize=600&origin=*`;
        const res = await fetch(wikiUrl);
        const data = await res.json();
        const pages = data?.query?.pages;
        if (pages) {
          const firstPid = Object.keys(pages)[0];
          const thumb = pages[firstPid]?.thumbnail?.source;
          if (thumb) {
            setResolvedUrl(thumb);
            return;
          }
        }
      } catch (e) {}
    }
    setHasError(true);
  };

  return (
    <div
      className="relative rounded-xl border border-cyan-400/40 bg-black/45 p-2.5 shadow-2xl select-none overflow-hidden my-2 backdrop-blur-xs flex flex-col items-center"
      style={{ width: `${width}px`, minHeight: `${Math.max(160, height)}px` }}
    >
      <div className="w-full text-center text-[10px] uppercase font-bold tracking-wider text-cyan-300 mb-1.5 flex items-center justify-between px-1 border-b border-cyan-400/25 pb-1">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Educational Visual Reference
        </span>
        <span className="text-[9px] text-cyan-400/60 font-mono">WIKIMEDIA</span>
      </div>

      <div className="relative w-full rounded-lg overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center min-h-[140px] max-h-[300px]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-cyan-300 text-xs font-mono text-center animate-pulse">
            <span className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>Fetching verified reference diagram...</span>
          </div>
        )}

        {!isLoading && hasError && (
          <div className="flex flex-col items-center justify-center gap-1.5 p-5 text-amber-200/80 text-xs chalkboard-font text-center">
            <span className="text-xl">🏛️</span>
            <span className="font-bold text-amber-300">{alt}</span>
            <span className="text-[10px] text-white/50">(Educational visual reference)</span>
          </div>
        )}

        {!isLoading && !hasError && resolvedUrl && (
          <img
            src={resolvedUrl}
            alt={alt || "Educational diagram"}
            className="max-w-full max-h-[280px] object-contain rounded-md transition-opacity duration-300"
            onError={handleImgError}
            loading="lazy"
          />
        )}
      </div>

      {alt && (
        <p className="text-[11px] text-cyan-200/90 chalkboard-font text-center mt-1.5 px-2 line-clamp-2">
          {alt}
        </p>
      )}
    </div>
  );
}

export default function ChalkVisualArtifact({
  content,
  width = 360,
  height = 200,
  isSettled = false,
  isActiveSpeaking = false,
  duration = 0,
}: {
  content: string;
  width?: number;
  height?: number;
  isSettled?: boolean;
  isActiveSpeaking?: boolean;
  duration?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const visual = useMemo(() => parseVisualArtifact(content), [content]);

  // Progressive table cell reveal: full layout first, then internal cells stream across speech duration
  const [tableProgress, setTableProgress] = useState(isSettled ? 1 : 0);

  useEffect(() => {
    if (isSettled) {
      setTableProgress(1);
      return;
    }
    if (!isActiveSpeaking || duration <= 0) {
      setTableProgress(1);
      return;
    }

    setTableProgress(0);
    const start = performance.now();
    const durationMs = Math.max(1500, duration * 1000);
    let animId: number;

    const frame = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / durationMs);
      setTableProgress(p);
      if (p < 1) {
        animId = requestAnimationFrame(frame);
      }
    };

    animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [isActiveSpeaking, isSettled, duration]);

  useEffect(() => {
    if (!svgRef.current || visual.type === "svg" || visual.type === "raw") return;
    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const rc = rough.svg(svg);

    // ── A. Render Hand-Drawn Chalk Table ───────────────────────────
    if (visual.type === "table" && visual.tableData) {
      const { headers, rows } = visual.tableData;
      const numCols = headers.length;
      const numRows = rows.length;
      const colWidth = (width - 32) / Math.max(1, numCols);
      const rowHeight = 28;
      const startX = 16;
      const startY = visual.tableData.title ? 36 : 14;

      // Outer table border in chalk cyan
      const outerBox = rc.rectangle(startX, startY, width - 32, (numRows + 1) * rowHeight, {
        stroke: "rgba(34, 211, 238, 0.8)",
        strokeWidth: 2,
        roughness: 1.5,
      });
      svg.appendChild(outerBox);

      // Header bottom divider line
      const headerLine = rc.line(startX, startY + rowHeight, startX + width - 32, startY + rowHeight, {
        stroke: "rgba(253, 224, 71, 0.9)",
        strokeWidth: 2,
        roughness: 1.3,
      });
      svg.appendChild(headerLine);

      // Vertical column dividers
      for (let c = 1; c < numCols; c++) {
        const vX = startX + c * colWidth;
        const vLine = rc.line(vX, startY, vX, startY + (numRows + 1) * rowHeight, {
          stroke: "rgba(255, 255, 255, 0.25)",
          strokeWidth: 1.2,
          strokeLineDash: [4, 4],
        });
        svg.appendChild(vLine);
      }

      // Horizontal row dividers
      for (let r = 2; r <= numRows; r++) {
        const hY = startY + r * rowHeight;
        const hLine = rc.line(startX, hY, startX + width - 32, hY, {
          stroke: "rgba(255, 255, 255, 0.15)",
          strokeWidth: 1,
        });
        svg.appendChild(hLine);
      }
    }

    // ── B. Render Hand-Drawn Chalk Flow / Architecture ─────────────
    if (visual.type === "flow" && visual.flowData) {
      const { nodes, links } = visual.flowData;
      const numNodes = nodes.length;
      const nodeWidth = Math.min(160, (width - 40 - (numNodes - 1) * 44) / numNodes);
      const nodeHeight = 64;
      const startY = 32;

      const positions: Record<string, { x: number; y: number; w: number; h: number }> = {};

      nodes.forEach((node, idx) => {
        const nodeX = 16 + idx * (nodeWidth + 44);
        positions[node.id] = { x: nodeX, y: startY, w: nodeWidth, h: nodeHeight };

        // Chalk node box (colored cyan or amber)
        const box = rc.rectangle(nodeX, startY, nodeWidth, nodeHeight, {
          stroke: idx % 2 === 0 ? "rgba(34, 211, 238, 0.85)" : "rgba(251, 191, 36, 0.85)",
          fill: idx % 2 === 0 ? "rgba(34, 211, 238, 0.10)" : "rgba(251, 191, 36, 0.10)",
          fillStyle: "solid",
          strokeWidth: 2,
          roughness: 1.6,
        });
        svg.appendChild(box);
      });

      // Chalk connecting arrows
      links.forEach((link) => {
        const fromPos = positions[link.from];
        const toPos = positions[link.to];
        if (!fromPos || !toPos) return;

        const x1 = fromPos.x + fromPos.w;
        const y1 = fromPos.y + fromPos.h / 2;
        const x2 = toPos.x;
        const y2 = toPos.y + toPos.h / 2;

        const arrowLine = rc.line(x1 + 4, y1, x2 - 8, y2, {
          stroke: "rgba(255, 255, 255, 0.85)",
          strokeWidth: 2,
          roughness: 1.3,
        });
        svg.appendChild(arrowLine);

        // Arrow head
        const arrowHead = rc.path(`M ${x2 - 8} ${y2} l -8 -4 l 2 4 l -2 4 Z`, {
          stroke: "rgba(255, 255, 255, 0.9)",
          fill: "rgba(255, 255, 255, 0.8)",
          fillStyle: "solid",
          roughness: 1.2,
        });
        svg.appendChild(arrowHead);
      });
    }
  }, [visual, width, height]);

  // 1. Direct SVG Render
  if (visual.type === "svg" && visual.svgContent) {
    return (
      <div
        className="w-full my-2 p-3 rounded-xl border border-cyan-400/40 bg-black/40 shadow-xl overflow-hidden flex flex-col items-center justify-center select-none"
        style={{ minHeight: `${height}px` }}
      >
        <div className="w-full text-[11px] uppercase font-bold tracking-wider text-cyan-300 mb-2 flex items-center justify-between border-b border-cyan-400/25 pb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Vector Schematic / Visual Artifact
          </span>
          <span className="text-[10px] text-cyan-400/70 font-mono">SVG ARTIFACT</span>
        </div>
        <div
          className="w-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: visual.svgContent }}
        />
      </div>
    );
  }

  // 2. Hand-Drawn Chalk Table Render
  if (visual.type === "table" && visual.tableData) {
    const { title, headers, rows } = visual.tableData;
    const numCols = headers.length;
    const colWidth = (width - 32) / Math.max(1, numCols);
    const rowHeight = 28;
    const startX = 16;
    const startY = title ? 36 : 14;

    return (
      <div
        className="relative rounded-xl border border-cyan-400/35 bg-black/35 p-2 shadow-xl select-none overflow-hidden my-2"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {title && (
          <div className="text-center text-xs font-bold handwritten-font text-cyan-300 tracking-wider mb-1">
            {title}
          </div>
        )}

        <svg ref={svgRef} width={width} height={height} className="absolute inset-0 pointer-events-none" />

        {/* Text Labels overlaid over hand-drawn cells */}
        <div className="absolute inset-0 pointer-events-none" style={{ left: `${startX}px`, top: `${startY}px` }}>
          {/* Header Row */}
          <div className="flex" style={{ height: `${rowHeight}px` }}>
            {headers.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-center text-xs font-bold chalkboard-font text-yellow-300 tracking-wide truncate px-1"
                style={{ width: `${colWidth}px` }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Data Rows: layout first, internal cells progressively revealed */}
          {rows.map((row, rIdx) => {
            const isRowVisible = isSettled || !isActiveSpeaking || (rIdx / Math.max(1, rows.length)) <= tableProgress;
            return (
              <div
                key={rIdx}
                className="flex transition-opacity duration-300"
                style={{
                  height: `${rowHeight}px`,
                  opacity: isRowVisible ? 1 : 0,
                }}
              >
                {row.map((cell, cIdx) => (
                  <div
                    key={cIdx}
                    className="flex items-center justify-center text-xs chalkboard-font text-white/90 truncate px-1"
                    style={{ width: `${colWidth}px` }}
                  >
                    {cell}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. Hand-Drawn Chalk Flow Diagram Render
  if (visual.type === "flow" && visual.flowData) {
    const { nodes } = visual.flowData;
    const numNodes = nodes.length;
    const nodeWidth = Math.min(160, (width - 40 - (numNodes - 1) * 44) / numNodes);
    const nodeHeight = 64;
    const startY = 32;

    return (
      <div
        className="relative rounded-xl border border-cyan-400/35 bg-black/35 p-2 shadow-xl select-none overflow-hidden my-2"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <div className="text-center text-[11px] uppercase font-bold tracking-wider text-cyan-300 mb-1 flex items-center justify-between px-2">
          <span>Architecture Flow</span>
          <span className="text-[10px] text-cyan-400/60 font-mono">{nodes.length} Components</span>
        </div>

        <svg ref={svgRef} width={width} height={height} className="absolute inset-0 pointer-events-none" />

        {/* Text inside nodes */}
        {nodes.map((node, idx) => {
          const nodeX = 16 + idx * (nodeWidth + 44);
          return (
            <div
              key={node.id}
              className="absolute flex flex-col items-center justify-center text-center p-1 pointer-events-none"
              style={{
                left: `${nodeX}px`,
                top: `${startY}px`,
                width: `${nodeWidth}px`,
                height: `${nodeHeight}px`,
              }}
            >
              <span className="text-xs font-bold chalkboard-font text-white leading-tight">
                {node.title}
              </span>
              {node.subtitle && (
                <span className="text-[10px] handwritten-font text-amber-300 leading-tight mt-0.5">
                  {node.subtitle}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 4. Reference Image / Educational Diagram Render
  if (visual.type === "image" && visual.imageData) {
    return (
      <ChalkImageVisual
        alt={visual.imageData.alt || "Educational diagram"}
        initialUrl={visual.imageData.url}
        width={width}
        height={height}
      />
    );
  }

  // Fallback: Clean Monospace Chalk Spec Box
  return (
    <div
      className="w-full my-2 p-3 rounded-xl border border-cyan-400/40 bg-black/40 text-cyan-200 shadow-xl backdrop-blur-xs select-text overflow-hidden"
      style={{ minHeight: `${height}px` }}
    >
      <div className="text-[11px] uppercase font-bold tracking-wider text-cyan-300 mb-2 flex items-center justify-between border-b border-cyan-400/25 pb-1 select-none">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Visual Representation
        </span>
        <span className="text-[10px] text-cyan-400/70 font-mono">SPEC</span>
      </div>
      <pre className="font-mono text-xs sm:text-sm text-cyan-100 whitespace-pre-wrap leading-relaxed select-text overflow-x-auto custom-scrollbar">
        {content}
      </pre>
    </div>
  );
}
