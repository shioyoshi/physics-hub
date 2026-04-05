"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function PollDetailPage() {
  const router = useRouter();
  return (
    <div className="p-6">
      <button onClick={() => router.push("/polls")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> 投票一覧
      </button>
      <p className="text-muted-foreground">投票詳細は投票一覧ページに統合されています。</p>
    </div>
  );
}
