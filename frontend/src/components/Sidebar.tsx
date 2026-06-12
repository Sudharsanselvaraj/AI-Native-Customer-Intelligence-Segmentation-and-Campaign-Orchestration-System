"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ShoppingBag, Target, Megaphone,
  BarChart3, Sparkles, Crosshair, Activity,
  ChevronLeft, ChevronRight, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_PLATFORM = [
  { href: "/app",       label: "Overview",   icon: LayoutDashboard },
  { href: "/customers", label: "Customers",  icon: Users },
  { href: "/orders",    label: "Orders",     icon: ShoppingBag },
  { href: "/segments",  label: "Segments",   icon: Target },
  { href: "/campaigns", label: "Campaigns",  icon: Megaphone },
  { href: "/analytics", label: "Analytics",  icon: BarChart3 },
];

const NAV_AI = [
  { href: "/ai-copilot",      label: "AI Copilot",     icon: Sparkles,  dot: true  },
  { href: "/mission-control", label: "Mission Control", icon: Crosshair, dot: false },
  { href: "/predictions",     label: "Predictions",     icon: Activity,  dot: false },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

function NavItem({
  href, label, icon: Icon, active, collapsed, dot
}: {
  href: string; label: string; icon: any;
  active: boolean; collapsed: boolean; dot?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center text-[13px] font-medium transition-all duration-150 group rounded-[6px]",
        collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2.5 px-3 py-2"
      )}
      style={active
        ? { background: "#2563EB", color: "#FFFFFF" }
        : { color: "#374151" }
      }
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#EFF6FF"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div className="relative shrink-0">
        <Icon className="w-[16px] h-[16px]" />
        {dot && (
          <span
            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
            style={{
              background: "#22C55E",
              border: active ? "1.5px solid #2563EB" : "1.5px solid #fff",
            }}
          />
        )}
      </div>
      <span
        className="sidebar-label"
        style={{ maxWidth: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1 }}
      >
        {label}
      </span>
      {/* Tooltip when collapsed */}
      {collapsed && (
        <span
          className="absolute left-full ml-2 px-2.5 py-1.5 rounded-[6px] text-[12px] font-medium
                     pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-[200] whitespace-nowrap"
          style={{
            background: "#111827",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const path = usePathname();

  return (
    <aside
      className="sidebar-w flex flex-col h-full shrink-0"
      style={{
        width: collapsed ? 56 : 260,
        background: "#FFFFFF",
        borderRight: "1px solid #E5E7EB",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-[72px] px-4 shrink-0 overflow-hidden"
        style={{ borderBottom: "1px solid #E5E7EB" }}
      >
        <img
          src="/aster-logo.png"
          alt="AsterCRM"
          className="shrink-0"
          style={{ width: 32, height: 32, objectFit: "contain" }}
        />
        <div
          className="sidebar-label ml-3"
          style={{ maxWidth: collapsed ? 0 : 160, opacity: collapsed ? 0 : 1 }}
        >
          <div className="text-[15px] font-semibold" style={{ color: "#111827", letterSpacing: "-0.02em" }}>
            AsterCRM
          </div>
          <div className="text-[10px] font-semibold tracking-[0.1em]" style={{ color: "#2563EB" }}>
            ENTERPRISE
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-none space-y-0.5">
        {/* Platform section */}
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 pb-2 pt-1" style={{ color: "#9CA3AF" }}>
            Platform
          </p>
        )}
        {collapsed && <div className="h-2" />}

        {NAV_PLATFORM.map(({ href, label, icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={href === "/app" ? path === "/app" : path.startsWith(href)}
            collapsed={collapsed}
          />
        ))}

        {/* AI section */}
        <div
          className="my-3"
          style={{ borderTop: "1px solid #F3F4F6" }}
        />
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] px-2 pb-2" style={{ color: "#9CA3AF" }}>
            AI Features
          </p>
        )}

        {NAV_AI.map(({ href, label, icon, dot }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={icon}
            dot={dot}
            active={path.startsWith(href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-3 pb-4 shrink-0"
        style={{ borderTop: "1px solid #F3F4F6" }}
      >
        {!collapsed && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-[6px] mb-2 mt-3"
            style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
              style={{ background: "#22C55E" }}
            />
            <span className="text-[11px]" style={{ color: "#9CA3AF" }}>Claude AI · Connected</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand" : "Collapse"}
          className={cn(
            "flex items-center rounded-[6px] text-[12px] transition-all mt-1",
            collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2 px-3 py-2 w-full"
          )}
          style={{ color: "#9CA3AF" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "#F3F4F6";
            (e.currentTarget as HTMLElement).style.color = "#6B7280";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#9CA3AF";
          }}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
}
