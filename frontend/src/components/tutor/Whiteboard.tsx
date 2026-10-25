"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import rough from "roughjs";

import Avatar3D from "./Avatar3D";
import ChalkScatterPlot, { parseScatterData } from "./ChalkScatterPlot";
import ChalkVisualArtifact from "./ChalkVisualArtifact";
import {
  FreeformBlackboardEngine,
  type SemanticBoardElement,
  type PlacedChalkElement,
  type ChalkCurvedConnection,
  type ChalkOverlayData,
} from "@/utils/freeformLayout";

interface WhiteboardProps {
  boardSegments: string[];
  speechSegments?: string[];
  currentSpeechIndex: number;
  currentSpeechDuration?: number;
  onSendMessage?: (msg: string) => void;
  animationsEnabled?: boolean;
  theme?: "emerald" | "slate" | "ocean";
  isLectureMode?: boolean;
}

type ChalkNodeKind = "heading" | "subtopic" | "margin" | "definition" | "bullet_list" | "table" | "flowchart" | "equation" | "code" | "result" | "standard";

function classifyChalkNode(el: SemanticBoardElement): ChalkNodeKind {
  if (el.kind === "heading" || el.role === "heading" || el.kind === "topic") return "heading";
  if (el.kind === "subtopic") return "subtopic";
  if (el.kind === "definition") return "definition";
  if (el.kind === "bullet_list") return "bullet_list";
  if (el.kind === "table") return "table";
  if (el.kind === "flowchart") return "flowchart";
  if (el.kind === "equation") return "equation";
  if (el.kind === "code") return "code";
  if (el.role === "margin" || el.kind === "scratchpad") return "margin";

  const text = (el.content || "").trim();

  // Final answers / Theorems / Conclusions -> Coral / Rose Gold Chalk
  if (
    /\\boxed|\\therefore|Q\.?E\.?D\b|Final Answer|Conclusion:|Therefore,|Result:|Key Result:/i.test(text)
  ) {
    return "result";
  }

  // Definitions / Key Concepts -> Mint / Cyan Chalk
  if (
    /^(?:Definition|Def|Key Concept|Concept|Term|Note):\s*/i.test(text) ||
    /\*\*(?:Definition|Key Concept|Term)\*\*/i.test(text)
  ) {
    return "definition";
  }

  // Bullet list
  if (/^[-*•]\s+/m.test(text)) {
    return "bullet_list";
  }

  // Equations / Formulas -> Warm Golden Amber Chalk
  if (
    /^\s*\$\$[\s\S]+\$\$\s*$/.test(text) ||
    /\\(?:frac|sqrt|int|sum|begin)\b/.test(text)
  ) {
    return "equation";
  }

  return "standard";
}

// ────────────────────────────────────────────────────────────────────────
// CHALK MARKDOWN & LATEX RENDERER
// ────────────────────────────────────────────────────────────────────────

const ChalkMarkdown = ({
  content,
  className = "",
  isBulletList = false,
  isSettled = true,
  duration = 2.5,
}: {
  content: string;
  className?: string;
  isBulletList?: boolean;
  isSettled?: boolean;
  duration?: number;
}) => {
  // Normalize escaped \r\n and \n
  let raw = (content || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");

  // Clean up LaTeX math wrappers if pure standalone TeX formula missing delimiters
  if (
    /^\s*\\(?:frac|text|begin|int|sum|sqrt|boxed)\b/.test(raw.trim()) &&
    !raw.includes("$")
  ) {
    raw = `$$${raw.trim()}$$`;
  }

  // Preserve line breaks cleanly outside $$ blocks
  const lines = raw.split("\n");
  let insideBlockMath = false;
  const processed = lines.map((line) => {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith("$$") || trimmed.endsWith("$$")) {
      insideBlockMath = !insideBlockMath;
      return trimmed;
    }
    if (insideBlockMath || !trimmed) {
      return trimmed;
    }
    // Do not append trailing spaces if it's already a markdown list item
    if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      return trimmed;
    }
    return `${trimmed}  `;
  });
  const formatted = processed.join("\n");

  const bulletItemVariants: Variants = {
    hidden: { opacity: 0, y: 4 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
  };

  return (
    <div className={`chalk-markdown leading-relaxed select-text ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed text-inherit">{children}</p>,
          ul: ({ children }) => {
            if (isBulletList && !isSettled) {
              const childArray = React.Children.toArray(children);
              const count = Math.max(1, childArray.length);
              const stagger = Math.max(0.35, Math.min(1.2, (duration || 2.5) / count));
              return (
                <motion.ul
                  className="list-disc pl-5 my-1.5 space-y-1.5 marker:text-cyan-400 marker:font-bold"
                  initial="hidden"
                  animate="visible"
                  transition={{ staggerChildren: stagger, delayChildren: 0.08 }}
                >
                  {children}
                </motion.ul>
              );
            }
            return (
              <ul className="list-disc pl-5 my-1.5 space-y-1.5 marker:text-cyan-400 marker:font-bold">
                {children}
              </ul>
            );
          },
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-1.5 space-y-1.5 marker:text-amber-400 marker:font-bold">
              {children}
            </ol>
          ),
          li: ({ children }) => {
            if (isBulletList && !isSettled) {
              return (
                <motion.li
                  variants={bulletItemVariants}
                  className="pl-1 leading-relaxed text-inherit"
                >
                  {children}
                </motion.li>
              );
            }
            return (
              <li className="pl-1 leading-relaxed text-inherit">
                {children}
              </li>
            );
          },
          strong: ({ children }) => <strong className="font-bold text-yellow-200">{children}</strong>,
        }}
      >
        {formatted}
      </ReactMarkdown>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────
// ROUGH.JS HAND-DRAWN CHALK SVG LAYER
// ────────────────────────────────────────────────────────────────────────

interface RoughChalkSvgProps {
  placedElements: PlacedChalkElement[];
  overlays: ChalkOverlayData[];
  connections: ChalkCurvedConnection[];
  canvasWidth: number;
  canvasHeight: number;
  isLectureMode?: boolean;
  currentSpeechIndex?: number;
}

const RoughChalkSvg: React.FC<RoughChalkSvgProps> = ({
  placedElements,
  overlays,
  connections,
  canvasWidth,
  canvasHeight,
  isLectureMode = false,
  currentSpeechIndex = -1,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const rc = rough.svg(svg);

    // 1. Draw Live Chalk Overlays (Circles, Strikethroughs, Explicit Boxes only)
    // Synchronized to animate live at the moment the teacher speaks about that element!
    overlays.forEach((ov) => {
      const target = placedElements.find((e) => e.id === ov.target_node_id);
      if (!target) return;

      // Only draw the mark if current speech has reached this element
      if (
        currentSpeechIndex !== 1000 &&
        currentSpeechIndex >= 0 &&
        target.appear_at !== undefined &&
        target.appear_at > currentSpeechIndex
      ) {
        return;
      }

      const ovType = (ov.overlay_type || "").toLowerCase();
      if (ovType === "encircle" || ovType === "circle") {
        const cx = target.x + target.w / 2;
        const cy = target.y + target.h / 2;
        const rx = target.w / 2 + 12;
        const ry = target.h / 2 + 8;
        const circleNode = rc.ellipse(cx, cy, rx * 2, ry * 2, {
          stroke: "rgba(253, 224, 71, 0.9)",
          strokeWidth: 2.5,
          roughness: 2.2,
          bowing: 3.0,
        });
        circleNode.setAttribute("class", "chalk-mark-animate");
        svg.appendChild(circleNode);
      } else if (ovType === "strikethrough" || ovType === "cancel") {
        const lineNode = rc.line(
          target.x - 6,
          target.y + target.h / 2 + 4,
          target.x + target.w + 6,
          target.y + target.h / 2 - 4,
          {
            stroke: "rgba(248, 113, 113, 0.95)",
            strokeWidth: 3,
            roughness: 2.0,
          }
        );
        lineNode.setAttribute("class", "chalk-mark-animate");
        svg.appendChild(lineNode);
      } else if (ovType === "box") {
        const boxNode = rc.rectangle(target.x - 6, target.y - 6, target.w + 12, target.h + 12, {
          stroke: "rgba(34, 211, 238, 0.85)",
          strokeWidth: 2,
          roughness: 1.6,
        });
        boxNode.setAttribute("class", "chalk-mark-animate");
        svg.appendChild(boxNode);
      } else if (ovType === "highlight") {
        const hlNode = rc.rectangle(target.x - 4, target.y - 2, target.w + 8, target.h + 4, {
          fill: "rgba(250, 204, 21, 0.25)",
          fillStyle: "solid",
          stroke: "transparent",
          roughness: 1.2,
        });
        hlNode.setAttribute("class", "chalk-mark-animate");
        svg.appendChild(hlNode);
      } else if (ovType === "underline") {
        const uNode = rc.line(target.x - 2, target.y + target.h + 4, target.x + target.w + 2, target.y + target.h + 4, {
          stroke: "rgba(253, 224, 71, 0.9)",
          strokeWidth: 2.2,
          roughness: 1.6,
        });
        uNode.setAttribute("class", "chalk-mark-animate");
        svg.appendChild(uNode);
      }
    });
  }, [placedElements, overlays, canvasWidth, canvasHeight]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
      style={{ minHeight: canvasHeight }}
    />
  );
};

// ────────────────────────────────────────────────────────────────────────
// YOUTUBE-STYLE LIVE CLOSED CAPTIONS
// ────────────────────────────────────────────────────────────────────────

function YouTubeLiveCaptions({
  text,
  isPlaying,
}: {
  text: string;
  isPlaying: boolean;
}) {
  const [currentWordIdx, setCurrentWordIdx] = useState(0);

  const words = useMemo(() => {
    if (!text) return [];
    return text.trim().split(/\s+/).filter(Boolean);
  }, [text]);

  // Restart word ticker on text change
  useEffect(() => {
    setCurrentWordIdx(0);
    if (!words.length || !isPlaying) return;

    // Natural human speech cadence (~270ms per word)
    const interval = setInterval(() => {
      setCurrentWordIdx((prev) => {
        if (prev < words.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 270);

    return () => clearInterval(interval);
  }, [words, isPlaying]);

  if (!text || words.length === 0) return null;

  // Sliding window of words (6-8 words at a time like YouTube closed captions)
  const windowSize = 8;
  const startIndex = Math.max(0, Math.min(currentWordIdx - 3, Math.max(0, words.length - windowSize)));
  const visibleWords = words.slice(startIndex, startIndex + windowSize);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[92%] px-4 py-2.5 rounded-2xl bg-black/85 backdrop-blur-md border border-cyan-500/40 shadow-2xl flex items-center gap-3 text-cyan-100 font-sans"
    >
      <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-400/40 text-[10px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        CC
      </div>
      <div className="text-xs sm:text-sm leading-relaxed select-none flex-1 font-sans overflow-hidden whitespace-nowrap text-ellipsis">
        {visibleWords.map((word, relIdx) => {
          const absIdx = startIndex + relIdx;
          const isCurrent = absIdx === currentWordIdx;
          const isPast = absIdx < currentWordIdx;

          return (
            <span
              key={`${absIdx}-${word}`}
              className={`transition-all duration-150 inline-block mr-1.5 ${
                isCurrent
                  ? "text-cyan-300 font-bold scale-105 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]"
                  : isPast
                  ? "text-slate-200 opacity-90"
                  : "text-slate-500 opacity-50"
              }`}
            >
              {word}
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// WHITEBOARD MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────

export default function Whiteboard({
  boardSegments,
  speechSegments = [],
  currentSpeechIndex,
  currentSpeechDuration = 0,
  onSendMessage,
  animationsEnabled = true,
  theme = "emerald",
  isLectureMode = false,
}: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportDims, setViewportDims] = useState({ w: 1000, h: 650 });

  const activeCaption = useMemo(() => {
    if (!speechSegments || speechSegments.length === 0) return "";
    if (currentSpeechIndex === 1000) return "";
    if (currentSpeechIndex >= 0 && currentSpeechIndex < speechSegments.length) {
      return speechSegments[currentSpeechIndex];
    }
    return "";
  }, [speechSegments, currentSpeechIndex]);

  const [rawNodes, setRawNodes] = useState<SemanticBoardElement[]>([]);
  const [overlays, setOverlays] = useState<ChalkOverlayData[]>([]);
  const [connections, setConnections] = useState<ChalkCurvedConnection[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(1);

  // Track node IDs that have already finished their handwriting animation
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set());
  const settledIdsRef = useRef<Set<string>>(new Set());

  const [avatarAnim, setAvatarAnim] = useState<string>("idle");

  const lastParsedTextRef = useRef<string>("");
  const layoutEngine = useMemo(
    () => new FreeformBlackboardEngine(viewportDims.w, viewportDims.h),
    [viewportDims.w, viewportDims.h]
  );

  // Resize Observer for dynamic viewport responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setViewportDims({ w: Math.round(width), h: Math.round(height) });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Parse active board segment from WebSocket or stream props
  useEffect(() => {
    // If boardSegments is empty or cleared (e.g. fresh lesson / new chat / reset), wipe board completely
    if (!boardSegments || boardSegments.length === 0 || boardSegments.every((s) => !s || !s.trim())) {
      setRawNodes([]);
      setOverlays([]);
      setConnections([]);
      settledIdsRef.current.clear();
      setSettledIds(new Set());
      lastParsedTextRef.current = "";
      return;
    }

    const activeIndex =
      currentSpeechIndex === 1000
        ? boardSegments.length - 1
        : Math.min(boardSegments.length - 1, Math.max(0, currentSpeechIndex));

    const activeRawText = boardSegments[activeIndex];
    if (!activeRawText) return;

    try {
      if (activeRawText.startsWith("{") || activeRawText.includes('"nodes"')) {
        const parsed = JSON.parse(activeRawText);

        if (parsed.gesture || (parsed.model && parsed.model.animations)) {
          setAvatarAnim(parsed.gesture || parsed.model.animations[0]?.animation || "idle");
        }

        if (activeRawText === lastParsedTextRef.current) return;
        lastParsedTextRef.current = activeRawText;

        // If explicitly requested to clear the board, reset settled nodes
        if (parsed.clear_board || parsed.reset) {
          settledIdsRef.current.clear();
          setSettledIds(new Set());
        }

        const nodesList: SemanticBoardElement[] =
          parsed.nodes ||
          parsed.visuals ||
          (parsed.board && parsed.board.nodes) ||
          (parsed.board && parsed.board.elements) ||
          [];

        const overlaysList: ChalkOverlayData[] =
          parsed.overlays ||
          parsed.chalk_overlays ||
          (parsed.board && (parsed.board.chalk_overlays || parsed.board.overlays)) ||
          [];

        const connsList =
          parsed.connections || (parsed.board && parsed.board.connections) || [];

        setRawNodes(nodesList);
        setOverlays(overlaysList);
      }
    } catch (e) {
      console.warn("[Whiteboard] Non-JSON segment, rendering fallback text:", e);
    }
  }, [boardSegments, currentSpeechIndex]);

  // Step-by-step progressive reveal timer & writing state
  useEffect(() => {
    if (rawNodes.length === 0) return;

    if (currentSpeechIndex === 1000) {
      setVisibleCount(rawNodes.length);
      setIsWriting(false);
      // Mark all raw nodes as settled
      rawNodes.forEach((n) => settledIdsRef.current.add(n.id));
      setSettledIds(new Set(settledIdsRef.current));
      return;
    }

    if (currentSpeechIndex >= 0) {
      setVisibleCount((prev) => Math.max(prev, currentSpeechIndex + 1));
      setIsWriting(true);
      const timer = setTimeout(() => setIsWriting(false), 700);
      return () => clearTimeout(timer);
    }

    // While audio is loading (currentSpeechIndex === -1), show only step 0/settled elements
    setVisibleCount(1);
    setIsWriting(false);
  }, [rawNodes, currentSpeechIndex]);

  // Compute freeform spatial layout with multi-panel division
  const { placedElements, computedHeight, columnDividers } = useMemo(() => {
    layoutEngine.setCanvasDimensions(viewportDims.w, viewportDims.h);
    layoutEngine.setLectureMode(Boolean(isLectureMode));
    const placedMap = layoutEngine.layoutAll(rawNodes);
    const placedList = Array.from(placedMap.values());

    // Generate curved Bézier connections
    const computedConns: ChalkCurvedConnection[] = [];
    rawNodes.forEach((node) => {
      if (node.spatial_intent?.target_id && node.role === "margin") {
        const conn = layoutEngine.addCurvedChalkArrow(
          node.id,
          node.spatial_intent.target_id,
          "applies here"
        );
        if (conn) computedConns.push(conn);
      }
    });

    setConnections(computedConns);

    return {
      placedElements: placedList,
      computedHeight: layoutEngine.getCanvasHeight(),
      columnDividers: layoutEngine.getColumnDividers(),
    };
  }, [rawNodes, viewportDims, layoutEngine, isLectureMode]);

  // Elements revealed progressively: Settled elements remain permanently on canvas
  const displayedElements = useMemo(() => {
    return placedElements.filter((el, idx) => {
      if (settledIds.has(el.id)) return true;
      if (currentSpeechIndex === 1000) return true;
      if (currentSpeechIndex >= 0) {
        if (el.appear_at !== undefined) {
          return el.appear_at <= currentSpeechIndex;
        }
        return idx <= currentSpeechIndex;
      }
      // When currentSpeechIndex === -1 (not yet started), show only step 0 / initial slice
      if (el.appear_at !== undefined) {
        return el.appear_at === 0;
      }
      return idx < visibleCount;
    });
  }, [placedElements, settledIds, visibleCount, currentSpeechIndex]);

  // Calculate if the current explanation step/turn has completed
  const isExplanationFinished = useMemo(() => {
    if (currentSpeechIndex === 1000) return true;
    if (rawNodes.length === 0) return true;
    const maxNodeStep = Math.max(0, ...rawNodes.map((n) => n.appear_at ?? 0));
    return currentSpeechIndex >= maxNodeStep;
  }, [currentSpeechIndex, rawNodes]);

  const markNodeSettled = (id: string) => {
    if (!settledIdsRef.current.has(id)) {
      settledIdsRef.current.add(id);
      setSettledIds(new Set(settledIdsRef.current));
    }
  };

  const themeStyles = {
    emerald: "bg-[#1b4332] border-[#3a2a18]",
    slate: "bg-[#0f172a] border-[#334155]",
    ocean: "bg-[#0c1e3d] border-[#1e3a8a]",
  };
  const activeThemeClass = themeStyles[theme] || themeStyles.emerald;

  const isMobile = viewportDims.w < 768;

  // Chalk Handwriting Stroke Reveal Animation Variants (Fluid & Clean - ZERO BLUR)
  // - Writing duration matches speech duration
  // - Top-to-bottom gentle reveal reveals lines in reading order without horizontal slicing
  // - Visual elements (diagrams, tables, images) pop directly first (0.15s)
  const nodeVariants: Variants = {
    hidden: {
      opacity: 0,
      clipPath: isMobile ? "none" : "polygon(0 0, 100% 0, 100% 0, 0 0)",
      y: isMobile ? 4 : 2,
    },
    visible: (custom?: { isVisual?: boolean; duration?: number }) => {
      const isVisual = Boolean(custom?.isVisual);
      const speechDur = custom?.duration || 0;
      const animDuration = isVisual
        ? 0.15
        : animationsEnabled
        ? Math.max(1.2, speechDur || 2.5)
        : 0;

      return {
        opacity: 1,
        clipPath: isMobile ? "none" : "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
        y: 0,
        transition: {
          duration: animDuration,
          ease: isVisual ? "easeOut" : "linear",
        },
      };
    },
    settled: {
      opacity: 1,
      clipPath: "none",
      y: 0,
      transition: { duration: 0 },
    },
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${activeThemeClass} rounded-xl sm:rounded-3xl overflow-hidden relative shadow-2xl border-4 sm:border-8 transition-colors duration-300`}
    >
      {/* Wooden Frame Edge */}
      <div className="absolute inset-0 border-2 border-black/40 rounded-[10px] sm:rounded-[20px] pointer-events-none z-30" />

      {/* Chalk Dust Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 z-0 mix-blend-screen"
        style={{
          backgroundImage:
            'url("https://www.transparenttextures.com/patterns/dust.png")',
        }}
      />

      {/* Chalkboard Writing Indicator */}
      <AnimatePresence>
        {isWriting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-4 right-4 z-40 bg-amber-500/20 border border-amber-400/40 text-amber-200 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 backdrop-blur-sm shadow-lg"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Writing on Chalkboard...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Canvas Scrollable Area */}
      <div className="absolute inset-0 overflow-y-auto custom-scrollbar z-20">
        <div
          className="relative w-full"
          style={{ minHeight: Math.max(viewportDims.h, computedHeight) }}
        >
          {/* Vertical Blackboard Multi-Panel Seam Dividers */}
          {columnDividers.map((divX, idx) => (
            <div
              key={`chalk-seam-${idx}`}
              className="absolute top-0 pointer-events-none z-10 opacity-70"
              style={{
                left: `${divX}px`,
                height: `${Math.max(viewportDims.h, computedHeight)}px`,
              }}
            >
              {/* Subtle hand-drawn chalk seam dividing the panels */}
              <div className="w-[1.5px] h-full bg-gradient-to-b from-white/10 via-white/20 to-white/10 border-r border-dashed border-white/20" />
            </div>
          ))}

          {/* Rough.js Hand-Drawn Chalk SVG Layer */}
          <RoughChalkSvg
            placedElements={displayedElements}
            overlays={overlays}
            connections={connections}
            canvasWidth={viewportDims.w}
            canvasHeight={Math.max(viewportDims.h, computedHeight)}
            isLectureMode={isLectureMode}
            currentSpeechIndex={currentSpeechIndex}
          />

          {/* Render Placed Chalk Elements across the full unified canvas */}
          {displayedElements.map((el) => {
            const isHeading = el.kind === "heading" || el.role === "heading" || el.kind === "topic";
            const isSubtopic = el.kind === "subtopic";
            const isScatter =
              (el.kind === "scatter" || el.kind === "plot") && Boolean(parseScatterData(el.content));
            const isVisualArtifact =
              !isScatter &&
              (el.kind === "diagram" ||
                el.kind === "focal_diagram" ||
                el.role === "focal_diagram" ||
                el.kind === "asset" ||
                el.kind === "table" ||
                el.kind === "flowchart" ||
                el.content.includes("<svg") ||
                el.content.startsWith("IMAGE:") ||
                el.content.includes("+---+") ||
                el.content.includes("+-------+") ||
                el.content.includes("--->") ||
                (el.content.includes("|") && el.content.split("\n").filter((l) => l.includes("|")).length >= 2) ||
                el.content.trim().startsWith("{"));
            const nodeCategory = classifyChalkNode(el);
            const isSettled = settledIds.has(el.id);

            // Active Speaking Focus: Highlight current node professor is discussing
            const isActiveSpeaking =
              !isExplanationFinished &&
              currentSpeechIndex >= 0 &&
              currentSpeechIndex !== 1000 &&
              (el.appear_at === currentSpeechIndex ||
                (el.appear_at === undefined && displayedElements.indexOf(el) === currentSpeechIndex));

            return (
              <motion.div
                key={el.id}
                custom={{
                  isVisual: isVisualArtifact || isScatter,
                  duration: currentSpeechDuration,
                }}
                variants={nodeVariants}
                initial={isSettled ? "settled" : "hidden"}
                animate={isSettled ? "settled" : "visible"}
                onAnimationComplete={() => markNodeSettled(el.id)}
                style={{
                  position: "absolute",
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.w}px`,
                  minHeight: `${el.h}px`,
                  transform: `rotate(${el.tilt}deg)`,
                  transformOrigin: "center center",
                  zIndex: isActiveSpeaking ? 35 : 20,
                }}
                className="select-text transition-all duration-300"
              >
                {isHeading && (
                  <h2 className="w-full text-left text-lg sm:text-xl font-bold handwritten-font text-yellow-300 tracking-wide border-b border-yellow-400/40 pb-1 bg-transparent leading-snug flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-yellow-400">edit_note</span>
                    <ChalkMarkdown content={el.content.replace(/^#+\s*/, '')} />
                  </h2>
                )}

                {isSubtopic && (
                  <h3 className="w-full text-left text-sm sm:text-base font-bold handwritten-font text-emerald-300 tracking-wide flex items-center gap-2 border-b border-emerald-400/30 pb-0.5 mb-1 bg-transparent">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <ChalkMarkdown content={el.content.replace(/^#+\s*/, '')} />
                  </h3>
                )}

                {isScatter && (
                  <div className="w-full h-full my-0.5">
                    <ChalkScatterPlot
                      content={el.content}
                      width={el.w}
                      height={Math.max(160, el.h)}
                    />
                  </div>
                )}

                {isVisualArtifact && (
                  <div className="w-full h-full my-0.5">
                    <ChalkVisualArtifact
                      content={el.content}
                      width={el.w}
                      height={Math.max(160, el.h)}
                      isSettled={isSettled}
                      isActiveSpeaking={isActiveSpeaking}
                      duration={currentSpeechDuration}
                    />
                  </div>
                )}

                {!isHeading && !isSubtopic && !isScatter && !isVisualArtifact && (
                  <>
                    {nodeCategory === "definition" ? (
                      <div className="w-full border-l-4 border-cyan-400 bg-cyan-950/20 px-3 py-1.5 rounded-r-lg text-cyan-100 text-[13px] sm:text-[14px] leading-relaxed chalkboard-font shadow-sm my-1">
                        <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-cyan-300/80 mb-0.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          DEFINITION
                        </div>
                        <ChalkMarkdown
                          content={el.content}
                          isSettled={isSettled}
                          duration={currentSpeechDuration}
                        />
                      </div>
                    ) : nodeCategory === "equation" ? (
                      <div className="w-full py-1 text-amber-200 text-[14px] sm:text-[15px] leading-relaxed flex items-center justify-center my-1 bg-amber-950/15 rounded-lg p-2 border border-amber-400/20">
                        <ChalkMarkdown
                          content={el.content}
                          isSettled={isSettled}
                          duration={currentSpeechDuration}
                        />
                      </div>
                    ) : nodeCategory === "bullet_list" ? (
                      <div className="w-full py-1 text-white/95 text-[13px] sm:text-[14px] leading-relaxed chalkboard-font pl-1">
                        <ChalkMarkdown
                          content={el.content}
                          isBulletList={true}
                          isSettled={isSettled}
                          duration={currentSpeechDuration}
                        />
                      </div>
                    ) : (
                      <div
                        className={`w-full h-full py-0.5 chalkboard-font text-[13px] sm:text-[14px] leading-relaxed bg-transparent ${
                          nodeCategory === "result"
                            ? "text-rose-200 font-semibold border border-rose-400/30 rounded p-1.5 bg-rose-950/15"
                            : "text-white/95"
                        }`}
                      >
                        <ChalkMarkdown
                          content={el.content}
                          isSettled={isSettled}
                          duration={currentSpeechDuration}
                        />
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Live Voice Closed Captions (YouTube CC Style) */}
      <AnimatePresence>
        {activeCaption && (
          <YouTubeLiveCaptions
            text={activeCaption}
            isPlaying={!isExplanationFinished}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
