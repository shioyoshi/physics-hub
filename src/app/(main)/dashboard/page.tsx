"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuthStore } from "@/stores/authStore";
import { formatRelative } from "@/lib/date";
import { Atom, Hash, BookOpen, Calendar, Package, BarChart3, MessageSquare } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({ channels: 0, wiki: 0, events: 0, inventory: 0, polls: 0 });

  useEffect(() => {
    async function loadStats() {
      const [ch, wp, ev, inv, po] = await Promise.all([
        getDocs(query(collection(db, "channels"), limit(500))),
        getDocs(query(collection(db, "wikiPages"), limit(500))),
        getDocs(query(collection(db, "events"), limit(500))),
        getDocs(query(collection(db, "inventory"), limit(500))),
        getDocs(query(collection(db, "polls"), limit(500))),
      ]);
      setStats({ channels: ch.size, wiki: wp.size, events: ev.size, inventory: inv.size, polls: po.size });
    }
    loadStats();
  }, []);

  const cards = [
    { icon: Hash, label: "チャンネル", count: stats.channels, href: "/channels", color: "text-blue-400" },
    { icon: BookOpen, label: "Wikiページ", count: stats.wiki, href: "/wiki", color: "text-green-400" },
    { icon: Calendar, label: "イベント", count: stats.events, href: "/events", color: "text-purple-400" },
    { icon: Package, label: "物品", count: stats.inventory, href: "/inventory", color: "text-orange-400" },
    { icon: BarChart3, label: "投票", count: stats.polls, href: "/polls", color: "text-pink-400" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">おかえりなさい、{user?.displayName} さん</h1>
        <p className="text-muted-foreground">海城物理部SNSへようこそ</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ icon: Icon, label, count, href, color }) => (
          <button key={href} onClick={() => router.push(href)} className="bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors text-left">
            <Icon className={`h-6 w-6 ${color} mb-2`} />
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
