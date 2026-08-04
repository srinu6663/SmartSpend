import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { askAI, AIError, type ChatTurn, type ChatFacts } from "@/lib/ai";
import { formatINR } from "@/lib/finance";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Message extends ChatTurn {
  id: string;
  facts?: ChatFacts | null;
  failed?: boolean;
}

const SUGGESTIONS = [
  "How much did I spend this month?",
  "What did I spend the most on?",
  "Am I spending more than last month?",
  "How much did I save this year?",
];

let messageSeq = 0;
const nextId = () => `m${++messageSeq}`;

/**
 * Conversational assistant.
 *
 * Multi-turn by design: history is sent with each question so follow-ups like
 * "what about last month?" resolve against the previous one. The figures panel
 * under each answer shows the computed numbers the reply was based on — the model
 * is not allowed to produce numbers itself, so this is auditable rather than
 * decorative.
 */
const AIChatSheet = ({ open, onClose }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || sending) return;

      const userMessage: Message = { id: nextId(), role: "user", content: trimmed };
      // Snapshot history BEFORE adding the new turn — the server expects prior
      // context, not the question repeated inside it.
      const history = messages.map(({ role, content }) => ({ role, content }));

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setSending(true);

      try {
        const reply = await askAI(trimmed, history);
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: reply.answer, facts: reply.facts },
        ]);
      } catch (err) {
        console.error("Chat failed:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: "assistant",
            content:
              err instanceof AIError ? err.message : "I couldn't reach the assistant. Please try again.",
            failed: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [messages, sending]
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto h-[85vh] bg-background rounded-t-3xl flex flex-col overflow-hidden"
            role="dialog"
            aria-label="Finance assistant"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">Ask Finly</p>
                  <p className="text-[11px] text-muted-foreground mt-1">About your money only</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close assistant"
                className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Answers are calculated from your own transactions — no one else's data is
                      visible, and every figure quoted is computed, not estimated.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="w-full text-left rounded-xl border border-border px-4 py-3 text-sm active:scale-[0.99] transition-transform"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] ${m.role === "user" ? "" : "w-full"}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : m.failed
                            ? "bg-destructive/10 text-foreground"
                            : "bg-muted text-foreground"
                      }`}
                    >
                      {m.failed && <AlertTriangle className="w-3.5 h-3.5 text-destructive inline mr-1.5 -mt-0.5" />}
                      {m.content}
                    </div>

                    {m.facts && !m.facts.empty && <FactsPanel facts={m.facts} />}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Checking your records…</span>
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2 px-5 py-4 border-t border-border shrink-0"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your spending…"
                maxLength={500}
                aria-label="Your question"
                className="flex-1 bg-muted rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={sending || input.trim().length === 0}
                aria-label="Send"
                className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4 text-primary-foreground" />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/** The computed figures behind an answer, so it can be checked at a glance. */
const FactsPanel = ({ facts }: { facts: ChatFacts }) => (
  <div className="mt-2 rounded-xl border border-border p-3 space-y-2">
    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
      From your records · {facts.range.from} to {facts.range.to}
    </p>

    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <Stat label="Spent" value={formatINR(facts.totalExpense)} />
      <Stat label="Received" value={formatINR(facts.totalIncome)} />
      <Stat label="Net" value={formatINR(facts.net)} />
      <Stat label="Entries" value={String(facts.transactionCount)} />
    </div>

    {facts.groups.length > 0 && (
      <div className="space-y-1 pt-1">
        {facts.groups.slice(0, 5).map((g) => (
          <div key={g.label} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground truncate">{g.label}</span>
            <span className="text-[11px] font-semibold shrink-0">
              {formatINR(g.amount)} · {g.share}%
            </span>
          </div>
        ))}
      </div>
    )}

    {facts.comparison && (
      <p className="text-[11px] text-muted-foreground pt-1">
        Previous period ({facts.comparison.range.from} to {facts.comparison.range.to}):{" "}
        {formatINR(facts.comparison.value)}
        {facts.comparison.changePercent !== null && ` · ${facts.comparison.changePercent > 0 ? "+" : ""}${facts.comparison.changePercent}%`}
      </p>
    )}
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className="text-xs font-bold">{value}</p>
  </div>
);

export default AIChatSheet;
