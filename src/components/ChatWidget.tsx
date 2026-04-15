import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Open chat"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Ask</h2>
              <select
                value={meetingType ?? ""}
                onChange={(e) => setMeetingType(e.target.value || null)}
                className="text-[10px] bg-transparent border border-border rounded px-1.5 py-0.5 text-muted-foreground ml-1"
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
                      className="text-xs px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-left"
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
          <div className="border-t border-border p-3 flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={loading}
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
            />
            <Button size="sm" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
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
          className={`rounded-lg px-3 py-2 text-xs ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-foreground"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
          ) : (
            <div className="prose-chat leading-relaxed">
              {message.content ? (
                <ReactMarkdown
                  components={{
                    h1: ({children}) => <h1 className="text-sm font-bold mt-3 mb-1.5 text-foreground">{children}</h1>,
                    h2: ({children}) => <h2 className="text-xs font-bold uppercase tracking-wider mt-3 mb-1 text-primary">{children}</h2>,
                    h3: ({children}) => <h3 className="text-xs font-bold mt-2 mb-1 text-foreground">{children}</h3>,
                    p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                    li: ({children}) => <li className="text-xs">{children}</li>,
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
