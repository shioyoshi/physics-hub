"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ArrowLeft, Camera, Search } from "lucide-react";
import { toast } from "sonner";

export default function InventoryScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const searchByBarcode = async (code: string) => {
    const snap = await getDocs(query(collection(db, "inventory"), where("barcode", "==", code)));
    if (!snap.empty) {
      router.push(`/inventory/${snap.docs[0].id}`);
    } else {
      toast.error(`バーコード「${code}」に一致する物品が見つかりません`);
    }
  };

  const startScan = async () => {
    setScanning(true);
    try {
      const Quagga = (await import("@ericblade/quagga2")).default;
      if (!videoRef.current) return;
      Quagga.init({
        inputStream: { type: "LiveStream", target: videoRef.current, constraints: { facingMode: "environment" } },
        decoder: { readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader"] },
      }, (err: any) => {
        if (err) { console.error(err); toast.error("カメラを起動できませんでした"); setScanning(false); return; }
        Quagga.start();
      });
      Quagga.onDetected((data: any) => {
        const code = data.codeResult.code;
        setResult(code);
        Quagga.stop();
        setScanning(false);
        searchByBarcode(code);
      });
    } catch (e) { console.error(e); toast.error("バーコードスキャナーの初期化に失敗しました"); setScanning(false); }
  };

  useEffect(() => {
    return () => {
      import("@ericblade/quagga2").then((m) => { try { m.default.stop(); } catch {} });
    };
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => router.push("/inventory")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> 物品一覧</button>
      <h1 className="text-2xl font-bold mb-6">バーコードスキャン</h1>

      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Camera className="h-5 w-5" />カメラスキャン</h2>
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-3">
            <video ref={videoRef} className="w-full h-full object-cover" />
            {!scanning && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-muted-foreground">カメラ待機中</div>}
          </div>
          <button onClick={startScan} disabled={scanning} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {scanning ? "スキャン中..." : "スキャン開始"}
          </button>
          {result && <p className="mt-2 text-sm">検出: <span className="font-mono text-primary">{result}</span></p>}
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Search className="h-5 w-5" />手動入力</h2>
          <div className="flex gap-2">
            <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="バーコード番号を入力"
              className="flex-1 bg-secondary text-foreground px-4 py-2 rounded-lg outline-none font-mono"
              onKeyDown={(e) => { if (e.key === "Enter" && manualCode.trim()) searchByBarcode(manualCode.trim()); }} />
            <button onClick={() => manualCode.trim() && searchByBarcode(manualCode.trim())} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm">検索</button>
          </div>
        </div>
      </div>
    </div>
  );
}
