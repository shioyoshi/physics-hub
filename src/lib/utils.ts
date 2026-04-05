import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name.split(/[\s　]+/).map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2);
}

export function truncate(str: string, maxLength: number): string {
  return str.length <= maxLength ? str : str.slice(0, maxLength) + "...";
}

export function extractMentions(content: string): string[] {
  const regex = /@(\S+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) mentions.push(match[1]);
  return mentions;
}

export function parseWikiLinks(content: string): { text: string; pageName: string }[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: { text: string; pageName: string }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) links.push({ text: match[0], pageName: match[1] });
  return links;
}
