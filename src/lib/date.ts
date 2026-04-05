import { format, formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

const JST = "Asia/Tokyo";

export function toJST(date: Date | string | number): Date {
  return toZonedTime(new Date(date), JST);
}

export function formatJST(date: Date | string | number, formatStr = "yyyy/MM/dd HH:mm"): string {
  return format(toJST(date), formatStr, { locale: ja });
}

export function formatRelative(date: Date | string | number): string {
  return formatDistanceToNow(toJST(date), { addSuffix: true, locale: ja });
}

export function formatDateForInput(date: Date): string {
  return format(toJST(date), "yyyy-MM-dd'T'HH:mm");
}

export function isExpired(date: Date): boolean {
  return new Date(date) < new Date();
}
