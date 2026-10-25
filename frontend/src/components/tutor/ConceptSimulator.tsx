"use client";

import { useState } from "react";

interface ConceptSimulatorProps {
  topic: string;
  type: string; // e.g., "linear_equation", "projectile"
}

export default function ConceptSimulator({ topic, type }: ConceptSimulatorProps) {
  // A simple generic simulator based on type
  const [param1, setParam1] = useState(1);
  const [param2, setParam2] = useState(0);

  return (
    <div className="w-full my-4 border border-outline-variant rounded-xl overflow-hidden bg-surface shadow-sm">
      <div className="bg-surface-container-lowest border-b border-outline-variant px-4 py-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary text-[20px]">science</span>
        <span className="font-medium text-sm text-primary">Interactive Simulator: {topic}</span>
      </div>
      
      <div className="p-4 bg-surface-container-lowest">
        {type === "linear_equation" && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-xs text-on-surface-variant font-medium flex justify-between">
                  <span>Slope (m)</span>
                  <span>{param1}</span>
                </label>
                <input 
                  type="range" min="-5" max="5" step="0.5" 
                  value={param1} onChange={(e) => setParam1(parseFloat(e.target.value))}
                  className="w-full accent-secondary"
                />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant font-medium flex justify-between">
                  <span>Y-Intercept (b)</span>
                  <span>{param2}</span>
                </label>
                <input 
                  type="range" min="-10" max="10" step="1" 
                  value={param2} onChange={(e) => setParam2(parseFloat(e.target.value))}
                  className="w-full accent-secondary"
                />
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center bg-surface border border-outline-variant rounded-lg p-4 h-48 relative overflow-hidden">
              <h4 className="font-mono text-lg font-medium text-primary z-10 bg-surface/80 px-2 py-1 rounded">
                y = {param1}x {param2 >= 0 ? "+" : "-"} {Math.abs(param2)}
              </h4>
              <div className="absolute inset-0 opacity-10 pointer-events-none" 
                   style={{
                     backgroundImage: "linear-gradient(to right, #888 1px, transparent 1px), linear-gradient(to bottom, #888 1px, transparent 1px)",
                     backgroundSize: "20px 20px"
                   }}
              />
              {/* Fake Graph Line */}
              <div 
                className="absolute w-[150%] h-0.5 bg-secondary origin-center"
                style={{ 
                  transform: `translateY(${-param2 * 5}px) rotate(${-Math.atan(param1) * (180/Math.PI)}deg)`
                }}
              />
            </div>
          </div>
        )}

        {type !== "linear_equation" && (
          <div className="flex flex-col items-center justify-center h-48 bg-surface-variant/20 rounded-lg border border-outline-variant border-dashed">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-2">construction</span>
            <p className="text-sm text-on-surface-variant">Simulator for <strong>{topic}</strong> is under construction.</p>
          </div>
        )}
      </div>
    </div>
  );
}
