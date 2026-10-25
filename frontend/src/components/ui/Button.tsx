"use client";

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
}

export function Button({ 
  variant = 'primary', 
  children, 
  className = '', 
  ...props 
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-label-md rounded-full transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary';
  
  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-on-surface hover:text-surface shadow-sm hover:shadow-md hover:-translate-y-0.5 px-6 py-2.5',
    secondary: 'bg-secondary text-on-secondary hover:bg-secondary-container hover:text-on-secondary-container shadow-sm hover:shadow-md hover:-translate-y-0.5 px-6 py-2.5',
    ghost: 'bg-transparent text-primary hover:bg-surface-variant px-6 py-2.5',
    icon: 'bg-transparent text-on-surface hover:bg-surface-variant p-2 rounded-full flex-shrink-0'
  };

  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
