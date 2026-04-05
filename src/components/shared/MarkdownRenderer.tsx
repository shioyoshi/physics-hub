"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";

export function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  const router = useRouter();
  const processed = content.replace(/\[\[([^\]]+)\]\]/g, (_, p) => `[${p}](/wiki?search=${encodeURIComponent(p)})`);
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({ href, children }) => {
          if (href?.startsWith("/")) return <a href={href} className="wiki-link" onClick={(e) => { e.preventDefault(); router.push(href); }}>{children}</a>;
          return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{children}</a>;
        },
      }}>{processed}</ReactMarkdown>
    </div>
  );
}
