"use client";
import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { COMMON_REACTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function EmojiPicker({ onSelect, className }: { onSelect: (e: string) => void; className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className={cn("relative", className)} ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Smile className="h-4 w-4" /></button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 bg-card border border-border rounded-lg p-3 shadow-xl z-50 min-w-[220px]">
          <div className="grid grid-cols-5 gap-1 mb-2">{COMMON_REACTIONS.map((e) => <button key={e} onClick={() => { onSelect(e); setIsOpen(false); }} className="text-xl p-1 rounded hover:bg-secondary">{e}</button>)}</div>
          <div className="border-t border-border pt-2"><form onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { onSelect(custom.trim()); setCustom(""); setIsOpen(false); } }} className="flex gap-1">
            <input type="text" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="絵文字を入力..." className="flex-1 bg-secondary text-foreground text-sm px-2 py-1 rounded outline-none" />
            <button type="submit" className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">追加</button>
          </form></div>
        </div>
      )}
    </div>
  );
}
