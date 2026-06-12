"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 overflow-y-auto min-w-0 scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
