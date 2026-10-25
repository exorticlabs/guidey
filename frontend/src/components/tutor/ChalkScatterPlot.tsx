"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import rough from "roughjs";

interface Point {
  x: number;
  y: number;
  label?: string;
}

interface ScatterData {
  title?: string;
  xLabel?: string;
  yLabel?: string;
  points: Point[];
  trendline?: boolean;
}

export function parseScatterData(content: string): ScatterData | null {
  if (!content) return null;
  const trimmed = content.trim();

  // 1. Strictly reject any markup, SVG, XML, HTML, or tags
  if (
    trimmed.startsWith("<") ||
    trimmed.includes("<svg") ||
    trimmed.includes("xmlns=") ||
    trimmed.includes("</") ||
    trimmed.includes("<line") ||
    trimmed.includes("<rect") ||
    trimmed.includes("<text") ||
    trimmed.includes("<path")
  ) {
    return null;
  }

  // 2. Try parsing direct JSON
  try {
    const jsonStart = trimmed.indexOf("{");
    const jsonEnd = trimmed.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(trimmed.substring(jsonStart, jsonEnd + 1));
      let pts: Point[] = [];
      if (Array.isArray(parsed.points)) {
        pts = parsed.points.map((p: any) => {
          if (Array.isArray(p)) return { x: Number(p[0]), y: Number(p[1]) };
          return { x: Number(p.x), y: Number(p.y), label: p.label };
        });
      } else if (Array.isArray(parsed.data)) {
        pts = parsed.data.map((p: any) => {
          if (Array.isArray(p)) return { x: Number(p[0]), y: Number(p[1]) };
          return { x: Number(p.x), y: Number(p.y), label: p.label };
        });
      } else if (Array.isArray(parsed.x) && Array.isArray(parsed.y)) {
        pts = parsed.x.map((xVal: any, i: number) => ({
          x: Number(xVal),
          y: Number(parsed.y[i] ?? 0),
        }));
      }

      if (pts.length > 0 && pts.every((p) => !isNaN(p.x) && !isNaN(p.y))) {
        return {
          title: parsed.title || "Interactive Graph",
          xLabel: parsed.x_label || parsed.xLabel || "X",
          yLabel: parsed.y_label || parsed.yLabel || "Y",
          points: pts,
          trendline: parsed.trendline ?? true,
        };
      }
    }
  } catch (e) {
    // Continue to regex extractor
  }

  // 3. Extract coordinate pairs like (1, 2), (2.5, 5), (3, 7)
  // Only accept if content mentions plot, scatter, graph, points, or coordinates
  const hasPlotContext = /(?:plot|scatter|graph|data|points|trend|coord)/i.test(trimmed);
  if (!hasPlotContext) {
    return null;
  }

  const pairRegex = /\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?/g;
  const extractedPoints: Point[] = [];
  let match;
  while ((match = pairRegex.exec(trimmed)) !== null) {
    const px = parseFloat(match[1]);
    const py = parseFloat(match[2]);
    if (!isNaN(px) && !isNaN(py)) {
      extractedPoints.push({ x: px, y: py });
    }
  }

  if (extractedPoints.length >= 2) {
    const titleMatch = trimmed.match(/(?:plot|scatter|graph|data)\s*(?:of|for)?[:\s]+([^\n\(\]]+)/i);
    return {
      title: titleMatch ? titleMatch[1].trim() : "Interactive Scatter Plot",
      xLabel: "X",
      yLabel: "Y",
      points: extractedPoints,
      trendline: true,
    };
  }

  return null;
}

export default function ChalkScatterPlot({
  content,
  width = 340,
  height = 220,
}: {
  content: string;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const data = useMemo(() => parseScatterData(content), [content]);

  // Real-time interactivity state
  const [slopeFactor, setSlopeFactor] = useState<number>(1.0);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<Point | null>(null);

  // Layout boundaries
  const padLeft = 45;
  const padRight = 24;
  const padTop = 32;
  const padBottom = 42;

  const plotW = Math.max(80, width - padLeft - padRight);
  const plotH = Math.max(60, height - padTop - padBottom);

  const bounds = useMemo(() => {
    if (!data || data.points.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    const xs = data.points.map((p) => p.x);
    const ys = data.points.map((p) => p.y);
    return {
      minX: Math.min(...xs, 0),
      maxX: Math.max(...xs, 1),
      minY: Math.min(...ys, 0),
      maxY: Math.max(...ys, 1),
    };
  }, [data]);

  const scaleX = useCallback(
    (val: number) => padLeft + ((val - bounds.minX) / Math.max(0.001, bounds.maxX - bounds.minX)) * plotW,
    [bounds.minX, bounds.maxX, padLeft, plotW]
  );

  const scaleY = useCallback(
    (val: number) => padTop + plotH - ((val - bounds.minY) / Math.max(0.001, bounds.maxY - bounds.minY)) * plotH,
    [bounds.minY, bounds.maxY, padTop, plotH]
  );

  const unscaleX = useCallback(
    (px: number) => bounds.minX + ((px - padLeft) / Math.max(1, plotW)) * (bounds.maxX - bounds.minX),
    [bounds.minX, bounds.maxX, padLeft, plotW]
  );

  const unscaleY = useCallback(
    (py: number) => bounds.minY + ((padTop + plotH - py) / Math.max(1, plotH)) * (bounds.maxY - bounds.minY),
    [bounds.minY, bounds.maxY, padTop, plotH]
  );

  // Draw rough.js static & dynamic elements
  useEffect(() => {
    if (!svgRef.current || !data || data.points.length === 0) return;
    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const rc = rough.svg(svg);
    const pts = data.points;
    const originX = scaleX(bounds.minX);
    const originY = scaleY(bounds.minY);

    // 1. Chalk Axes
    const xAxis = rc.line(padLeft - 6, originY, padLeft + plotW + 12, originY, {
      stroke: "rgba(255, 255, 255, 0.75)",
      strokeWidth: 2,
      roughness: 1.2,
    });
    const yAxis = rc.line(originX, padTop - 10, originX, originY + 6, {
      stroke: "rgba(255, 255, 255, 0.75)",
      strokeWidth: 2,
      roughness: 1.2,
    });
    svg.appendChild(xAxis);
    svg.appendChild(yAxis);

    // 2. Axis arrows
    const xArrow = rc.path(`M ${padLeft + plotW + 12} ${originY} l -7 -4 l 2 4 l -2 4 Z`, {
      stroke: "rgba(255, 255, 255, 0.8)",
      fill: "rgba(255, 255, 255, 0.6)",
      fillStyle: "solid",
      roughness: 1.1,
    });
    const yArrow = rc.path(`M ${originX} ${padTop - 10} l -4 7 l 4 -2 l 4 2 Z`, {
      stroke: "rgba(255, 255, 255, 0.8)",
      fill: "rgba(255, 255, 255, 0.6)",
      fillStyle: "solid",
      roughness: 1.1,
    });
    svg.appendChild(xArrow);
    svg.appendChild(yArrow);

    // 3. Grid Ticks & Gridlines
    const numTicks = 4;
    for (let i = 0; i <= numTicks; i++) {
      const xVal = bounds.minX + (i / numTicks) * (bounds.maxX - bounds.minX);
      const px = scaleX(xVal);
      const tick = rc.line(px, originY - 3, px, originY + 4, {
        stroke: "rgba(255, 255, 255, 0.5)",
        strokeWidth: 1.5,
      });
      svg.appendChild(tick);

      const yVal = bounds.minY + (i / numTicks) * (bounds.maxY - bounds.minY);
      const py = scaleY(yVal);
      const yTick = rc.line(originX - 4, py, originX + 3, py, {
        stroke: "rgba(255, 255, 255, 0.5)",
        strokeWidth: 1.5,
      });
      svg.appendChild(yTick);

      if (i > 0 && i < numTicks) {
        const hGrid = rc.line(padLeft, py, padLeft + plotW, py, {
          stroke: "rgba(255, 255, 255, 0.08)",
          strokeWidth: 1,
          strokeLineDash: [4, 6],
        });
        const vGrid = rc.line(px, padTop, px, originY, {
          stroke: "rgba(255, 255, 255, 0.08)",
          strokeWidth: 1,
          strokeLineDash: [4, 6],
        });
        svg.appendChild(hGrid);
        svg.appendChild(vGrid);
      }
    }

    // 4. Real-Time Interactive Linear Trendline
    if (data.trendline && pts.length >= 2) {
      const n = pts.length;
      const sumX = pts.reduce((acc, p) => acc + p.x, 0);
      const sumY = pts.reduce((acc, p) => acc + p.y, 0);
      const sumXY = pts.reduce((acc, p) => acc + p.x * p.y, 0);
      const sumXX = pts.reduce((acc, p) => acc + p.x * p.x, 0);
      const rawSlope = (n * sumXY - sumX * sumY) / Math.max(0.001, n * sumXX - sumX * sumX);
      const adjustedSlope = rawSlope * slopeFactor;
      const meanX = sumX / n;
      const meanY = sumY / n;
      const intercept = meanY - adjustedSlope * meanX;

      const lineX1 = bounds.minX;
      const lineY1 = adjustedSlope * lineX1 + intercept;
      const lineX2 = bounds.maxX;
      const lineY2 = adjustedSlope * lineX2 + intercept;

      const trend = rc.line(
        scaleX(lineX1),
        scaleY(lineY1),
        scaleX(lineX2),
        scaleY(lineY2),
        {
          stroke: "rgba(251, 191, 36, 0.85)",
          strokeWidth: 2.2,
          strokeLineDash: [6, 5],
          roughness: 1.2,
        }
      );
      svg.appendChild(trend);
    }

    // 5. Draw Scatter Points
    pts.forEach((pt) => {
      const px = scaleX(pt.x);
      const py = scaleY(pt.y);
      const isPinned = pinnedPoint && pinnedPoint.x === pt.x && pinnedPoint.y === pt.y;

      const dot = rc.circle(px, py, isPinned ? 14 : 10, {
        stroke: isPinned ? "rgba(253, 224, 71, 1)" : "rgba(34, 211, 238, 0.95)",
        fill: isPinned ? "rgba(253, 224, 71, 0.7)" : "rgba(34, 211, 238, 0.55)",
        fillStyle: "solid",
        strokeWidth: isPinned ? 2.5 : 1.8,
        roughness: 1.4,
      });
      svg.appendChild(dot);
    });
  }, [data, width, height, bounds, scaleX, scaleY, slopeFactor, pinnedPoint, padLeft, padTop, plotW, plotH]);

  // Pointer event handlers for real-time cursor tracking
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (px >= padLeft && px <= padLeft + plotW && py >= padTop && py <= padTop + plotH) {
      const xVal = unscaleX(px);
      const yVal = unscaleY(py);

      // Snap to closest point if within 18px
      let closestPt: Point | null = null;
      let minDist = 18;
      if (data?.points) {
        for (const pt of data.points) {
          const ptPx = scaleX(pt.x);
          const ptPy = scaleY(pt.y);
          const dist = Math.hypot(ptPx - px, ptPy - py);
          if (dist < minDist) {
            minDist = dist;
            closestPt = pt;
          }
        }
      }

      if (closestPt) {
        setHoverCoord({
          x: closestPt.x,
          y: closestPt.y,
          px: scaleX(closestPt.x),
          py: scaleY(closestPt.y),
        });
      } else {
        setHoverCoord({ x: xVal, y: yVal, px, py });
      }
    } else {
      setHoverCoord(null);
    }
  };

  const handlePointerLeave = () => {
    setHoverCoord(null);
  };

  const handleClick = () => {
    if (hoverCoord && data?.points) {
      const match = data.points.find(
        (p) => Math.hypot(scaleX(p.x) - hoverCoord.px, scaleY(p.y) - hoverCoord.py) < 14
      );
      setPinnedPoint(match || null);
    }
  };

  if (!data) return null;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      className="relative rounded-xl bg-black/35 border border-cyan-400/35 p-2 overflow-hidden shadow-2xl select-none my-1 flex flex-col justify-between"
      style={{ width: `${width}px`, minHeight: `${height}px` }}
    >
      {/* Title Header with interactive badge */}
      <div className="w-full text-xs font-bold handwritten-font text-amber-300 tracking-wider flex items-center justify-between px-1.5 border-b border-white/10 pb-1">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {data.title}
        </span>
        <span className="text-[10px] text-cyan-300/80 font-mono">
          Interactive Plot ({data.points.length} pts)
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full flex-1">
        <svg
          ref={svgRef}
          width={width}
          height={height - 38}
          className="w-full h-full pointer-events-none"
        />

        {/* Real-time Crosshair & Hover Tooltip */}
        {hoverCoord && (
          <>
            {/* Horizontal guide */}
            <div
              className="absolute pointer-events-none border-b border-dashed border-cyan-300/50"
              style={{
                left: `${padLeft}px`,
                width: `${plotW}px`,
                top: `${hoverCoord.py}px`,
              }}
            />
            {/* Vertical guide */}
            <div
              className="absolute pointer-events-none border-l border-dashed border-cyan-300/50"
              style={{
                left: `${hoverCoord.px}px`,
                top: `${padTop}px`,
                height: `${plotH}px`,
              }}
            />
            {/* Floating Coordinate Badge */}
            <div
              className="absolute pointer-events-none px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-400 text-cyan-200 font-mono text-[10px] shadow-lg -translate-x-1/2 -translate-y-8 backdrop-blur-sm"
              style={{ left: `${hoverCoord.px}px`, top: `${hoverCoord.py}px` }}
            >
              x: {hoverCoord.x.toFixed(2)}, y: {hoverCoord.y.toFixed(2)}
            </div>
          </>
        )}
      </div>

      {/* Axis Labels */}
      <span className="absolute bottom-9 right-3 text-[10px] font-bold handwritten-font text-white/70 pointer-events-none">
        {data.xLabel} →
      </span>
      <span className="absolute top-8 left-1 text-[10px] font-bold handwritten-font text-white/70 pointer-events-none">
        ↑ {data.yLabel}
      </span>

      {/* Real-time Interactive Parameter Scrubbing Slider */}
      <div className="w-full mt-1 px-1 flex items-center justify-between gap-2 border-t border-white/10 pt-1 text-[10px] text-cyan-200/90 font-mono">
        <span className="shrink-0 flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-300">
          Slope <span className="font-bold font-mono">k={slopeFactor.toFixed(1)}x</span>
        </span>
        <input
          type="range"
          min="0.2"
          max="2.5"
          step="0.1"
          value={slopeFactor}
          onChange={(e) => setSlopeFactor(parseFloat(e.target.value))}
          className="w-28 h-1 bg-cyan-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          title="Drag to dynamically adjust slope in real-time"
        />
        {pinnedPoint ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPinnedPoint(null);
            }}
            className="text-[9px] text-amber-300 hover:underline cursor-pointer"
          >
            Pinned ({pinnedPoint.x}, {pinnedPoint.y}) ✕
          </button>
        ) : (
          <span className="text-[9px] text-white/40">Hover/Click point</span>
        )}
      </div>
    </div>
  );
}
