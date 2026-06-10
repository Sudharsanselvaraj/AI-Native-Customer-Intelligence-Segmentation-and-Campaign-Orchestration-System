"use client";
import { useState, useRef, useEffect } from "react";
import { chatWithCopilot } from "@/lib/api";
import { Sparkles, Send, RefreshCw, User, Bot, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: any[];
}

const STARTERS = [
  "Show me an overview of my campaign performance",
  "Create a segment for high-value customers who haven't purchased in 60 days",
  "Generate a WhatsApp re-engagement campaign for lapsed beauty shoppers",
  "What are my top performing campaigns this month?",
];

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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.message,
          actions: res.actions_taken,
        },
      ]);

      if (res.actions_taken?.length) {
        toast.success(`${res.actions_taken.length} action(s) completed`);
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
          <p className="text-xs text-slate-500">Powered by Claude · Create segments, campaigns, and get insights in natural language</p>
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
            <p className="text-slate-500 text-sm mb-8">
              I can help you build segments, create campaigns, launch communications, and analyse performance — all in natural language.
            </p>
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
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.actions.map((a, j) => (
                      <div key={j} className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">
                        <Zap className="w-3 h-3" />
                        {a.tool.replace(/_/g, " ")} completed
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
            placeholder="Ask me to create a segment, build a campaign, or show analytics..."
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
