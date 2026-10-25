"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/utils/api";

import { motion, AnimatePresence } from "framer-motion";

type AnimationElement = {
  id: string;
  type: "node" | "box" | "text" | string;
  label: string;
  x: number;
  y: number;
  highlight: boolean;
};

type AnimationFrame = {
  step: number;
  title: string;
  description: string;
  visual?: string; // fallback
  elements?: AnimationElement[];
};

type AnimationData = {
  topic: string;
  frames: AnimationFrame[];
};

export default function AnimationViewer({
  topicId,
  topicName,
}: {
  topicId: string;
  topicName?: string;
}) {
  const [data, setData] = useState<AnimationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const fetchAnimation = async () => {
      try {
        setLoading(true);
        const nameParam = topicName ? `&topic_name=${encodeURIComponent(topicName)}` : "";
        const res = await fetchWithAuth(`/api/tutor/animations?topic_id=${encodeURIComponent(topicId)}${nameParam}`);
        if (!res.ok) throw new Error("Failed to load animation");
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAnimation();
  }, [topicId, topicName]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && data && data.frames.length > 1) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= data.frames.length - 1) {
            return 0; // Loop back to start
          }
          return prev + 1;
        });
      }, 1500); // 1.5s per frame
    }
    return () => clearInterval(interval);
  }, [isPlaying, data]);

  if (loading) {
    return (
      <div className="w-full h-48 bg-surface-variant/30 rounded-xl animate-pulse flex items-center justify-center border border-outline-variant">
        <div className="flex flex-col items-center gap-2 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin">refresh</span>
          <span className="text-sm">Generating animation...</span>
        </div>
      </div>
    );
  }

  if (error || !data || data.frames.length === 0) {
    return (
      <div className="w-full p-4 bg-error/10 text-error rounded-xl border border-error/20 text-sm flex items-center gap-2">
        <span className="material-symbols-outlined">error</span>
        Failed to load animation: {error || "No data"}
      </div>
    );
  }

  const frame = data.frames[currentStep];

  return (
    <div className="w-full bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm my-4">
      {/* Header */}
      <div className="bg-surface-container-lowest border-b border-outline-variant px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-sm">animation</span>
          <span className="font-medium text-sm text-primary">{data.topic}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">
              {isPlaying ? "pause" : "play_arrow"}
            </span>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <span className="text-xs text-on-surface-variant bg-surface-variant px-2 py-0.5 rounded-full font-medium">
            Step {currentStep + 1} of {data.frames.length}
          </span>
        </div>
      </div>

      {/* Visual Content */}
      <div className="p-4 bg-[#1e1e1e] overflow-hidden min-h-[300px] relative transition-opacity duration-300 flex items-center justify-center">
        {frame.elements ? (
          <div className="relative w-full h-full min-h-[250px]">
            <AnimatePresence>
              {frame.elements.map((el) => (
                <motion.div
                  key={el.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    scale: el.highlight ? 1.1 : 1,
                    x: el.x * 60, 
                    y: el.y * 60 
                  }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 180, damping: 20 }}
                  className={`absolute flex items-center justify-center shadow-lg transition-colors duration-300 ${
                    el.type === "node" ? "w-12 h-12 rounded-full" : "w-12 h-12 rounded-xl"
                  } ${
                    el.highlight 
                      ? "bg-secondary text-on-primary border-2 border-primary shadow-secondary/30" 
                      : "bg-surface text-primary border border-outline"
                  }`}
                >
                  <span className="font-mono text-sm font-bold">{el.label}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <pre className="font-mono text-xs sm:text-sm text-[#d4d4d4] leading-relaxed overflow-x-auto w-full">
            {frame.visual}
          </pre>
        )}
      </div>

      {/* Description */}
      <div className="px-4 py-3 border-t border-outline-variant bg-surface-container-lowest min-h-[80px]">
        <h4 className="font-medium text-primary text-sm mb-1">{frame.title}</h4>
        <p className="text-on-surface-variant text-sm transition-opacity duration-300">{frame.description}</p>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-outline-variant">
        <button
          onClick={() => {
            setIsPlaying(false);
            setCurrentStep((prev) => Math.max(0, prev - 1));
          }}
          disabled={currentStep === 0}
          className="px-3 py-1.5 rounded flex items-center gap-1 text-sm font-medium disabled:opacity-30 hover:bg-surface-container-low transition-colors text-primary"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          Previous
        </button>
        
        <div className="flex gap-1">
          {data.frames.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setIsPlaying(false);
                setCurrentStep(i);
              }}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentStep ? "bg-secondary scale-125" : "bg-outline-variant"
              }`}
              title={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={() => {
            setIsPlaying(false);
            setCurrentStep((prev) => Math.min(data.frames.length - 1, prev + 1));
          }}
          disabled={currentStep === data.frames.length - 1}
          className="px-3 py-1.5 rounded flex items-center gap-1 text-sm font-medium disabled:opacity-30 hover:bg-surface-container-low transition-colors text-primary"
        >
          Next
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
