"use client";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Users, Shield, Hash, KeyRound, CheckCircle } from "lucide-react";

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  if (user?.role !== "admin") return <div className="p-6 text-destructive">アクセス権限がありません。</div>;

  const items = [
    { icon: Users, label: "ユーザー管理", desc: "ロール変更、BAN/ミュート", href: "/admin/users" },
    { icon: Shield, label: "ロール管理", desc: "カスタムロール作成・編集", href: "/admin/roles" },
    { icon: Hash, label: "チャンネル管理", desc: "アーカイブ・削除", href: "/admin/channels" },
    { icon: KeyRound, label: "招待コード", desc: "発行・使用状況確認", href: "/admin/invites" },
    { icon: CheckCircle, label: "承認リクエスト", desc: "承認待ちの処理", href: "/admin/approvals" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">管理者パネル</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, label, desc, href }) => (
          <button key={href} onClick={() => router.push(href)} className="text-left bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
            <Icon className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">{label}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
