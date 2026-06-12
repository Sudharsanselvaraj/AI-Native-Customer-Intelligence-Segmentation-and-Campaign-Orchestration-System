import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      style={{ background: "#F8FAFC", minHeight: "100vh" }}
    >
      <div
        className="w-12 h-12 rounded-[12px] flex items-center justify-center"
        style={{ background: "#EFF6FF" }}
      >
        <Search className="w-6 h-6" style={{ color: "#2563EB" }} />
      </div>
      <div className="text-center">
        <h2 className="text-[16px] font-semibold mb-1" style={{ color: "#111827" }}>
          Page not found
        </h2>
        <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-medium text-white"
        style={{ background: "#2563EB" }}
      >
        <Home className="w-4 h-4" />
        Back to Overview
      </Link>
    </div>
  );
}
