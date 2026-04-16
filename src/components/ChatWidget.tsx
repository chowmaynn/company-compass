import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Sparkles, X, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SUPABASE_URL, SUPABASE_KEY, supabase } from "@/lib/supabase";

interface Source {
  transcript_id: string;
  meeting_type: string | null;
  meeting_date: string;
  speaker: string | null;
  start_time: number | null;
  text: string;
  similarity: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const SUGGESTED_QUESTIONS = [
  "Summarize the last Standup",
  "Summarize the last Scorecard",
];

function formatMeetingType(type: string | null): string {
  if (type === "standup") return "Standup";
  if (type === "scorecard") return "Scorecard";
  return "Meeting";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NZ", { month: "short", day: "numeric" });
}

function formatTime(secs: number | null): string {
  if (secs == null) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [meetingType, setMeetingType] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only scroll when message count changes (new message arrives or chat opened),
  // not on every streaming token — so user stays at the top of the response.
  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, open]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStreamingContent("");
    setStreamingSources([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? SUPABASE_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-transcripts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          meeting_type: meetingType,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        throw new Error(`Chat failed: ${errText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let collectedContent = "";
      let collectedSources: Source[] = [];
      let sourcesParsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!sourcesParsed && buffer.includes("\n")) {
          const newlineIdx = buffer.indexOf("\n");
          const firstLine = buffer.slice(0, newlineIdx);
          if (firstLine.startsWith("__SOURCES__")) {
            try {
              collectedSources = JSON.parse(firstLine.slice(11));
              setStreamingSources(collectedSources);
            } catch { /* ignore */ }
            buffer = buffer.slice(newlineIdx + 1);
            sourcesParsed = true;
          } else {
            sourcesParsed = true;
          }
        }

        if (sourcesParsed) {
          collectedContent += buffer;
          setStreamingContent(collectedContent);
          buffer = "";
        }
      }

      setMessages([...newMessages, {
        role: "assistant",
        content: collectedContent,
        sources: collectedSources,
      }]);
      setStreamingContent("");
      setStreamingSources([]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages([...newMessages, {
        role: "assistant",
        content: `Error: ${String(err)}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button — glassy */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={[
            "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full flex items-center justify-center",
            "bg-gradient-to-b from-white/20 to-white/5 dark:from-white/[0.12] dark:to-white/[0.03]",
            "backdrop-blur-2xl backdrop-saturate-150",
            "ring-1 ring-black/10 dark:ring-white/15",
            "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_8px_32px_-8px_rgba(0,0,0,0.4),0_2px_8px_0_rgba(0,0,0,0.15)]",
            "text-foreground hover:scale-105 transition-transform",
          ].join(" ")}
          aria-label="Open chat"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel — glassy */}
      {open && (
        <div
          className={[
            "fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)]",
            "rounded-2xl flex flex-col overflow-hidden",
            "bg-gradient-to-b from-card/80 to-card/60 dark:from-card/70 dark:to-card/50",
            "backdrop-blur-2xl backdrop-saturate-150",
            "ring-1 ring-black/5 dark:ring-white/10",
            "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_24px_48px_-12px_rgba(0,0,0,0.4)]",
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Ask</h2>
              <select
                value={meetingType ?? ""}
                onChange={(e) => setMeetingType(e.target.value || null)}
                className="text-[10px] bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-muted-foreground ml-1"
              >
                <option value="">All</option>
                <option value="standup">Standups</option>
                <option value="scorecard">Scorecard</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setStreamingContent(""); setStreamingSources([]); }}
                  className="text-[10px] text-muted-foreground hover:text-foreground px-2"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !streamingContent && (
              <div className="text-center py-8 space-y-3">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">Chat with your meeting transcripts.</p>
                <div className="flex flex-col gap-1.5 pt-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-xs px-3 py-2 rounded-md bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/5 text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {streamingContent && (
              <MessageBubble
                message={{ role: "assistant", content: streamingContent, sources: streamingSources }}
                streaming
              />
            )}

            {loading && !streamingContent && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Searching transcripts...
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/5 p-3 flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={loading}
              className="text-sm bg-white/[0.04] border-white/10 focus-visible:ring-white/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className={[
                "h-9 w-9 rounded-md flex items-center justify-center shrink-0 transition-colors",
                "bg-white/[0.08] hover:bg-white/[0.15] ring-1 ring-white/10",
                "text-foreground disabled:opacity-30 disabled:pointer-events-none",
              ].join(" ")}
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] ${isUser ? "order-2" : ""}`}>
        <div
          className={`rounded-lg px-3 py-2 text-[16px] ${
            isUser
              ? "bg-white/[0.10] ring-1 ring-white/10 text-foreground"
              : "bg-white/[0.04] ring-1 ring-white/5 text-foreground"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          ) : (
            <div className="prose-chat leading-relaxed">
              {message.content ? (
                <ReactMarkdown
                  components={{
                    h1: ({children}) => <h1 className="text-sm font-bold mt-3 mb-1.5 text-[#28C399]">{children}</h1>,
                    h2: ({children}) => <h2 className="text-xs font-bold uppercase tracking-wider mt-3 mb-1 text-[#28C399]">{children}</h2>,
                    h3: ({children}) => <h3 className="text-xs font-bold mt-2 mb-1 text-[#28C399]">{children}</h3>,
                    p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                    li: ({children}) => <li className="text-[16px]">{children}</li>,
                    strong: ({children}) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({children}) => <em className="italic">{children}</em>,
                    code: ({children}) => <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{children}</code>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (streaming ? "..." : "")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
