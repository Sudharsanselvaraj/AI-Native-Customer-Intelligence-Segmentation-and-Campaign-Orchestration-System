"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { chatWithCopilot } from "@/lib/api";
import {
  Sparkles, Send, RefreshCw, User, Zap, CheckCircle, Play,
  Target, Megaphone, BarChart3, TrendingDown, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: any[];
  workflow?: WorkflowPlan;
}

interface WorkflowPlan {
  goal_summary: string;
  segment: { name: string; description: string; natural_language: string };
  campaign: { name: string; channel: string; channel_confidence: number; channel_reasoning: string; message_template: string };
  expected_outcomes: { audience_size: string; delivery_rate: number; open_rate: number; conversion_rate: number };
  steps: { step: number; action: string; description: string }[];
}

const STARTERS = [
  { icon: BarChart3,   label: "Show campaign performance",           desc: "Analytics overview" },
  { icon: Target,      label: "Build a high-value segment",          desc: "AI audience builder" },
  { icon: Megaphone,   label: "Plan a re-engagement campaign",       desc: "Full agentic workflow" },
  { icon: TrendingDown,label: "Find customers at risk of churn",     desc: "Predictive insights" },
];

function WorkflowCard({ plan, onApprove, onReject }: { plan: WorkflowPlan; onApprove: () => void; onReject: () => void }) {
  return (
    <div
      className="rounded-[20px] p-5 mt-3 max-w-[92%]"
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(99,91,255,0.2)",
        boxShadow: "0 8px 32px rgba(99,91,255,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(99,91,255,0.1)" }}>
          <Zap className="w-4 h-4" style={{ color: "#635BFF" }} />
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>Campaign Workflow Plan</p>
          <p className="text-[11px]" style={{ color: "var(--t2)" }}>{plan.goal_summary}</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Segment */}
        <div className="rounded-[12px] p-3.5" style={{ background: "var(--surface2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: "var(--t3)" }}>Target Segment</p>
          <p className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>{plan.segment.name}</p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--t2)" }}>{plan.segment.description}</p>
        </div>

        {/* Campaign */}
        <div className="rounded-[12px] p-3.5" style={{ background: "var(--surface2)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: "var(--t3)" }}>Campaign</p>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>{plan.campaign.name}</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(99,91,255,0.1)", color: "#635BFF" }}>
              {plan.campaign.channel}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: "#22C55E" }}>
              {Math.round(plan.campaign.channel_confidence * 100)}% fit
            </span>
          </div>
          <p className="text-[11px] italic" style={{ color: "var(--t2)" }}>"{plan.campaign.message_template}"</p>
        </div>

        {/* Outcomes */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Audience",   value: plan.expected_outcomes.audience_size },
            { label: "Delivery",   value: `${Math.round(plan.expected_outcomes.delivery_rate * 100)}%` },
            { label: "Open Rate",  value: `${Math.round(plan.expected_outcomes.open_rate * 100)}%` },
            { label: "Conversion", value: `${Math.round(plan.expected_outcomes.conversion_rate * 100)}%` },
          ].map((m) => (
            <div key={m.label} className="text-center rounded-[10px] p-2.5" style={{ background: "var(--surface2)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--t1)", letterSpacing: "-0.02em" }}>{m.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--t3)" }}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: "var(--t3)" }}>Execution Plan</p>
          <div className="space-y-1.5">
            {plan.steps.map((step) => (
              <div key={step.step} className="flex items-center gap-2.5 text-[12px]">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                  style={{ background: "#635BFF" }}
                >
                  {step.step}
                </span>
                <span className="font-semibold" style={{ color: "var(--t1)" }}>{step.action.replace(/_/g, " ")}</span>
                <span style={{ color: "var(--t2)" }}>— {step.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-4 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={onApprove}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px]"
        >
          <Play className="w-3.5 h-3.5" /> Execute Workflow
        </button>
        <button
          onClick={onReject}
          className="px-4 py-2 rounded-[10px] text-[13px] font-medium transition-colors hover:bg-gray-50"
          style={{ border: "1px solid var(--border2)", color: "var(--t2)" }}
        >
          Modify Plan
        </button>
      </div>
    </div>
  );
}

function AICopilotInner() {
  const params = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const q = params.get("q");
    if (q) { send(q); }
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await chatWithCopilot({ message: text, conversation_history: history, session_id: sessionId });
      setSessionId(res.session_id);
      let workflow: WorkflowPlan | undefined;
      if (res.actions_taken?.length) {
        const pa = res.actions_taken.find((a: any) => a.tool === "plan_workflow");
        if (pa?.result?.plan) workflow = pa.result.plan;
      }
      setMessages((p) => [...p, { role: "assistant", content: res.message, actions: res.actions_taken, workflow }]);
      const n = res.actions_taken?.filter((a: any) => a.tool !== "plan_workflow").length || 0;
      if (n > 0) toast.success(`${n} action${n > 1 ? "s" : ""} completed`);
    } catch {
      toast.error("Copilot error. Please try again.");
      setMessages((p) => [...p, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally { setLoading(false); }
  };

  const approveWorkflow = (w: WorkflowPlan) => {
    send(`The plan looks great. Please execute it now — create the segment "${w.segment.name}", then create the campaign "${w.campaign.name}", and launch it.`);
  };
  const rejectWorkflow = () => { setInput(`I'd like to modify the plan. `); inputRef.current?.focus(); };

  return (
    <div className="flex flex-col h-full" style={{ background: "#F9FAFB" }}>
      {/* ── Header ── */}
      <div
        className="px-6 h-[56px] flex items-center gap-4 shrink-0"
        style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}
      >
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(99,91,255,0.15), rgba(139,92,246,0.15))" }}
        >
          <Sparkles className="w-4 h-4" style={{ color: "#635BFF" }} />
        </div>
        <div>
          <span className="text-[14px] font-semibold" style={{ color: "var(--t1)" }}>AI Copilot</span>
          <span className="text-[12px] ml-2" style={{ color: "var(--t3)" }}>Powered by Claude</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setSessionId(undefined); }}
            className="ml-auto flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:text-gray-700"
            style={{ color: "var(--t3)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> New conversation
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-8 py-6 space-y-5">
        {messages.length === 0 ? (
          /* Empty state — command palette */
          <div className="max-w-2xl mx-auto py-12">
            <div className="text-center mb-10">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center mx-auto mb-4"
                style={{ background: "linear-gradient(135deg, rgba(99,91,255,0.12), rgba(139,92,246,0.12))", border: "1px solid rgba(99,91,255,0.15)" }}
              >
                <Zap className="w-7 h-7" style={{ color: "#635BFF" }} />
              </div>
              <h2 className="text-[22px] font-bold" style={{ color: "var(--t1)", letterSpacing: "-0.025em" }}>
                Ask Aster
              </h2>
              <p className="text-[14px] mt-2" style={{ color: "var(--t2)" }}>
                Build segments, create campaigns, plan workflows, and analyse performance — in natural language.
              </p>
              <p className="text-[12px] mt-1" style={{ color: "var(--t3)" }}>
                Try: <em>"Plan a campaign to re-engage dormant customers"</em> for a full agentic workflow
              </p>
            </div>

            {/* Quick action grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.label)}
                  className="lift text-left p-4 rounded-[16px] flex items-start gap-3 transition-all"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--primary-light)" }}>
                    <s.icon className="w-4 h-4" style={{ color: "#635BFF" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--t1)" }}>{s.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--t3)" }}>{s.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto shrink-0 mt-1" style={{ color: "var(--t3)" }} />
                </button>
              ))}
            </div>

            {/* Capability hints */}
            <div className="rounded-[16px] px-5 py-4" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: "var(--t3)" }}>What I can do</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {[
                  "Build AI-powered audience segments",
                  "Generate personalised campaigns",
                  "Analyse campaign performance",
                  "Plan end-to-end agentic workflows",
                  "Predict revenue and churn risk",
                  "Suggest optimal send channels",
                ].map((c) => (
                  <div key={c} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--t2)" }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#635BFF" }} />
                    {c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3 max-w-4xl", m.role === "user" ? "ml-auto flex-row-reverse" : "")}>
              <div
                className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5"
                style={m.role === "user"
                  ? { background: "#635BFF" }
                  : { background: "linear-gradient(135deg, rgba(99,91,255,0.12), rgba(139,92,246,0.12))", border: "1px solid rgba(99,91,255,0.12)" }
                }
              >
                {m.role === "user"
                  ? <User className="w-4 h-4 text-white" />
                  : <Sparkles className="w-4 h-4" style={{ color: "#635BFF" }} />
                }
              </div>

              <div className={cn("flex-1", m.role === "user" ? "text-right" : "")}>
                <div
                  className="inline-block px-4 py-3 rounded-[16px] text-[13px] leading-relaxed max-w-[82%]"
                  style={m.role === "user"
                    ? { background: "#635BFF", color: "#fff" }
                    : { background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", color: "var(--t1)" }
                  }
                >
                  {m.role === "user" ? m.content : (
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <p className="text-[15px] font-bold mb-2" style={{ color: "var(--t1)" }}>{children}</p>,
                        h2: ({ children }) => <p className="text-[13px] font-bold mt-3 mb-1.5" style={{ color: "var(--t1)" }}>{children}</p>,
                        h3: ({ children }) => <p className="text-[12px] font-semibold mt-2 mb-1" style={{ color: "var(--t1)" }}>{children}</p>,
                        p:  ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold" style={{ color: "var(--t1)" }}>{children}</strong>,
                        em: ({ children }) => <em className="italic" style={{ color: "var(--t2)" }}>{children}</em>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="text-[13px]">{children}</li>,
                        hr: () => <hr className="my-2" style={{ borderColor: "var(--border)" }} />,
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 rounded text-[12px] font-mono" style={{ background: "rgba(99,91,255,0.08)", color: "#635BFF" }}>
                            {children}
                          </code>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="text-[12px] w-full border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead style={{ borderBottom: "1px solid var(--border)" }}>{children}</thead>,
                        th: ({ children }) => <th className="text-left px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wide" style={{ color: "var(--t3)" }}>{children}</th>,
                        td: ({ children }) => <td className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border)", color: "var(--t1)" }}>{children}</td>,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  )}
                </div>

                {m.workflow && (
                  <WorkflowCard
                    plan={m.workflow}
                    onApprove={() => approveWorkflow(m.workflow!)}
                    onReject={rejectWorkflow}
                  />
                )}

                {m.actions && m.actions.filter((a) => a.tool !== "plan_workflow").length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.actions
                      .filter((a: any) => a.tool !== "plan_workflow")
                      .map((a: any, j: number) => (
                        <div
                          key={j}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#16A34A" }}
                        >
                          <CheckCircle className="w-3 h-3" />
                          {a.tool.replace(/_/g, " ")}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-3">
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(99,91,255,0.12), rgba(139,92,246,0.12))", border: "1px solid rgba(99,91,255,0.12)" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "#635BFF" }} />
            </div>
            <div
              className="px-4 py-3 rounded-[16px] flex items-center gap-2.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
            >
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "#635BFF" }} />
              <span className="text-[13px]" style={{ color: "var(--t2)" }}>Thinking…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Input ── */}
      <div
        className="px-8 py-4 shrink-0"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-3 rounded-[16px] px-4 py-3"
          style={{ border: "1px solid var(--border2)", background: "var(--bg)" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#635BFF")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
        >
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: "#635BFF" }} />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to plan a workflow, create a segment, build a campaign, or analyse performance…"
            disabled={loading}
            className="flex-1 text-[13px] outline-none bg-transparent disabled:opacity-50"
            style={{ color: "var(--t1)" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="btn-primary w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-center text-[11px] mt-2" style={{ color: "var(--t3)" }}>
          Powered by Claude AI · Agentic CRM actions in natural language
        </p>
      </div>
    </div>
  );
}

export default function AICopilotPage() {
  return (
    <Suspense fallback={null}>
      <AICopilotInner />
    </Suspense>
  );
}
