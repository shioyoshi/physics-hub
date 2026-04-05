"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/stores/uiStore";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { sidebarOpen, sidebarCollapsed, setCommandPaletteOpen } = useUIStore();

  useKeyboardShortcut("k", () => setCommandPaletteOpen(true), { metaKey: true });
  useKeyboardShortcut("k", () => setCommandPaletteOpen(true), { ctrlKey: true });

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.is_banned) router.replace("/banned");
    else if (!user.is_approved) router.replace("/pending");
  }, [user, loading, router]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  if (!user || !user.is_approved) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-200", sidebarOpen && !sidebarCollapsed && "md:ml-64", sidebarOpen && sidebarCollapsed && "md:ml-16")}>
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
