import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatPercent(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  email: "#4F46E5",
  sms: "#F59E0B",
  rcs: "#EF4444",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  running: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};
