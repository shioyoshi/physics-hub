import { cn, getInitials } from "@/lib/utils";

export function UserAvatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "h-6 w-6 text-xs", md: "h-8 w-8 text-sm", lg: "h-10 w-10 text-base" };
  const colors = ["bg-blue-600","bg-green-600","bg-purple-600","bg-orange-600","bg-pink-600","bg-teal-600","bg-indigo-600","bg-red-600"];
  const ci = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return <div className={cn("rounded-full flex items-center justify-center font-semibold text-white shrink-0", s[size], colors[ci], className)}>{getInitials(name)}</div>;
}
