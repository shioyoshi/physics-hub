"use client";
import { useRouter } from "next/navigation";
import { Hash, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function ChannelsPage() {
  const router = useRouter();
  return (
    <div className="p-6">
      <EmptyState icon={Hash} title="チャンネルを選択" description="サイドバーからチャンネルを選択するか、新しいチャンネルを作成してください。" />
    </div>
  );
}
