"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ShoppingBag, Target,
  Megaphone, BarChart3, Sparkles, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/segments", label: "Segments", icon: Target },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/ai-copilot", label: "AI Copilot", icon: Sparkles },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-full shrink-0">
      <div className="px-6 py-5 border-b border-slate-700 flex items-center gap-2">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-white font-semibold text-sm leading-none">ShopperReach</div>
          <div className="text-slate-400 text-xs mt-0.5">AI CRM</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-slate-700">
        <div className="text-xs text-slate-500">Powered by Claude AI</div>
      </div>
    </aside>
  );
}
