"use client";
import { useEffect, useState } from "react";
import { getOrders } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Fashion: "bg-pink-100 text-pink-700",
  Beauty: "bg-rose-100 text-rose-700",
  Coffee: "bg-amber-100 text-amber-700",
  Electronics: "bg-blue-100 text-blue-700",
  "Home & Living": "bg-teal-100 text-teal-700",
  Sports: "bg-green-100 text-green-700",
  Books: "bg-indigo-100 text-indigo-700",
  Wellness: "bg-purple-100 text-purple-700",
  "Food & Beverage": "bg-orange-100 text-orange-700",
  Jewellery: "bg-yellow-100 text-yellow-700",
};

export default function OrdersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = (p = page) => {
    setLoading(true);
    getOrders({ page: p, size: 50 }).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []);

  return (
    <div className="pb-8">
      <PageHeader title="Orders" subtitle={data ? `${data.total.toLocaleString()} total orders` : ""} />

      <div className="px-8">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-5 h-5 animate-spin text-brand-500" />
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Order ID", "Customer ID", "Category", "Amount", "Date"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-slate-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items?.map((o: any) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{o.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{o.customer_id.slice(0, 8)}…</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[o.category] || "bg-slate-100 text-slate-600"}`}>
                          {o.category || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(o.amount)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(o.purchase_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <span className="text-xs text-slate-500">Page {page} of {data?.pages || 1}</span>
                <div className="flex gap-2">
                  <button onClick={() => { const p = page - 1; setPage(p); load(p); }} disabled={page <= 1} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => { const p = page + 1; setPage(p); load(p); }} disabled={page >= (data?.pages || 1)} className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
