"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
import type { InlineActionState } from "@/features/commercial/lib/optimistic-interactions";

type TaskCompletionFeedback = InlineActionState | {
  status: "pending";
  message: string;
};

const initialFeedback: TaskCompletionFeedback = {
  status: "idle",
  message: "",
};

const TaskCompletionFeedbackContext = createContext<
  ((feedback: TaskCompletionFeedback) => void) | null
>(null);

export function useTaskCompletionFeedback() {
  const reportFeedback = useContext(TaskCompletionFeedbackContext);
  if (!reportFeedback) {
    throw new Error("TaskRow must be rendered within TaskCompletionBoundary.");
  }
  return reportFeedback;
}

export function TaskCompletionBoundary({ children }: { children: React.ReactNode }) {
  const [authoritativeFeedback, setAuthoritativeFeedback] = useState<TaskCompletionFeedback>(initialFeedback);
  const [feedback, setOptimisticFeedback] = useOptimistic<
    TaskCompletionFeedback,
    TaskCompletionFeedback
  >(authoritativeFeedback, (_current, next) => next);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const reportFeedback = useCallback((nextFeedback: TaskCompletionFeedback) => {
    if (nextFeedback.status === "pending") {
      setOptimisticFeedback(nextFeedback);
      return;
    }
    setAuthoritativeFeedback(nextFeedback);
  }, [setOptimisticFeedback]);

  useLayoutEffect(() => {
    if (feedback.status === "idle" || feedback.status === "pending") return;
    const currentFilter = document.querySelector<HTMLElement>(
      '[aria-label="Task filters"] [aria-current="page"]',
    );
    if (feedback.status === "success" || document.activeElement === document.body) {
      (currentFilter ?? statusRef.current)?.focus();
    }
  }, [feedback.status]);

  return (
    <TaskCompletionFeedbackContext.Provider value={reportFeedback}>
      <p
        ref={statusRef}
        tabIndex={-1}
        aria-live="polite"
        aria-atomic="true"
        className={feedback.status === "idle"
          ? "sr-only"
          : `mb-4 rounded-md border px-3 py-2 text-sm ${
            feedback.status === "error"
              ? "border-rose-200 bg-rose-50 font-medium text-rose-700"
              : "border-[#cfe7dc] bg-[#eff9f4] text-[#1d5b42]"
          }`}
      >
        {feedback.message}
      </p>
      {children}
    </TaskCompletionFeedbackContext.Provider>
  );
}
