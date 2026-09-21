"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { HELP_TOPICS, type HelpTopicId } from "@/lib/help/topics";
import { cn } from "@/lib/utils";

const OPEN_EVENT = "schedmaker:helptip";
const PANEL_WIDTH = 288;

export function HelpTip({
  topic,
  tone = "default",
  align = "start",
  className,
}: {
  topic: HelpTopicId;
  tone?: "default" | "onDark";
  align?: "start" | "end";
  className?: string;
}) {
  const item = HELP_TOPICS[topic];
  const reactId = useId();
  const panelId = `help-${reactId.replace(/:/g, "")}`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  function placePanel() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const margin = 8;
    const maxLeft = window.innerWidth - PANEL_WIDTH - margin;
    let left = align === "end" ? rect.right - PANEL_WIDTH : rect.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, maxLeft));
    const below = rect.bottom + 6;
    const panelHeight = panelRef.current?.offsetHeight ?? 160;
    const top =
      below + panelHeight > window.innerHeight - margin
        ? Math.max(margin, rect.top - panelHeight - 6)
        : below;
    setCoords((current) =>
      current.top === top && current.left === left ? current : { top, left },
    );
  }

  useEffect(() => {
    function onOther(event: Event) {
      if ((event as CustomEvent<string>).detail !== panelId) setOpen(false);
    }
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [panelId]);

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    const frame = requestAnimationFrame(placePanel);
    return () => cancelAnimationFrame(frame);
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      placePanel();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, align]);

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !open;
    setOpen(next);
    if (next) {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: panelId }));
    }
  }

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full",
          tone === "onDark"
            ? "text-white/80 hover:bg-white/10 hover:text-white"
            : "text-muted hover:bg-black/5 hover:text-ink",
        )}
        aria-label={`About ${item.title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={item.title}
              className="fixed z-50 w-72 rounded-lg border border-border bg-white p-3 text-left shadow-lg"
              style={{ top: coords.top, left: coords.left }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
