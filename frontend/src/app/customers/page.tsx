"use client";
import { useEffect, useState } from "react";
import { getCustomers } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

export default function CustomersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const load = (p = page, s = search) => {
    setLoading(true);
    getCustomers({ page: p, size: 50, search: s || undefined })
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  return (
    <div className="pb-8">
      <PageHeader title="Customers" subtitle={data ? `${data.total.toLocaleString()} total customers` : ""} />

      <div className="px-8">
        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">
            Search
          </button>
        </form>

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
                    {["Name", "Email", "City", "Age", "Orders", "Total Spent", "Last Purchase"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-slate-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items?.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.email}</td>
                      <td className="px-4 py-3 text-slate-500">{c.city || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{c.age || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{c.total_orders}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{formatCurrency(c.total_spent)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {c.last_purchase_date ? formatDate(c.last_purchase_date) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Page {page} of {data?.pages || 1}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPage(p => p - 1); load(page - 1); }}
                    disabled={page <= 1}
                    className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setPage(p => p + 1); load(page + 1); }}
                    disabled={page >= (data?.pages || 1)}
                    className="p-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  >
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
