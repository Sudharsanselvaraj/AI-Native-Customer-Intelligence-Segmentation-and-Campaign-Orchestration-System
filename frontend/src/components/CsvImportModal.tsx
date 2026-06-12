"use client";
import { useState, useRef, useCallback } from "react";
import { UploadCloud, X, CheckCircle, AlertCircle, FileText, Loader2, AlertTriangle } from "lucide-react";
import { bulkImportCustomers, bulkImportOrders } from "@/lib/api";

type Step = "upload" | "map" | "importing" | "results";

interface FieldDef { key: string; label: string; required: boolean; hint?: string; }

interface ParsedCSV { headers: string[]; rows: string[][]; }

interface ImportResult { imported: number; skipped: number; failed: number; errors: string[]; }

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  type: "customers" | "orders";
  onSuccess: () => void;
}

const CUSTOMER_FIELDS: FieldDef[] = [
  { key: "name",   label: "Name",          required: true  },
  { key: "email",  label: "Email",         required: true  },
  { key: "phone",  label: "Phone",         required: false },
  { key: "city",   label: "City",          required: false },
  { key: "gender", label: "Gender",        required: false, hint: "male/female/other" },
  { key: "age",    label: "Age",           required: false, hint: "number" },
];

const ORDER_FIELDS: FieldDef[] = [
  { key: "customer_email", label: "Customer Email", required: true  },
  { key: "amount",         label: "Amount",         required: true,  hint: "number"      },
  { key: "purchase_date",  label: "Purchase Date",  required: true,  hint: "YYYY-MM-DD"  },
  { key: "category",       label: "Category",       required: false },
];

const AUTO_PATTERNS: Record<string, RegExp> = {
  name:           /^(name|fullname|full.?name|customer.?name)$/i,
  email:          /^(email|e.?mail|email.?address|mail)$/i,
  phone:          /^(phone|mobile|phone.?number|tel|contact)$/i,
  city:           /^(city|location|town|region)$/i,
  gender:         /^(gender|sex)$/i,
  age:            /^(age|years)$/i,
  customer_email: /^(customer.?email|user.?email|email|e.?mail)$/i,
  amount:         /^(amount|price|value|total|revenue|cost|order.?value)$/i,
  purchase_date:  /^(purchase.?date|order.?date|date|created.?at|transaction.?date)$/i,
  category:       /^(category|type|product.?type|product.?category)$/i,
};

function autoDetect(header: string, fields: FieldDef[]): string {
  const fieldKeys = new Set(fields.map(f => f.key));
  const normalized = header.trim().replace(/\s+/g, "_");
  for (const [field, re] of Object.entries(AUTO_PATTERNS)) {
    if (fieldKeys.has(field) && re.test(normalized)) return field;
  }
  return "";
}

function parseCSV(text: string): ParsedCSV {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  function parseLine(line: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === '"' && line[j + 1] === '"') { j += 2; continue; }
          if (line[j] === '"') break;
          j++;
        }
        out.push(line.slice(i + 1, j).replace(/""/g, '"').trim());
        i = j + 2;
        if (i > 0 && line[i - 1] !== ',') i++;
      } else {
        const comma = line.indexOf(',', i);
        if (comma === -1) { out.push(line.slice(i).trim()); break; }
        out.push(line.slice(i, comma).trim());
        i = comma + 1;
      }
    }
    if (line.endsWith(',')) out.push('');
    return out;
  }

  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length < 2) return { headers: [], rows: [] };
  const headers = parseLine(nonEmpty[0]).map(h => h.replace(/^﻿/, "").trim());
  const rows = nonEmpty.slice(1).map(parseLine).filter(r => r.some(c => c));
  return { headers, rows };
}

export function CsvImportModal({ open, onClose, type, onSuccess }: CsvImportModalProps) {
  const fields = type === "customers" ? CUSTOMER_FIELDS : ORDER_FIELDS;
  const title  = type === "customers" ? "Import Customers" : "Import Orders";
  const hint   = type === "customers"
    ? "name, email, phone, city, gender, age"
    : "customer_email, amount, purchase_date, category";

  const [step, setStep]         = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [csvData, setCsvData]   = useState<ParsedCSV | null>(null);
  const [mapping, setMapping]   = useState<Record<string, string>>({});
  const [result, setResult]     = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload"); setDragging(false); setFileError("");
    setCsvData(null); setMapping({}); setResult(null);
  }

  function handleClose() { reset(); onClose(); }

  function readFile(file: File) {
    setFileError("");
    if (!file.name.toLowerCase().endsWith(".csv") && !file.type.includes("csv") && file.type !== "text/plain") {
      setFileError("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) || "";
      const parsed = parseCSV(text);
      if (parsed.headers.length === 0) {
        setFileError("CSV appears empty or malformed — check it has a header row");
        return;
      }
      const initial: Record<string, string> = {};
      parsed.headers.forEach(h => { initial[h] = autoDetect(h, fields); });
      setCsvData(parsed);
      setMapping(initial);
      setStep("map");
    };
    reader.readAsText(file, "UTF-8");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [type]);

  const mappedRequired = fields.filter(f => f.required).every(f =>
    Object.values(mapping).includes(f.key)
  );

  async function handleImport() {
    if (!csvData) return;
    setStep("importing");

    const rows = csvData.rows.map(row => {
      const obj: Record<string, any> = {};
      csvData.headers.forEach((h, i) => {
        const field = mapping[h];
        if (!field) return;
        const val = row[i]?.trim() ?? "";
        if (!val) return;
        if (field === "age") obj[field] = parseInt(val) || undefined;
        else if (field === "amount") obj[field] = parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
        else obj[field] = val;
      });
      return obj;
    });

    try {
      const fn = type === "customers" ? bulkImportCustomers : bulkImportOrders;
      const res = await fn(rows);
      setResult(res);
      setStep("results");
      if (res.imported > 0) onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Import failed — check your CSV and try again";
      setResult({ imported: 0, skipped: 0, failed: rows.length, errors: [msg] });
      setStep("results");
    }
  }

  if (!open) return null;

  const PREVIEW_COLS = 5;
  const previewHeaders = csvData ? csvData.headers.slice(0, PREVIEW_COLS) : [];
  const previewRows    = csvData ? csvData.rows.slice(0, 5) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-white rounded-[16px] w-full flex flex-col"
        style={{
          maxWidth: step === "map" ? 680 : 480,
          maxHeight: "90vh",
          border: "1px solid #E5E7EB",
          boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
          transition: "max-width 0.2s ease",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid #F3F4F6" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center"
              style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
              <FileText className="w-4 h-4" style={{ color: "#2563EB" }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: "#111827" }}>{title} from CSV</h2>
              {csvData && step === "map" && (
                <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>
                  {csvData.rows.length} rows · {csvData.headers.length} columns detected
                </p>
              )}
            </div>
          </div>
          <button onClick={handleClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ color: "#9CA3AF" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F3F4F6"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── Step: Upload ── */}
          {step === "upload" && (
            <div>
              <div
                className="rounded-[12px] flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                style={{
                  height: 220,
                  border: `2px dashed ${dragging ? "#2563EB" : "#D1D5DB"}`,
                  background: dragging ? "#EFF6FF" : "#FAFAFA",
                }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <UploadCloud className="w-10 h-10 mb-3" style={{ color: dragging ? "#2563EB" : "#9CA3AF" }} />
                <p className="text-[14px] font-semibold" style={{ color: dragging ? "#2563EB" : "#374151" }}>
                  {dragging ? "Drop your CSV here" : "Drag & drop your CSV"}
                </p>
                <p className="text-[12px] mt-1" style={{ color: "#9CA3AF" }}>or click to browse files</p>
                <span className="mt-4 px-3 py-1 rounded-full text-[11px] font-medium"
                  style={{ background: "#F3F4F6", color: "#6B7280" }}>
                  .csv files only
                </span>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />

              {fileError && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-[8px]"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                  <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#DC2626" }} />
                  <p className="text-[12px]" style={{ color: "#DC2626" }}>{fileError}</p>
                </div>
              )}

              <div className="mt-4 px-4 py-3 rounded-[8px]" style={{ background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                <p className="text-[11px] font-semibold mb-1" style={{ color: "#6B7280" }}>EXPECTED COLUMNS</p>
                <p className="text-[12px] font-mono" style={{ color: "#374151" }}>{hint}</p>
              </div>
            </div>
          )}

          {/* ── Step: Map ── */}
          {step === "map" && csvData && (
            <div>
              {/* Mapping table */}
              <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
                <div className="grid grid-cols-2 px-4 py-2"
                  style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <span className="text-[11px] font-semibold" style={{ color: "#9CA3AF", letterSpacing: "0.05em" }}>CSV COLUMN</span>
                  <span className="text-[11px] font-semibold" style={{ color: "#9CA3AF", letterSpacing: "0.05em" }}>MAPS TO</span>
                </div>
                <div className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                  {csvData.headers.map(h => (
                    <div key={h} className="grid grid-cols-2 items-center px-4 py-2.5 gap-4">
                      <span className="text-[12px] font-mono truncate" style={{ color: "#374151" }}>{h}</span>
                      <select
                        value={mapping[h] ?? ""}
                        onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                        className="w-full py-1.5 px-2.5 rounded-[6px] text-[12px]"
                        style={{ border: "1px solid #E5E7EB", color: "#111827", background: "#fff", outline: "none" }}
                      >
                        <option value="">— Ignore —</option>
                        {fields.map(f => (
                          <option key={f.key} value={f.key}>
                            {f.label}{f.required ? " *" : ""}{f.hint ? ` (${f.hint})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required fields warning */}
              {!mappedRequired && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2.5 rounded-[8px]"
                  style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
                  <p className="text-[12px]" style={{ color: "#92400E" }}>
                    Required fields not mapped: {fields.filter(f => f.required && !Object.values(mapping).includes(f.key)).map(f => f.label).join(", ")}
                  </p>
                </div>
              )}

              {/* Data preview */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold mb-2" style={{ color: "#9CA3AF", letterSpacing: "0.05em" }}>
                  DATA PREVIEW (first {Math.min(5, previewRows.length)} rows)
                </p>
                <div className="overflow-x-auto rounded-[8px]" style={{ border: "1px solid #E5E7EB" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                        {previewHeaders.map(h => (
                          <th key={h} className="text-left px-3 py-2 font-semibold truncate max-w-[120px]"
                            style={{ color: "#6B7280" }}>{h}</th>
                        ))}
                        {csvData.headers.length > PREVIEW_COLS && (
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: "#9CA3AF" }}>
                            +{csvData.headers.length - PREVIEW_COLS} more
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: ri < previewRows.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                          {previewHeaders.map((_, ci) => (
                            <td key={ci} className="px-3 py-2 truncate max-w-[120px]" style={{ color: "#374151" }}>
                              {row[ci] || <span style={{ color: "#D1D5DB" }}>—</span>}
                            </td>
                          ))}
                          {csvData.headers.length > PREVIEW_COLS && <td />}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Importing ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: "#2563EB" }} />
              <p className="text-[15px] font-semibold" style={{ color: "#111827" }}>Importing…</p>
              <p className="text-[13px] mt-1" style={{ color: "#9CA3AF" }}>
                Sending {csvData?.rows.length || 0} rows to server
              </p>
            </div>
          )}

          {/* ── Step: Results ── */}
          {step === "results" && result && (
            <div>
              {/* Stat boxes */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Imported",  value: result.imported, bg: "#F0FDF4", border: "#BBF7D0", color: "#15803D", dot: "#22C55E" },
                  { label: "Skipped",   value: result.skipped,  bg: "#FFFBEB", border: "#FDE68A", color: "#B45309", dot: "#F59E0B" },
                  { label: "Failed",    value: result.failed,   bg: "#FEF2F2", border: "#FECACA", color: "#DC2626", dot: "#EF4444" },
                ].map(s => (
                  <div key={s.label} className="rounded-[10px] px-4 py-3 text-center"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                    <p className="text-[24px] font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[11px] font-semibold mt-0.5" style={{ color: s.color }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Success message */}
              {result.imported > 0 && result.failed === 0 && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] mb-3"
                  style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#16A34A" }} />
                  <p className="text-[12px] font-medium" style={{ color: "#15803D" }}>
                    Import complete — {result.imported} {type} added successfully
                  </p>
                </div>
              )}

              {/* Error list */}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold mb-2" style={{ color: "#9CA3AF", letterSpacing: "0.05em" }}>
                    ERRORS ({result.errors.length})
                  </p>
                  <div className="rounded-[8px] overflow-y-auto" style={{ border: "1px solid #FECACA", maxHeight: 160 }}>
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 text-[11px]"
                        style={{ background: i % 2 === 0 ? "#FEF2F2" : "#FFF5F5", borderBottom: i < result.errors.length - 1 ? "1px solid #FECACA" : "none" }}>
                        <span className="shrink-0 mt-0.5" style={{ color: "#EF4444" }}>•</span>
                        <span style={{ color: "#991B1B" }}>{e}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-between items-center shrink-0"
          style={{ borderTop: "1px solid #F3F4F6" }}>
          {step === "upload" && (
            <>
              <button onClick={handleClose}
                className="px-4 py-2 rounded-[7px] text-[13px] font-medium"
                style={{ border: "1px solid #E5E7EB", color: "#374151", background: "#fff" }}>
                Cancel
              </button>
              <span className="text-[11px]" style={{ color: "#9CA3AF" }}>Max 5,000 rows per import</span>
            </>
          )}
          {step === "map" && (
            <>
              <button onClick={() => { setStep("upload"); setFileError(""); }}
                className="px-4 py-2 rounded-[7px] text-[13px] font-medium"
                style={{ border: "1px solid #E5E7EB", color: "#374151", background: "#fff" }}>
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!mappedRequired}
                className="px-5 py-2 rounded-[7px] text-[13px] font-semibold text-white"
                style={{
                  background: mappedRequired ? "#2563EB" : "#93C5FD",
                  cursor: mappedRequired ? "pointer" : "not-allowed",
                }}>
                Import {csvData?.rows.length} rows →
              </button>
            </>
          )}
          {step === "importing" && (
            <div className="w-full flex justify-center">
              <span className="text-[12px]" style={{ color: "#9CA3AF" }}>Please wait…</span>
            </div>
          )}
          {step === "results" && (
            <>
              <button onClick={handleClose}
                className="px-4 py-2 rounded-[7px] text-[13px] font-medium"
                style={{ border: "1px solid #E5E7EB", color: "#374151", background: "#fff" }}>
                Close
              </button>
              <button onClick={reset}
                className="px-4 py-2 rounded-[7px] text-[13px] font-semibold"
                style={{ background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>
                Import Another File
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
