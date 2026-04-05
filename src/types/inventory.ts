export type InventoryCategory = "equipment" | "tool" | "material" | "book" | "document" | "other";
export type ItemCondition = "excellent" | "good" | "fair" | "poor" | "broken";

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  category: InventoryCategory;
  quantity: number;
  location: string;
  condition: ItemCondition;
  barcode: string | null;
  imageUrl: string | null;
  tags: string[];
  notes: string;
  lastCheckedBy: string | null;
  lastCheckedAt: Date | null;
  registeredBy: string;
  registeredByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryLog {
  id: string;
  itemId: string;
  action: "create" | "update" | "checkout" | "return" | "dispose";
  userId: string;
  userName: string;
  details: string;
  quantityChange: number;
  createdAt: Date;
}
