"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useInventory } from "@/hooks/useInventory";
import { uploadInventoryImage } from "@/lib/firebase/storage";
import { INVENTORY_CATEGORIES, ITEM_CONDITIONS } from "@/lib/constants";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export default function InventoryNewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addItem, addLog } = useInventory();
  const [form, setForm] = useState({ name: "", description: "", category: "equipment" as const, quantity: 1, location: "", condition: "good" as const, barcode: "", tags: "", notes: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) imageUrl = await uploadInventoryImage(imageFile, Date.now().toString());

      await addItem({
        name: form.name.trim(), description: form.description.trim(), category: form.category,
        quantity: form.quantity, location: form.location.trim(), condition: form.condition,
        barcode: form.barcode.trim() || null, imageUrl,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: form.notes.trim(), lastCheckedBy: user.uid, lastCheckedAt: new Date(),
        registeredBy: user.uid, registeredByName: user.displayName,
      });
      toast.success("物品を登録しました");
      router.push("/inventory");
    } catch { toast.error("登録に失敗しました"); } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.push("/inventory")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 物品一覧</button>
      <h1 className="text-2xl font-bold mb-6">物品登録</h1>
      <div className="space-y-4">
        <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="物品名 *" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
        <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="説明" rows={2} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none resize-none" />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value as any})} className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none">
            {INVENTORY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={form.condition} onChange={(e) => setForm({...form, condition: e.target.value as any})} className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none">
            {ITEM_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">数量</label><input type="number" value={form.quantity} onChange={(e) => setForm({...form, quantity: parseInt(e.target.value) || 0})} min={0} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" /></div>
          <input type="text" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} placeholder="保管場所" className="bg-secondary text-foreground px-4 py-2 rounded-lg outline-none mt-auto" />
        </div>
        <input type="text" value={form.barcode} onChange={(e) => setForm({...form, barcode: e.target.value})} placeholder="バーコード（任意）" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none font-mono" />
        <input type="text" value={form.tags} onChange={(e) => setForm({...form, tags: e.target.value})} placeholder="タグ（カンマ区切り）" className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none" />
        <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="備考" rows={2} className="w-full bg-secondary text-foreground px-4 py-2 rounded-lg outline-none resize-none" />
        <ImageUpload onFileSelect={(f) => { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }} onClear={() => { setImageFile(null); setImagePreview(""); }} previewUrl={imagePreview} />
        <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "登録中..." : "登録"}</button>
      </div>
    </div>
  );
}
