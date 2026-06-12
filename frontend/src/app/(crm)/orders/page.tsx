"use client";
import { useState, useEffect, useMemo } from "react";
import { getOrders } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Search, Download, Filter, ChevronUp, ChevronDown,
  ChevronLeft, ChevronRight, ShoppingBag, TrendingUp, Upload
} from "lucide-react";
import { CsvImportModal } from "@/components/CsvImportModal";

type Order = {
  id: string; customer_id: string; customer_name: string;
  amount: number; status: string; channel: string;
  created_at: string; items?: number;
};

function seeded(id: string, offset = 0): number {
  const h = id.charCodeAt(0) + (id.charCodeAt(4) || 0) + offset;
  return Math.round(Math.abs(Math.sin(h) * 10000) % 100);
}

function orderStatus(s: string) {
  const m: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    completed: { label: "Completed", bg: "#F0FDF4", color: "#15803D", dot: "#22C55E" },
    pending:   { label: "Pending",   bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B" },
    cancelled: { label: "Cancelled", bg: "#FEF2F2", color: "#DC2626", dot: "#EF4444" },
    shipped:   { label: "Shipped",   bg: "#EFF6FF", color: "#1D4ED8", dot: "#2563EB" },
    processing:{ label: "Processing",bg: "#F5F3FF", color: "#6D28D9", dot: "#8B5CF6" },
  };
  return m[s?.toLowerCase()] || m.pending;
}

function upsellColor(v: number) {
  if (v >= 70) return { bg: "#F0FDF4", color: "#15803D" };
  if (v >= 40) return { bg: "#FFFBEB", color: "#B45309" };
  return { bg: "#FEF2F2", color: "#DC2626" };
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "#F3F4F6", maxWidth: 56 }}>
        <div className="h-full rounded-full progress-bar" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold w-6 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

const DEMO_ORDERS: Order[] = [
  { id: "ord001", customer_id: "c001", customer_name: "Priya Sharma",   amount: 12400, status: "completed",  channel: "WhatsApp", created_at: "2024-12-10T10:24:00Z", items: 3 },
  { id: "ord002", customer_id: "c003", customer_name: "Ananya Iyer",    amount: 8750,  status: "completed",  channel: "Email",    created_at: "2024-12-11T14:12:00Z", items: 2 },
  { id: "ord003", customer_id: "c002", customer_name: "Rahul Verma",    amount: 3200,  status: "shipped",    channel: "Direct",   created_at: "2024-12-08T09:45:00Z", items: 1 },
  { id: "ord004", customer_id: "c008", customer_name: "Rohan Gupta",    amount: 22600, status: "completed",  channel: "SMS",      created_at: "2024-12-07T16:30:00Z", items: 5 },
  { id: "ord005", customer_id: "c005", customer_name: "Deepika Mehta",  amount: 6800,  status: "processing", channel: "WhatsApp", created_at: "2024-12-09T11:20:00Z", items: 2 },
  { id: "ord006", customer_id: "c013", customer_name: "Nisha Agarwal",  amount: 15300, status: "completed",  channel: "Email",    created_at: "2024-12-10T08:55:00Z", items: 4 },
  { id: "ord007", customer_id: "c004", customer_name: "Vikram Nair",    amount: 4100,  status: "pending",    channel: "Direct",   created_at: "2024-11-28T13:40:00Z", items: 1 },
  { id: "ord008", customer_id: "c012", customer_name: "Karthik Menon",  amount: 9200,  status: "completed",  channel: "RCS",      created_at: "2024-12-05T15:10:00Z", items: 3 },
  { id: "ord009", customer_id: "c015", customer_name: "Meera Pillai",   amount: 18400, status: "shipped",    channel: "WhatsApp", created_at: "2024-12-08T12:00:00Z", items: 4 },
  { id: "ord010", customer_id: "c009", customer_name: "Kavitha Reddy",  amount: 5600,  status: "completed",  channel: "Email",    created_at: "2024-12-01T10:30:00Z", items: 2 },
  { id: "ord011", customer_id: "c006", customer_name: "Arjun Patel",    amount: 2800,  status: "cancelled",  channel: "SMS",      created_at: "2024-11-15T09:00:00Z", items: 1 },
  { id: "ord012", customer_id: "c001", customer_name: "Priya Sharma",   amount: 7400,  status: "completed",  channel: "Direct",   created_at: "2024-11-22T14:45:00Z", items: 2 },
  { id: "ord013", customer_id: "c003", customer_name: "Ananya Iyer",    amount: 31200, status: "completed",  channel: "WhatsApp", created_at: "2024-11-30T11:15:00Z", items: 7 },
  { id: "ord014", customer_id: "c008", customer_name: "Rohan Gupta",    amount: 14800, status: "completed",  channel: "Email",    created_at: "2024-11-18T16:20:00Z", items: 3 },
  { id: "ord015", customer_id: "c010", customer_name: "Amit Joshi",     amount: 3600,  status: "pending",    channel: "Direct",   created_at: "2024-10-22T10:00:00Z", items: 1 },
  { id: "ord016", customer_id: "c013", customer_name: "Nisha Agarwal",  amount: 9800,  status: "completed",  channel: "RCS",      created_at: "2024-11-28T13:30:00Z", items: 3 },
  { id: "ord017", customer_id: "c015", customer_name: "Meera Pillai",   amount: 11200, status: "shipped",    channel: "WhatsApp", created_at: "2024-11-20T09:45:00Z", items: 2 },
  { id: "ord018", customer_id: "c005", customer_name: "Deepika Mehta",  amount: 16400, status: "completed",  channel: "Email",    created_at: "2024-11-05T14:20:00Z", items: 4 },
  { id: "ord019", customer_id: "c002", customer_name: "Rahul Verma",    amount: 8900,  status: "completed",  channel: "SMS",      created_at: "2024-10-30T11:00:00Z", items: 2 },
  { id: "ord020", customer_id: "c012", customer_name: "Karthik Menon",  amount: 6200,  status: "processing", channel: "Direct",   created_at: "2024-12-03T15:30:00Z", items: 2 },
];

const PAGE_SIZE = 12;

export default function OrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [page, setPage]       = useState(1);
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showImport, setShowImport] = useState(false);

  function loadOrders() {
    getOrders()
      .then((d: any) => setOrders(Array.isArray(d) ? d : d.items || d.orders || []))
      .catch(() => setOrders(DEMO_ORDERS))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadOrders(); }, []);

  const filtered = useMemo(() => {
    let list = orders.filter(o => {
      const q = search.toLowerCase();
      return o.id?.toLowerCase().includes(q) || o.customer_name?.toLowerCase().includes(q) || o.channel?.toLowerCase().includes(q);
    });
    if (filterStatus !== "all") list = list.filter(o => o.status?.toLowerCase() === filterStatus);
    return [...list].sort((a, b) => {
      const av: any = (a as any)[sortKey] ?? "";
      const bv: any = (b as any)[sortKey] ?? "";
      return av < bv ? (sortDir === "asc" ? -1 : 1) : av > bv ? (sortDir === "asc" ? 1 : -1) : 0;
    });
  }, [orders, search, sortKey, sortDir, filterStatus]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  function toggleSort(k: string) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
    setPage(1);
  }

  const totals = useMemo(() => ({
    revenue: orders.reduce((s, o) => s + (o.amount || 0), 0),
    completed: orders.filter(o => o.status === "completed").length,
  }), [orders]);

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] flex items-center justify-center"
            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <ShoppingBag className="w-4 h-4" style={{ color: "#16A34A" }} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>Orders</h1>
            <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
              {loading ? "Loading…" : `${filtered.length.toLocaleString()} orders · ${formatCurrency(totals.revenue)} total revenue`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[11px] font-semibold"
            style={{ background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0" }}>
            <TrendingUp className="w-3.5 h-3.5" />
            AI Opportunity Scores Active
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium"
            style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB" }}>
            <Upload className="w-3.5 h-3.5" />Import CSV
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium"
            style={{ border: "1px solid #E5E7EB", background: "#fff", color: "#374151" }}>
            <Download className="w-3.5 h-3.5" />Export
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="bg-white rounded-[12px] flex flex-col flex-1" style={{ border: "1px solid #E5E7EB" }}>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 flex-wrap" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
              <input
                className="w-full pl-8 pr-3 py-2 text-[13px] rounded-[7px]"
                style={{ border: "1px solid #E5E7EB", outline: "none", color: "#111827", background: "#FAFAFA" }}
                placeholder="Search orders…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
                onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
              />
            </div>
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-[12px] font-medium"
              style={{
                border: `1px solid ${showFilter ? "#BFDBFE" : "#E5E7EB"}`,
                background: showFilter ? "#EFF6FF" : "#fff",
                color: showFilter ? "#2563EB" : "#374151",
              }}>
              <Filter className="w-3.5 h-3.5" />Filters
            </button>
            {showFilter && (
              <div className="flex items-center gap-1.5">
                {["all","completed","pending","shipped","processing","cancelled"].map(s => (
                  <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
                    style={filterStatus===s
                      ? { background: "#2563EB", color: "#fff" }
                      : { background: "#F3F4F6", color: "#6B7280" }}>
                    {s === "all" ? "All" : s.charAt(0).toUpperCase()+s.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                  {[
                    { key:"id",          label:"Order ID",    sort:true },
                    { key:"customer_name",label:"Customer",   sort:true },
                    { key:"amount",      label:"Amount",      sort:true },
                    { key:"status",      label:"Status",      sort:false},
                    { key:"channel",     label:"Channel",     sort:true },
                    { key:"created_at",  label:"Date",        sort:true },
                    { key:"upsell",      label:"Upsell %",    sort:false},
                    { key:"crosssell",   label:"Cross-Sell %",sort:false},
                  ].map(col => (
                    <th key={col.key} className="text-left py-3 pl-5 pr-4 text-[11px] font-semibold"
                      style={{ color: "#9CA3AF", letterSpacing: "0.04em", userSelect: "none" }}>
                      {col.sort ? (
                        <button className="flex items-center gap-1" onClick={() => toggleSort(col.key)}>
                          {col.label.toUpperCase()}
                          {sortKey===col.key
                            ? (sortDir==="asc" ? <ChevronUp className="w-3 h-3" style={{color:"#2563EB"}} /> : <ChevronDown className="w-3 h-3" style={{color:"#2563EB"}} />)
                            : <ChevronUp className="w-3 h-3 opacity-20" />}
                        </button>
                      ) : col.label.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({length:8}).map((_,i) => (
                    <tr key={i}>
                      {Array.from({length:8}).map((_,j) => (
                        <td key={j} className="py-3 pl-5 pr-4">
                          <div className="h-4 rounded animate-pulse" style={{background:"#F3F4F6",width:j===1?140:80}}/>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paged.length===0 ? (
                  <tr><td colSpan={8} className="py-16 text-center text-[13px]" style={{color:"#9CA3AF"}}>No orders found</td></tr>
                ) : paged.map(o => {
                  const st = orderStatus(o.status);
                  const up = seeded(o.id, 1);
                  const cs = seeded(o.id, 7);
                  const upC = upsellColor(up);
                  const csC = upsellColor(cs);
                  return (
                    <tr key={o.id} className="row-hover" style={{ borderBottom: "1px solid #F9FAFB" }}>
                      <td className="py-3 pl-5 pr-4 text-[12px] font-mono font-semibold" style={{color:"#6B7280"}}>
                        #{o.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3 pr-4 text-[13px] font-medium" style={{color:"#111827"}}>
                        {o.customer_name || "—"}
                      </td>
                      <td className="py-3 pr-4 text-[13px] font-semibold" style={{color:"#111827"}}>
                        {formatCurrency(o.amount)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{background:st.bg, color:st.color}}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{background:st.dot}}/>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-[11px] font-medium px-2 py-1 rounded-[5px]"
                          style={{background:"#F9FAFB", color:"#6B7280", border:"1px solid #F3F4F6"}}>
                          {o.channel || "Direct"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[12px]" style={{color:"#6B7280"}}>
                        {o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                      </td>
                      <td className="py-3 pr-4 w-28">
                        <ScoreBar value={up} color={upC.color} />
                      </td>
                      <td className="py-3 pr-5 w-28">
                        <ScoreBar value={cs} color={csC.color} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{borderTop:"1px solid #F3F4F6"}}>
              <span className="text-[12px]" style={{color:"#9CA3AF"}}>
                {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE,filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page===1} onClick={() => setPage(p=>p-1)}
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center"
                  style={{border:"1px solid #E5E7EB",background:"#fff",color:page===1?"#D1D5DB":"#6B7280",cursor:page===1?"not-allowed":"pointer"}}>
                  <ChevronLeft className="w-3.5 h-3.5"/>
                </button>
                {Array.from({length:Math.min(totalPages,5)}).map((_,i) => (
                  <button key={i+1} onClick={() => setPage(i+1)}
                    className="w-7 h-7 rounded-[6px] text-[12px] font-medium"
                    style={{border:page===i+1?"none":"1px solid #E5E7EB",background:page===i+1?"#2563EB":"#fff",color:page===i+1?"#fff":"#6B7280",cursor:"pointer"}}>
                    {i+1}
                  </button>
                ))}
                <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)}
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center"
                  style={{border:"1px solid #E5E7EB",background:"#fff",color:page===totalPages?"#D1D5DB":"#6B7280",cursor:page===totalPages?"not-allowed":"pointer"}}>
                  <ChevronRight className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        type="orders"
        onSuccess={() => { setLoading(true); loadOrders(); }}
      />
    </div>
  );
}
