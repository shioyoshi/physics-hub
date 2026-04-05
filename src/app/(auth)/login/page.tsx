"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Atom } from "lucide-react";
import { signInWithGoogle } from "@/lib/firebase/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user.is_banned) router.push("/banned");
      else if (!user.is_approved) router.push("/pending");
      else router.push("/dashboard");
    } catch { toast.error("ログインに失敗しました。学校のGoogleアカウントでログインしてください。"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full">
        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
            <Atom className="h-10 w-10 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold">PhysicsHub</h1>
          <p className="text-muted-foreground mt-2">海城中学高等学校 物理部SNS</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <button onClick={handleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {loading ? "ログイン中..." : "Googleでログイン"}
          </button>
          <p className="text-center text-xs text-muted-foreground">学校のGoogleアカウント（@stu.kaijo.ed.jp / @gfe.kaijo.ed.jp）でログインすると自動承認されます</p>
        </div>
      </motion.div>
    </div>
  );
}
