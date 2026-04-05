"use client";
import { useRouter } from "next/navigation";
import { useInventory } from "@/hooks/useInventory";
import { INVENTORY_CATEGORIES, ITEM_CONDITIONS } from "@/lib/constants";
import { formatRelative } from "@/lib/date";
import { Package, Plus, Search, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const router = useRouter();
  const { items, loading, categoryFilter, setCategoryFilter, searchTerm, setSearchTerm } = useInventory();

  const conditionColors: Record<string, string> = { excellent: "text-green-400", good: "text-blue-400", fair: "text-yellow-400", poor: "text-orange-400", broken: "text-red-400" };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">物品管理</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push("/inventory/scan")} className="flex items-center gap-2 bg-secondary text-foreground px-3 py-2 rounded-lg text-sm">
            <QrCode className="h-4 w-4" /> スキャン
          </button>
          <button onClick={() => router.push("/inventory/new")} className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" /> 新規登録
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="名前、場所、バーコード、タグで検索..."
            className="w-full bg-secondary text-foreground pl-9 pr-4 py-2 rounded-lg text-sm outline-none" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="bg-secondary text-foreground px-3 py-2 rounded-lg text-sm outline-none">
          <option value="all">すべてのカテゴリ</option>
          {INVENTORY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-muted-foreground">読み込み中...</p> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const catLabel = INVENTORY_CATEGORIES.find((c) => c.value === item.category)?.label || item.category;
            const condLabel = ITEM_CONDITIONS.find((c) => c.value === item.condition)?.label || item.condition;
            return (
              <button key={item.id} onClick={() => router.push(`/inventory/${item.id}`)} className="text-left bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{item.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                  </div>
                  {item.imageUrl && <img src={item.imageUrl} alt="" className="h-12 w-12 rounded object-cover ml-2 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="bg-secondary px-1.5 py-0.5 rounded">{catLabel}</span>
                  <span className={conditionColors[item.condition] || ""}>{condLabel}</span>
                  <span>数量: {item.quantity}</span>
                  <span>{item.location}</span>
                </div>
                {item.barcode && <p className="text-[10px] text-muted-foreground mt-1 font-mono">BC: {item.barcode}</p>}
              </button>
            );
          })}
        </div>
      )}
      {!loading && items.length === 0 && <div className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2" /><p>物品が見つかりません</p></div>}
    </div>
  );
}
