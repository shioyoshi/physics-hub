"use client";
import { useEffect } from "react";

export function useKeyboardShortcut(
  key: string, callback: () => void, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = (opts.ctrlKey && e.ctrlKey) || (opts.metaKey && e.metaKey);
      if (e.key.toLowerCase() === key.toLowerCase() && mod) { e.preventDefault(); callback(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, opts.ctrlKey, opts.metaKey]);
}
