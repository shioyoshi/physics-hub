"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.is_banned) router.replace("/banned");
    else if (!user.is_approved) router.replace("/pending");
    else router.replace("/dashboard");
  }, [user, loading, router]);

  return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
}
