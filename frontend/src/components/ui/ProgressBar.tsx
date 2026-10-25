"use client";

import React from 'react';

export type ProgressBarVariant = 'linear' | 'circular';

export interface ProgressBarProps {
  variant?: ProgressBarVariant;
  progress: number; // 0 to 100
  className?: string;
  size?: number; // for circular
  strokeWidth?: number; // for circular
}

export function ProgressBar({
  variant = 'linear',
  progress,
  className = '',
  size = 48,
  strokeWidth = 4,
}: ProgressBarProps) {
  const safeProgress = Math.min(100, Math.max(0, progress));

  if (variant === 'circular') {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

    return (
      <div 
        className={`relative inline-flex items-center justify-center ${className}`} 
        style={{ width: size, height: size }}
      >
        <svg className="transform -rotate-90 w-full h-full">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-surface-variant"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-primary transition-all duration-500 ease-in-out"
            strokeLinecap="round"
          />
        </svg>
        {/* Optional text centered in circular progress could be added here if passed as children */}
      </div>
    );
  }

  // Linear
  return (
    <div className={`w-full bg-surface-variant rounded-full h-2 overflow-hidden ${className}`}>
      <div
        className="bg-primary h-full rounded-full transition-all duration-500 ease-in-out"
        style={{ width: `${safeProgress}%` }}
      />
    </div>
  );
}
