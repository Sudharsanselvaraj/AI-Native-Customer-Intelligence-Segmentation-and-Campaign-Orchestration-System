"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getCustomers } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  Search, Plus, Download, Eye, Sparkles, Megaphone,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Users, Upload, MapPin, Star,
} from "lucide-react";
import { CsvImportModal } from "@/components/CsvImportModal";

// ── Types ────────────────────────────────────────────────────────────────────

type Customer = {
  id: string; name: string; email: string; phone?: string;
  location?: string; city?: string;
  total_orders: number; total_spent: number;
  last_purchase?: string; last_purchase_date?: string;
  tier?: string;
};

type TierType   = "VIP" | "Regular" | "New";
type StatusType = "Active" | "At Risk" | "Dormant";

// ── Computed helpers ──────────────────────────────────────────────────────────

function crmTier(c: Customer): TierType {
  const t = (c.tier || "").toLowerCase();
  if (t === "vip"     || c.total_spent >= 40000) return "VIP";
  if (t === "regular" || c.total_spent >= 10000) return "Regular";
  return "New";
}

function crmStatus(c: Customer): StatusType {
  const ds = c.last_purchase || c.last_purchase_date;
  if (!ds || c.total_orders === 0) return "Dormant";
  const days = Math.floor((Date.now() - new Date(ds).getTime()) / 86400000);
  if (days <= 30) return "Active";
  if (days <= 90) return "At Risk";
  return "Dormant";
}

function engagementScore(c: Customer): number {
  const h = c.id.charCodeAt(0) + (c.id.charCodeAt(4) || 0);
  let v = 38 + Math.round(Math.abs(Math.sin(h * 7.31) * 10000) % 55);
  if (c.total_orders >= 15)     v = Math.min(97, v + 26);
  else if (c.total_orders >= 8) v = Math.min(91, v + 16);
  else if (c.total_orders >= 3) v = Math.min(82, v + 6);
  else if (c.total_orders === 0) v = Math.max(7, v - 30);
  return v;
}

function relativePurchase(ds?: string): { label: string; full: string } {
  if (!ds) return { label: "Never", full: "No purchases yet" };
  const days = Math.floor((Date.now() - new Date(ds).getTime()) / 86400000);
  const full = new Date(ds).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  if (days === 0) return { label: "Today", full };
  if (days === 1) return { label: "Yesterday", full };
  if (days < 7)   return { label: `${days}d ago`, full };
  if (days < 30)  return { label: `${Math.floor(days / 7)}w ago`, full };
  if (days < 365) return { label: `${Math.floor(days / 30)}mo ago`, full };
  return { label: `${Math.floor(days / 365)}y ago`, full };
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<StatusType, { bg: string; color: string; dot: string; border: string }> = {
  Active:    { bg: "#F0FDF4", color: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  "At Risk": { bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B", border: "#FDE68A" },
  Dormant:   { bg: "#FEF2F2", color: "#DC2626", dot: "#EF4444", border: "#FECACA" },
};

const TIER_CFG: Record<TierType, { bg: string; color: string; border: string }> = {
  VIP:     { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  Regular: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  New:     { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
};

const GRAD_PAIRS: [string, string][] = [
  ["#667EEA", "#764BA2"], ["#F093FB", "#F5576C"], ["#4FACFE", "#00F2FE"],
  ["#43E97B", "#38F9D7"], ["#FA709A", "#FEE140"], ["#A18CD1", "#FBC2EB"],
  ["#F6D365", "#FDA085"], ["#48C6EF", "#6F86D6"], ["#96FBC4", "#F9F586"],
  ["#FBC2EB", "#A6C1EE"],
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const idx = (name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0)) % GRAD_PAIRS.length;
  const [from, to] = GRAD_PAIRS[idx];
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center select-none font-bold"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        color: "#fff",
        fontSize: Math.round(size * 0.36),
        boxShadow: `0 0 0 2.5px #fff, 0 2px 10px rgba(0,0,0,0.18)`,
        letterSpacing: "0.5px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

function EngagementBar({ score }: { score: number }) {
  const color = score >= 75 ? "#22C55E" : score >= 50 ? "#F59E0B" : "#EF4444";
  const track = score >= 75 ? "#DCFCE7" : score >= 50 ? "#FEF3C7" : "#FEE2E2";
  const text  = score >= 75 ? "#15803D" : score >= 50 ? "#92400E" : "#B91C1C";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-[7px] rounded-full overflow-hidden" style={{ background: track, width: 88 }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color, transition: "width 0.4s ease" }} />
      </div>
      <span className="text-[12px] font-bold tabular-nums" style={{ color: text, minWidth: 28 }}>
        {score}%
      </span>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      className="w-4 h-4 rounded-[4px] flex items-center justify-center cursor-pointer shrink-0 transition-all"
      style={{ border: checked ? "none" : "1.5px solid #D1D5DB", background: checked ? "#2563EB" : "#fff" }}
      onClick={onChange}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ── Demo data ──────────────────────────────────────────────────────────────────

const DEMO_CUSTOMERS: Customer[] = [
  { id: "c001", name: "Priya Sharma",   email: "priya.sharma@gmail.com",   location: "Mumbai",     total_orders: 14, total_spent: 48200, last_purchase: "2024-12-10", tier: "VIP"     },
  { id: "c002", name: "Rahul Verma",    email: "rahul.v@outlook.com",      location: "Delhi",      total_orders: 8,  total_spent: 22500, last_purchase: "2024-12-08", tier: "Regular" },
  { id: "c003", name: "Ananya Iyer",    email: "ananya.iyer@yahoo.com",    location: "Chennai",    total_orders: 21, total_spent: 72800, last_purchase: "2024-12-11", tier: "VIP"     },
  { id: "c004", name: "Vikram Nair",    email: "vikram.nair@hotmail.com",  location: "Bangalore",  total_orders: 5,  total_spent: 15300, last_purchase: "2024-11-28", tier: "Regular" },
  { id: "c005", name: "Deepika Mehta",  email: "deepika.m@gmail.com",      location: "Pune",       total_orders: 11, total_spent: 38900, last_purchase: "2024-12-09", tier: "VIP"     },
  { id: "c006", name: "Arjun Patel",    email: "arjun.patel@gmail.com",    location: "Ahmedabad",  total_orders: 3,  total_spent: 8700,  last_purchase: "2024-11-15", tier: "Regular" },
  { id: "c007", name: "Sneha Kulkarni", email: "sneha.k@outlook.com",      location: "Hyderabad",  total_orders: 0,  total_spent: 0,     last_purchase: undefined,   tier: ""        },
  { id: "c008", name: "Rohan Gupta",    email: "rohan.g@gmail.com",        location: "Kolkata",    total_orders: 18, total_spent: 61400, last_purchase: "2024-12-07", tier: "VIP"     },
  { id: "c009", name: "Kavitha Reddy",  email: "kavitha.r@yahoo.com",      location: "Hyderabad",  total_orders: 7,  total_spent: 19200, last_purchase: "2024-12-01", tier: "Regular" },
  { id: "c010", name: "Amit Joshi",     email: "amit.joshi@gmail.com",     location: "Jaipur",     total_orders: 2,  total_spent: 5400,  last_purchase: "2024-10-22", tier: ""        },
  { id: "c011", name: "Pooja Singh",    email: "pooja.singh@outlook.com",  location: "Lucknow",    total_orders: 0,  total_spent: 0,     last_purchase: undefined,   tier: ""        },
  { id: "c012", name: "Karthik Menon",  email: "karthik.m@gmail.com",      location: "Kochi",      total_orders: 9,  total_spent: 27600, last_purchase: "2024-12-05", tier: "Regular" },
  { id: "c013", name: "Nisha Agarwal",  email: "nisha.a@gmail.com",        location: "Bhopal",     total_orders: 15, total_spent: 52100, last_purchase: "2024-12-10", tier: "VIP"     },
  { id: "c014", name: "Saurabh Tiwari", email: "saurabh.t@yahoo.com",      location: "Nagpur",     total_orders: 4,  total_spent: 11800, last_purchase: "2024-11-20", tier: "Regular" },
  { id: "c015", name: "Meera Pillai",   email: "meera.p@gmail.com",        location: "Trivandrum", total_orders: 12, total_spent: 41500, last_purchase: "2024-12-08", tier: "VIP"     },
];

const PAGE_SIZE = 12;

const QUICK_FILTERS = [
  { key: "all",     label: "All"     },
  { key: "vip",     label: "VIP"     },
  { key: "active",  label: "Active"  },
  { key: "at-risk", label: "At Risk" },
  { key: "dormant", label: "Dormant" },
  { key: "new",     label: "New"     },
];

const SORT_COLS = [
  { key: "name",          label: "Customer",      sort: true  },
  { key: "tier",          label: "Tier",          sort: true  },
  { key: "total_spent",   label: "Revenue",       sort: true  },
  { key: "engagement",    label: "Engagement",    sort: true  },
  { key: "last_purchase", label: "Last Purchase", sort: true  },
  { key: "status",        label: "Status",        sort: true  },
  { key: "actions",       label: "",              sort: false },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const router = useRouter();
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [checked,     setChecked]     = useState<Set<string>>(new Set());
  const [sortKey,     setSortKey]     = useState("total_spent");
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc");
  const [page,        setPage]        = useState(1);
  const [filterKey,   setFilterKey]   = useState("all");
  const [showImport,  setShowImport]  = useState(false);

  function loadCustomers() {
    getCustomers()
      .then((d: any) => setCustomers(Array.isArray(d) ? d : d.items || d.customers || []))
      .catch(() => setCustomers(DEMO_CUSTOMERS))
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadCustomers(); }, []);

  const filtered = useMemo(() => {
    let list = customers.filter(c => {
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        (c.location || c.city || "").toLowerCase().includes(q)
      );
    });
    if (filterKey !== "all") {
      list = list.filter(c => {
        const tier   = crmTier(c).toLowerCase();
        const status = crmStatus(c).toLowerCase().replace(" ", "-");
        if (filterKey === "vip")     return tier === "vip";
        if (filterKey === "new")     return tier === "new";
        if (filterKey === "active")  return status === "active";
        if (filterKey === "at-risk") return status === "at-risk";
        if (filterKey === "dormant") return status === "dormant";
        return true;
      });
    }
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === "tier") {
        av = ["VIP", "Regular", "New"].indexOf(crmTier(a));
        bv = ["VIP", "Regular", "New"].indexOf(crmTier(b));
      } else if (sortKey === "status") {
        av = ["Active", "At Risk", "Dormant"].indexOf(crmStatus(a));
        bv = ["Active", "At Risk", "Dormant"].indexOf(crmStatus(b));
      } else if (sortKey === "engagement") {
        av = engagementScore(a); bv = engagementScore(b);
      } else {
        av = (a as any)[sortKey] ?? ""; bv = (b as any)[sortKey] ?? "";
      }
      return av < bv ? (sortDir === "asc" ? -1 : 1) : av > bv ? (sortDir === "asc" ? 1 : -1) : 0;
    });
  }, [customers, search, sortKey, sortDir, filterKey]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary counts
  const stats = useMemo(() => ({
    total:   customers.length,
    vip:     customers.filter(c => crmTier(c) === "VIP").length,
    atRisk:  customers.filter(c => crmStatus(c) === "At Risk").length,
    dormant: customers.filter(c => crmStatus(c) === "Dormant").length,
  }), [customers]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }
  function toggleAll() {
    checked.size === paged.length ? setChecked(new Set()) : setChecked(new Set(paged.map(c => c.id)));
  }
  function toggleOne(id: string) {
    setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", display: "flex", flexDirection: "column" }}>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] flex items-center justify-center"
            style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            <Users className="w-4 h-4" style={{ color: "#2563EB" }} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>Customers</h1>
            {loading ? (
              <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>Loading…</p>
            ) : (
              <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
                {stats.total.toLocaleString()} total
                {stats.vip > 0 && <> · <span style={{ color: "#C2410C" }}>{stats.vip} VIP</span></>}
                {stats.atRisk > 0 && <> · <span style={{ color: "#B45309" }}>{stats.atRisk} at risk</span></>}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium"
            style={{ border: "1px solid #E5E7EB", background: "#fff", color: "#374151" }}>
            <Download className="w-3.5 h-3.5" />Export
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium"
            style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB" }}>
            <Upload className="w-3.5 h-3.5" />Import CSV
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-[13px] font-medium text-white"
            style={{ background: "#2563EB" }}>
            <Plus className="w-4 h-4" />Add Customer
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <div className="bg-white rounded-[12px] flex flex-col flex-1 overflow-hidden"
          style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

          {/* ── Toolbar: search + quick-filter tabs ── */}
          <div className="px-5 pt-4 pb-0" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <div className="flex items-center gap-3 mb-3">
              {/* Search */}
              <div className="relative" style={{ width: 280 }}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#9CA3AF" }} />
                <input
                  className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[8px]"
                  style={{ border: "1px solid #E5E7EB", outline: "none", color: "#111827", background: "#FAFAFA" }}
                  placeholder="Search by name, email or city…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.08)"; }}
                  onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                />
              </div>

              {/* Bulk action chip */}
              {checked.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="px-3 py-1.5 rounded-[7px] text-[12px] font-semibold"
                    style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                    {checked.size} selected
                  </span>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium"
                    style={{ border: "1px solid #DDD6FE", background: "#F5F3FF", color: "#7C3AED" }}>
                    <Megaphone className="w-3.5 h-3.5" />Launch Campaign
                  </button>
                </div>
              )}
            </div>

            {/* Quick-filter tabs */}
            <div className="flex items-center gap-0.5">
              {QUICK_FILTERS.map(f => {
                const active = filterKey === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => { setFilterKey(f.key); setPage(1); }}
                    className="px-3.5 py-2 text-[12px] font-semibold rounded-t-[6px] transition-all relative"
                    style={{
                      color: active ? "#2563EB" : "#6B7280",
                      background: active ? "#EFF6FF" : "transparent",
                      borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
                    }}
                  >
                    {f.label}
                    {!loading && f.key !== "all" && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          background: active ? "#BFDBFE" : "#F3F4F6",
                          color:      active ? "#1D4ED8" : "#9CA3AF",
                        }}>
                        {f.key === "vip"     ? customers.filter(c => crmTier(c) === "VIP").length
                        : f.key === "active"  ? customers.filter(c => crmStatus(c) === "Active").length
                        : f.key === "at-risk" ? customers.filter(c => crmStatus(c) === "At Risk").length
                        : f.key === "dormant" ? customers.filter(c => crmStatus(c) === "Dormant").length
                        : f.key === "new"     ? customers.filter(c => crmTier(c) === "New").length
                        : customers.length}
                      </span>
                    )}
                  </button>
                );
              })}
              <span className="ml-auto text-[12px] pb-2" style={{ color: "#9CA3AF" }}>
                {!loading && `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                  <th className="w-12 pl-5 py-3.5">
                    <Checkbox
                      checked={checked.size === paged.length && paged.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  {SORT_COLS.map(col => (
                    <th key={col.key}
                      className="text-left py-3.5 pr-4 text-[11px] font-semibold select-none"
                      style={{ color: "#9CA3AF", letterSpacing: "0.06em" }}>
                      {col.sort ? (
                        <button
                          className="flex items-center gap-1 hover:text-gray-600 transition-colors"
                          onClick={() => toggleSort(col.key)}>
                          {col.label.toUpperCase()}
                          {sortKey === col.key
                            ? sortDir === "asc"
                              ? <ChevronUp   className="w-3 h-3" style={{ color: "#2563EB" }} />
                              : <ChevronDown className="w-3 h-3" style={{ color: "#2563EB" }} />
                            : <ChevronUp className="w-3 h-3 opacity-20" />}
                        </button>
                      ) : <span>{col.label.toUpperCase()}</span>}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* ── Loading skeleton ── */}
                {loading && Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F9FAFB" }}>
                    <td className="pl-5 py-5 w-12">
                      <div className="w-4 h-4 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
                    </td>
                    <td className="py-5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full animate-pulse shrink-0" style={{ background: "#E5E7EB" }} />
                        <div className="space-y-2">
                          <div className="h-3.5 w-36 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
                          <div className="h-3 w-28 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
                        </div>
                      </div>
                    </td>
                    {[80, 64, 100, 72, 60].map((w, j) => (
                      <td key={j} className="py-5 pr-4">
                        <div className="h-3.5 rounded animate-pulse" style={{ background: "#F3F4F6", width: w }} />
                      </td>
                    ))}
                    <td className="py-5 pr-5" />
                  </tr>
                ))}

                {/* ── Empty state ── */}
                {!loading && paged.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ background: "#F3F4F6" }}>
                          <Users className="w-5 h-5" style={{ color: "#9CA3AF" }} />
                        </div>
                        <p className="text-[14px] font-medium" style={{ color: "#374151" }}>No customers found</p>
                        <p className="text-[12px]" style={{ color: "#9CA3AF" }}>
                          {search ? "Try a different search term" : "Adjust filters or add customers"}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Data rows ── */}
                {!loading && paged.map(c => {
                  const tier    = crmTier(c);
                  const status  = crmStatus(c);
                  const score   = engagementScore(c);
                  const tierCfg = TIER_CFG[tier];
                  const stCfg   = STATUS_CFG[status];
                  const loc     = c.location || c.city || "";
                  const { label: lastPLabel } = relativePurchase(c.last_purchase || c.last_purchase_date);
                  const isChecked = checked.has(c.id);

                  return (
                    <tr
                      key={c.id}
                      className="group transition-colors"
                      style={{
                        borderBottom: "1px solid #F9FAFB",
                        background: isChecked ? "#EFF6FF" : "transparent",
                      }}
                      onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = "#FAFBFF"; }}
                      onMouseLeave={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Checkbox */}
                      <td className="pl-5 py-[18px] w-12">
                        <Checkbox checked={isChecked} onChange={() => toggleOne(c.id)} />
                      </td>

                      {/* Customer */}
                      <td className="py-[18px] pr-4" style={{ minWidth: 220 }}>
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name || "?"} size={40} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate" style={{ color: "#111827", maxWidth: 160 }}>
                              {c.name}
                            </p>
                            <p className="text-[11px] truncate mt-0.5" style={{ color: "#9CA3AF", maxWidth: 160 }}>
                              {c.email}
                            </p>
                            {loc && (
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin className="w-2.5 h-2.5" style={{ color: "#C4C9D4" }} />
                                <span className="text-[10px] font-medium" style={{ color: "#B0B7C3" }}>{loc}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="py-[18px] pr-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style={{ background: tierCfg.bg, color: tierCfg.color, border: `1px solid ${tierCfg.border}` }}>
                          {tier === "VIP" && <Star className="w-2.5 h-2.5" />}
                          {tier}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="py-[18px] pr-4" style={{ minWidth: 110 }}>
                        <p className="text-[13px] font-bold" style={{ color: "#111827" }}>
                          {formatCurrency(c.total_spent)}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>
                          {c.total_orders} order{c.total_orders !== 1 ? "s" : ""}
                        </p>
                      </td>

                      {/* Engagement */}
                      <td className="py-[18px] pr-4" style={{ minWidth: 150 }}>
                        <EngagementBar score={score} />
                      </td>

                      {/* Last Purchase */}
                      <td className="py-[18px] pr-4">
                        <p className="text-[12px] font-semibold" style={{ color: "#374151" }}>{lastPLabel}</p>
                      </td>

                      {/* Status */}
                      <td className="py-[18px] pr-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: stCfg.bg, color: stCfg.color, border: `1px solid ${stCfg.border}` }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stCfg.dot }} />
                          {status}
                        </span>
                      </td>

                      {/* Hover actions */}
                      <td className="py-[18px] pr-5" style={{ width: 210 }}>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150">
                          <button
                            onClick={() => router.push(`/customers/${c.id}`)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] font-semibold transition-colors"
                            style={{ background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#E5E7EB"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F3F4F6"; }}>
                            <Eye className="w-3 h-3" />View
                          </button>
                          <button
                            onClick={() => router.push(`/customers/${c.id}`)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] font-semibold transition-colors"
                            style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#DBEAFE"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#EFF6FF"; }}>
                            <Sparkles className="w-3 h-3" />AI
                          </button>
                          <button
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] text-[11px] font-semibold transition-colors"
                            style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#EDE9FE"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F5F3FF"; }}>
                            <Megaphone className="w-3 h-3" />Campaign
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderTop: "1px solid #F3F4F6" }}>
              <span className="text-[12px]" style={{ color: "#9CA3AF" }}>
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} customers
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center"
                  style={{ border: "1px solid #E5E7EB", background: "#fff", color: page === 1 ? "#D1D5DB" : "#6B7280", cursor: page === 1 ? "not-allowed" : "pointer" }}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                  <button key={i + 1} onClick={() => setPage(i + 1)}
                    className="w-7 h-7 rounded-[6px] text-[12px] font-medium"
                    style={{ border: page === i + 1 ? "none" : "1px solid #E5E7EB", background: page === i + 1 ? "#2563EB" : "#fff", color: page === i + 1 ? "#fff" : "#6B7280", cursor: "pointer" }}>
                    {i + 1}
                  </button>
                ))}
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center"
                  style={{ border: "1px solid #E5E7EB", background: "#fff", color: page === totalPages ? "#D1D5DB" : "#6B7280", cursor: page === totalPages ? "not-allowed" : "pointer" }}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        type="customers"
        onSuccess={() => { setLoading(true); loadCustomers(); }}
      />
    </div>
  );
}
