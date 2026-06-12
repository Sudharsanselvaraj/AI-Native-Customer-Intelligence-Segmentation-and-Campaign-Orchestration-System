"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4"
      style={{ background: "#F8FAFC", minHeight: "100vh" }}
    >
      <div
        className="w-12 h-12 rounded-[12px] flex items-center justify-center"
        style={{ background: "#FEF2F2" }}
      >
        <AlertTriangle className="w-6 h-6" style={{ color: "#DC2626" }} />
      </div>
      <div className="text-center">
        <h2 className="text-[16px] font-semibold mb-1" style={{ color: "#111827" }}>
          Something went wrong
        </h2>
        <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
          {error.message || "An unexpected error occurred"}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-medium text-white"
        style={{ background: "#2563EB" }}
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
