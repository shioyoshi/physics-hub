"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function EventDetailPage() {
  const router = useRouter();
  return (
    <div className="p-6">
      <button onClick={() => router.push("/events")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> イベント一覧
      </button>
      <p className="text-muted-foreground">イベント詳細はイベント一覧ページに統合されています。</p>
    </div>
  );
}