"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/utils/api";

interface FeedbackModalProps {
  messageCount: number;
  isOpen?: boolean;
  onClose?: () => void;
}

const STORAGE_KEY = "guiedteach_feedback_submitted";
const DISMISS_KEY = "guiedteach_feedback_dismissed_at";

export default function FeedbackModal({
  messageCount,
  isOpen: forceOpen,
  onClose,
}: FeedbackModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const tags = [
    "Chalkboard visuals",
    "Clear explanations",
    "Voice & pacing",
    "Mobile layout",
    "Diagram accuracy",
    "Interactive quizzes",
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
      return;
    }

    // Check if user already submitted feedback
    const alreadySubmitted = localStorage.getItem(STORAGE_KEY);
    if (alreadySubmitted === "true") return;

    // Check if dismissed recently (within 24 hours)
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const hoursSinceDismiss = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60);
      if (hoursSinceDismiss < 24) return;
    }

    // Trigger condition: user has had at least 3 AI turns in the session
    if (messageCount >= 3) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [messageCount, forceOpen]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleDismiss = () => {
    setIsOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
    onClose?.();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      rating,
      tags: selectedTags,
      comment: comment.trim(),
      timestamp: new Date().toISOString(),
      platform: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop",
    };

    try {
      // Fire-and-forget to backend feedback endpoint
      await fetch(`${API_URL}/api/tutor/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Graceful silent fallback if endpoint is not registered
      });
    } catch {
      // Ignore network errors
    } finally {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "true");
      }
      setSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        onClose?.();
      }, 2500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-5 right-5 z-50 w-full max-w-2xl sm:max-w-2xl p-5 rounded-2xl bg-surface/95 dark:bg-[#141b26]/95 backdrop-blur-xl border border-outline-variant shadow-2xl text-on-surface select-none"
        >
          {submitted ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-6 text-center space-y-2"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <h3 className="font-bold text-base text-primary">Thank you for your feedback!</h3>
              <p className="text-xs text-on-surface-variant">
                Your input directly helps us make lessons and chalkboard visuals even better.
              </p>
            </motion.div>
          ) : (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-lg">rate_review</span>
                  <h3 className="font-bold text-sm text-primary">How is your lesson going?</h3>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-on-surface-variant/70 hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors"
                  title="Close"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
                {/* 5-Star Rating */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 text-2xl transition-transform hover:scale-125 active:scale-95 focus:outline-none"
                      title={`${star} Star${star > 1 ? "s" : ""}`}
                    >
                      <span
                        className={`material-symbols-outlined ${
                          star <= rating
                            ? "text-amber-400 fill-amber-400"
                            : "text-neutral-400 dark:text-neutral-600"
                        }`}
                        style={{ fontVariationSettings: star <= rating ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                    </button>
                  ))}
                </div>

                {/* Sentiment Tags */}
                <div>
                  <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">
                    What stood out most?
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            isSelected
                              ? "bg-secondary text-on-secondary border-secondary font-medium shadow-xs"
                              : "bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-secondary/50"
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Comment */}
                <div>
                  <textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Any quick thoughts or suggestions? (optional)"
                    className="w-full text-xs rounded-xl bg-surface-container-lowest border border-outline-variant p-2.5 text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-secondary resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-xs text-on-surface-variant hover:text-on-surface px-2 py-1"
                  >
                    Maybe later
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md"
                  >
                    {submitting ? "Sending..." : "Submit Feedback"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
