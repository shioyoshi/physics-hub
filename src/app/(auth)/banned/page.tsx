"use client";
import { useRouter } from "next/navigation";
import { ShieldX, LogOut } from "lucide-react";
import { signOut } from "@/lib/firebase/auth";

export default function BannedPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <ShieldX className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">アカウント停止</h1>
        <p className="text-muted-foreground mb-6">あなたのアカウントは管理者により停止されています。</p>
        <button onClick={async () => { await signOut(); router.push("/login"); }} className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground mx-auto"><LogOut className="h-4 w-4" />ログアウト</button>
      </div>
    </div>
  );
}
