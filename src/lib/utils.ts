import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(iso: string, locale = navigator.language): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ""
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return locale.startsWith("zh") ? "刚刚" : "just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return locale.startsWith("zh") ? `${diffMin}分钟前` : `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return locale.startsWith("zh") ? `${diffHr}小时前` : `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return locale.startsWith("zh") ? `${diffDay}天前` : `${diffDay}d ago`
  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) return locale.startsWith("zh") ? `${diffMonth}个月前` : `${diffMonth}mo ago`
  const diffYear = Math.floor(diffMonth / 12)
  return locale.startsWith("zh") ? `${diffYear}年前` : `${diffYear}y ago`
}
