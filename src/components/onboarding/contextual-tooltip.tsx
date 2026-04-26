"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ContextualTooltipProps {
  targetRef: React.RefObject<HTMLElement | null>;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  show: boolean;
  onDismiss: () => void;
}

export default function ContextualTooltip({
  targetRef,
  content,
  side = "bottom",
  show,
  onDismiss,
}: ContextualTooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show || !targetRef.current) return;

    const updatePosition = () => {
      const target = targetRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (side) {
        case "bottom":
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2;
          break;
        case "top":
          top = rect.top - 8;
          left = rect.left + rect.width / 2;
          break;
        case "right":
          top = rect.top + rect.height / 2;
          left = rect.right + 8;
          break;
        case "left":
          top = rect.top + rect.height / 2;
          left = rect.left - 8;
          break;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [show, targetRef, side]);

  if (!show) return null;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[60] animate-fade-in"
      style={{
        top: position.top,
        left: position.left,
        transform: side === "bottom" ? "translateX(-50%)" : side === "top" ? "translate(-50%, -100%)" : side === "right" ? "translateY(-50%)" : "translate(-100%, -50%)",
      }}
    >
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 backdrop-blur-sm px-3 py-2 shadow-lg">
        <span className="text-xs font-medium text-primary whitespace-nowrap">{content}</span>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-primary/50 hover:text-primary transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
