"use client";
import { useState, useRef, useEffect } from "react";
import { chatWithCopilot } from "@/lib/api";
import { Sparkles, Send, RefreshCw, User, Bot, Zap, CheckCircle, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

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
  "Show me an overview of my campaign performance",
  "Create a segment for high-value customers who haven't purchased in 60 days",
  "Plan a complete campaign to re-engage dormant beauty shoppers",
  "What are my top performing channels?",
];

function WorkflowCard({ plan, onApprove, onReject }: { plan: WorkflowPlan; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="bg-white border border-purple-200 rounded-2xl p-5 mt-3 max-w-[90%] shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Campaign Workflow Plan</p>
          <p className="text-xs text-slate-500">{plan.goal_summary}</p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {/* Segment */}
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Target Segment</p>
          <p className="text-sm font-medium text-slate-900">{plan.segment.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{plan.segment.description}</p>
        </div>

        {/* Campaign */}
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Campaign</p>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-slate-900">{plan.campaign.name}</p>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full capitalize">{plan.campaign.channel}</span>
            <span className="text-xs text-green-600 font-medium">{Math.round(plan.campaign.channel_confidence * 100)}% confidence</span>
          </div>
          <p className="text-xs text-slate-500 italic">"{plan.campaign.message_template}"</p>
          <p className="text-xs text-slate-400 mt-1">{plan.campaign.channel_reasoning}</p>
        </div>

        {/* Expected outcomes */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Audience", value: plan.expected_outcomes.audience_size },
            { label: "Delivery", value: `${Math.round(plan.expected_outcomes.delivery_rate * 100)}%` },
            { label: "Open Rate", value: `${Math.round(plan.expected_outcomes.open_rate * 100)}%` },
            { label: "Conversion", value: `${Math.round(plan.expected_outcomes.conversion_rate * 100)}%` },
          ].map((m) => (
            <div key={m.label} className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-sm font-bold text-slate-900">{m.value}</p>
              <p className="text-[10px] text-slate-400">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Execution Steps</p>
          <div className="space-y-1.5">
            {plan.steps.map((step) => (
              <div key={step.step} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-5 h-5 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{step.step}</span>
                <span className="font-medium">{step.action.replace(/_/g, " ")}</span>
                <span className="text-slate-400">— {step.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-slate-100">
        <button
          onClick={onApprove}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
        >
          <Play className="w-3.5 h-3.5" /> Execute Workflow
        </button>
        <button
          onClick={onReject}
          className="px-4 py-2 text-slate-500 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          Modify
        </button>
      </div>
    </div>
  );
}

export default function AICopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await chatWithCopilot({
        message: text,
        conversation_history: history,
        session_id: sessionId,
      });

      setSessionId(res.session_id);

      // Extract workflow plan if present in actions
      let workflow: WorkflowPlan | undefined;
      if (res.actions_taken?.length) {
        const planAction = res.actions_taken.find((a: any) => a.tool === "plan_workflow");
        if (planAction?.result?.plan) {
          workflow = planAction.result.plan;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.message,
          actions: res.actions_taken,
          workflow,
        },
      ]);

      const actionCount = res.actions_taken?.filter((a: any) => a.tool !== "plan_workflow").length || 0;
      if (actionCount > 0) {
        toast.success(`${actionCount} action(s) completed`);
      }
    } catch {
      toast.error("Copilot error. Please try again.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const approveWorkflow = (workflow: WorkflowPlan) => {
    send(`The plan looks great. Please execute it now — create the segment "${workflow.segment.name}", create the campaign "${workflow.campaign.name}", and launch it.`);
  };

  const rejectWorkflow = (workflow: WorkflowPlan) => {
    setInput(`I'd like to modify the plan. The segment should target `);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-200 bg-white flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-slate-900">AI Copilot</h1>
          <p className="text-xs text-slate-500">Powered by Claude · Create segments, campaigns, plan workflows, and get insights in natural language</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setSessionId(undefined); }}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> New conversation
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">ShopperReach Copilot</h2>
            <p className="text-slate-500 text-sm mb-2">
              I can build segments, create campaigns, plan full workflows, and analyse performance — all in natural language.
            </p>
            <p className="text-slate-400 text-xs mb-8">Try: "Plan a campaign to re-engage dormant customers" for an agentic workflow</p>
            <div className="grid grid-cols-2 gap-3">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3 max-w-4xl", m.role === "user" ? "ml-auto flex-row-reverse" : "")}>
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                m.role === "user" ? "bg-brand-600" : "bg-gradient-to-br from-brand-500 to-purple-600"
              )}>
                {m.role === "user" ? <User className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4 text-white" />}
              </div>
              <div className={cn("flex-1", m.role === "user" ? "text-right" : "")}>
                <div className={cn(
                  "inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[80%]",
                  m.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-slate-200 text-slate-800"
                )}>
                  {m.content}
                </div>

                {/* Workflow plan card */}
                {m.workflow && (
                  <WorkflowCard
                    plan={m.workflow}
                    onApprove={() => approveWorkflow(m.workflow!)}
                    onReject={() => rejectWorkflow(m.workflow!)}
                  />
                )}

                {/* Action badges (non-workflow actions) */}
                {m.actions && m.actions.filter((a) => a.tool !== "plan_workflow").length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.actions
                      .filter((a: any) => a.tool !== "plan_workflow")
                      .map((a: any, j: number) => (
                        <div key={j} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
              <span className="text-sm text-slate-500">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-8 py-4 border-t border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to plan a workflow, create a segment, build a campaign, or show analytics..."
            disabled={loading}
            className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
