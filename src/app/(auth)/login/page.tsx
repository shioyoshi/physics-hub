"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Atom } from "lucide-react";
import {
  signInWithGoogle,
  handleRedirectResult,
} from "@/lib/firebase/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      try {
        const user = await handleRedirectResult();

        if (!user) return;

        if (user.is_banned) router.replace("/banned");
        else if (!user.is_approved) router.replace("/pending");
        else router.replace("/dashboard");
      } catch (error) {
        console.error(error);
      }
    };

    init();
  }, [router]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch {
      toast.error(
        "ログインに失敗しました。学校のGoogleアカウントでログインしてください。"
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4"
          >
            <Atom className="h-10 w-10 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold">PhysicsHub</h1>
          <p className="text-muted-foreground mt-2">
            海城中学高等学校 物理部SNS
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "Googleでログイン"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            学校のGoogleアカウント（@stu.kaijo.ed.jp /
            @gfe.kaijo.ed.jp）でログインすると自動承認されます
          </p>
        </div>
      </motion.div>
    </div>
  );
}