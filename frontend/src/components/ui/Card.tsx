"use client";

import React from 'react';

export type CardVariant = 'content' | 'stat' | 'action';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
  className?: string;
}

export function Card({ 
  variant = 'content', 
  children, 
  className = '', 
  ...props 
}: CardProps) {
  const baseClasses = 'rounded-2xl transition-all duration-300 overflow-hidden';
  
  const variants = {
    content: 'bg-surface border border-outline-variant/30 shadow-sm hover:shadow-md p-6',
    stat: 'bg-surface-container-low border border-outline-variant/20 shadow-sm p-4 flex flex-col',
    action: 'bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-1 p-6'
  };

  return (
    <div 
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
