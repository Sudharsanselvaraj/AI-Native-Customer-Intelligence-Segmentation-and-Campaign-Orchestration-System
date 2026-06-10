"use client";
import { useEffect, useState } from "react";
import { getSegments, createSegmentFromNL, deleteSegment } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Sparkles, Trash2, RefreshCw, Users, Plus } from "lucide-react";
import toast from "react-hot-toast";

export default function SegmentsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    getSegments().then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlInput.trim()) return;
    setGenerating(true);
    try {
      const result = await createSegmentFromNL({ natural_language: nlInput, name: nameInput || undefined });
      toast.success(`Segment created: ${result.estimated_size} customers matched`);
      setShowModal(false);
      setNlInput("");
      setNameInput("");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to create segment");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete segment "${name}"?`)) return;
    await deleteSegment(id);
    toast.success("Segment deleted");
    load();
  };

  return (
    <div className="pb-8">
      <PageHeader
        title="Segments"
        subtitle="Define your target audiences using natural language"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            <Sparkles className="w-4 h-4" />
            Create with AI
          </button>
        }
      />

      <div className="px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-5 h-5 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {data?.items?.map((seg: any) => (
              <div key={seg.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {seg.is_smart && (
                      <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full font-medium">Smart</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(seg.id, seg.name)}
                    className="text-slate-300 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">{seg.name}</h3>
                {seg.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{seg.description}</p>
                )}
                {seg.query_definition?.natural_language && (
                  <p className="text-xs text-slate-400 mt-2 italic line-clamp-2">
                    "{seg.query_definition.natural_language}"
                  </p>
                )}
                <div className="flex items-center gap-1 mt-4 text-slate-600">
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-semibold">
                    {seg.estimated_size?.toLocaleString() ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400">customers</span>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowModal(true)}
              className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-brand-300 hover:text-brand-500 transition-colors min-h-[160px]"
            >
              <Plus className="w-6 h-6" />
              <span className="text-sm font-medium">New Segment</span>
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-brand-500" />
              <h2 className="font-semibold text-slate-900">Create Segment with AI</h2>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Segment Name (optional)</label>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. High Value Mumbai Shoppers"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Describe your audience</label>
                <textarea
                  value={nlInput}
                  onChange={(e) => setNlInput(e.target.value)}
                  placeholder="e.g. Customers who spent more than ₹5000 and haven't purchased in 60 days"
                  rows={4}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Generating..." : "Create Segment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
