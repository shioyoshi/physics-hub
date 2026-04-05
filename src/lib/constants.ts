export const APP_NAME = "PhysicsHub";
export const APP_DESCRIPTION = "海城中学高等学校 物理部SNS";

export const CHANNEL_CATEGORIES = [
  { value: "general", label: "一般" },
  { value: "project", label: "プロジェクト" },
  { value: "topic", label: "トピック" },
  { value: "announcement", label: "お知らせ" },
] as const;

export const EVENT_TYPES = [
  { value: "meeting", label: "ミーティング" },
  { value: "practice", label: "実験・実習" },
  { value: "competition", label: "大会" },
  { value: "other", label: "その他" },
] as const;

export const POLL_TYPES = [
  { value: "single", label: "単一選択" },
  { value: "multiple", label: "複数選択" },
  { value: "ranked", label: "順位付け" },
] as const;

export const INVENTORY_CATEGORIES = [
  { value: "equipment", label: "実験器具" },
  { value: "tool", label: "工具" },
  { value: "material", label: "材料・消耗品" },
  { value: "book", label: "書籍" },
  { value: "document", label: "資料" },
  { value: "other", label: "その他" },
] as const;

export const ITEM_CONDITIONS = [
  { value: "excellent", label: "非常に良い" },
  { value: "good", label: "良い" },
  { value: "fair", label: "普通" },
  { value: "poor", label: "悪い" },
  { value: "broken", label: "故障" },
] as const;

export const RSVP_OPTIONS = [
  { value: "going", label: "参加", color: "text-green-400" },
  { value: "maybe", label: "未定", color: "text-yellow-400" },
  { value: "not_going", label: "不参加", color: "text-red-400" },
] as const;

export const COMMON_REACTIONS = ["👍", "👎", "❤️", "😂", "😮", "🎉", "🤔", "👀", "🔥", "✅"];
