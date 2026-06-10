"use client";
import { useEffect, useState } from "react";
import { getCampaigns, getSegments, generateCampaign, createCampaign, launchCampaign } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Sparkles, Rocket, RefreshCw, Plus, CheckCircle, AlertCircle, Clock, Play } from "lucide-react";
import { formatDate, STATUS_COLORS, CHANNEL_COLORS } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const CHANNELS = ["whatsapp", "email", "sms", "rcs"];

export default function CampaignsPage() {
  const [data, setData] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<"prompt" | "review">("prompt");
  const [prompt, setPrompt] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [generated, setGenerated] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([getCampaigns(), getSegments()])
      .then(([c, s]) => { setData(c); setSegments(s.items || []); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const result = await generateCampaign({ prompt, segment_id: segmentId || undefined });
      setGenerated(result);
      setStep("review");
    } catch {
      toast.error("Failed to generate campaign");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generated || !segmentId) return;
    setSaving(true);
    try {
      await createCampaign({
        name: generated.name,
        description: generated.description,
        channel: generated.channel,
        segment_id: segmentId,
        message_template: generated.message_template,
      });
      toast.success("Campaign created!");
      setShowModal(false);
      setStep("prompt");
      setPrompt("");
      setGenerated(null);
      load();
    } catch {
      toast.error("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async (id: string) => {
    setLaunching(id);
    try {
      await launchCampaign(id);
      toast.success("Campaign launched! Messages are being sent.");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Launch failed");
    } finally {
      setLaunching(null);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "failed") return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (status === "running") return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
    if (status === "scheduled") return <Clock className="w-4 h-4 text-blue-500" />;
    return <div className="w-4 h-4 rounded-full bg-slate-300" />;
  };

  return (
    <div className="pb-8">
      <PageHeader
        title="Campaigns"
        subtitle="Create and launch personalised marketing campaigns"
        actions={
          <button
            onClick={() => { setShowModal(true); setStep("prompt"); setGenerated(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            <Sparkles className="w-4 h-4" />
            Create Campaign
          </button>
        }
      />

      <div className="px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-5 h-5 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Campaign", "Channel", "Segment", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-slate-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.items?.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      {c.ai_generated && (
                        <span className="text-xs text-brand-500 flex items-center gap-0.5 mt-0.5">
                          <Sparkles className="w-3 h-3" /> AI generated
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: CHANNEL_COLORS[c.channel] || "#6366f1" }}>
                        {c.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.segment_name || c.segment_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={c.status} />
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[c.status])}>
                          {c.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      {c.status === "draft" && (
                        <button
                          onClick={() => handleLaunch(c.id)}
                          disabled={launching === c.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50"
                        >
                          {launching === c.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Launch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!data?.items?.length && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                      No campaigns yet. Create your first campaign above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-brand-500" />
              <h2 className="font-semibold text-slate-900 text-lg">
                {step === "prompt" ? "Create Campaign with AI" : "Review Generated Campaign"}
              </h2>
            </div>

            {step === "prompt" ? (
              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Target Segment</label>
                  <select
                    value={segmentId}
                    onChange={(e) => setSegmentId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  >
                    <option value="">Select a segment...</option>
                    {segments.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.estimated_size?.toLocaleString() || "?"} customers)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Campaign Goal</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Re-engage lapsed customers with a discount on their favourite category"
                    rows={4}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={generating} className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? "Generating..." : "Generate Campaign"}
                  </button>
                </div>
              </form>
            ) : generated && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{generated.name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Channel</label>
                    <p className="text-sm font-medium mt-1">
                      <span className="px-2 py-1 rounded-full text-xs text-white" style={{ backgroundColor: CHANNEL_COLORS[generated.channel] }}>
                        {generated.channel}
                      </span>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Channel Reasoning</label>
                    <p className="text-xs text-slate-500 mt-1">{generated.channel_reasoning}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Message Template</label>
                  <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 border border-slate-200 whitespace-pre-wrap">
                    {generated.message_template}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-xs text-green-600 font-medium">Expected Engagement</div>
                    <div className="text-lg font-bold text-green-700">{(generated.expected_engagement * 100).toFixed(0)}%</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="text-xs text-blue-600 font-medium">Expected Conversion</div>
                    <div className="text-lg font-bold text-blue-700">{(generated.expected_conversion * 100).toFixed(0)}%</div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setStep("prompt")} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Back</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    Save Campaign
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
