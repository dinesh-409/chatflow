"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "../context/AuthContext";
import { api, fetchWithAuth } from "../lib/api";
import { useRouter } from "next/navigation";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
  model?: string;
};

/* ──────────────────────────────────────────────
   Code Block with Syntax Highlighting + Copy
   ────────────────────────────────────────────── */
function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");
  const lang = className?.replace("language-", "") || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-3 rounded-xl overflow-hidden border border-gray-700/50 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-gray-700/50">
        <span className="text-xs text-gray-400 font-mono">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1"
        >
          {copied ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className={`text-gray-200 font-mono ${className || ""}`}>{text}</code>
      </pre>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Quick Action Chips for Empty State
   ────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { emoji: "💡", label: "Explain a concept", prompt: "Explain quantum computing in simple terms" },
  { emoji: "💻", label: "Write code", prompt: "Write a Python function to find prime numbers" },
  { emoji: "📝", label: "Help me write", prompt: "Draft a professional email requesting a meeting" },
  { emoji: "🔍", label: "Research topic", prompt: "What are the latest advancements in AI in 2026?" },
  { emoji: "📊", label: "Compare options", prompt: "Compare React vs Vue vs Angular for a new project" },
  { emoji: "📋", label: "Make a plan", prompt: "Create a 30-day learning roadmap for machine learning" },
];

/* ──────────────────────────────────────────────
   Model Badge Component
   ────────────────────────────────────────────── */
function ModelBadge({ model }: { model: string }) {
  const colors: Record<string, string> = {
    "Gemini 2.5 Flash": "from-blue-500/20 to-cyan-500/20 text-cyan-300 border-cyan-500/30",
    "Groq Llama 3.1": "from-orange-500/20 to-yellow-500/20 text-orange-300 border-orange-500/30",
    "OpenRouter GPT-4o": "from-green-500/20 to-emerald-500/20 text-green-300 border-green-500/30",
  };
  const style = colors[model] || "from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r border ${style}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      {model}
    </span>
  );
}

/* ──────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────── */
export default function Page() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("auto");
  const [activeSession, setActiveSession] = useState("");
  const [activeModel, setActiveModel] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Auth guard ──────────────────────────── */
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  /* ── Session init ────────────────────────── */
  useEffect(() => {
    if (!user) return;
    const savedSession = sessionStorage.getItem("chatflow_session");
    if (savedSession) {
      sessionIdRef.current = savedSession;
      setActiveSession(savedSession);
    } else {
      const id = crypto.randomUUID();
      sessionIdRef.current = id;
      setActiveSession(id);
      sessionStorage.setItem("chatflow_session", id);
    }
  }, [user]);

  /* ── Load session messages ───────────────── */
  useEffect(() => {
    if (!activeSession) return;
    fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${activeSession}`)
      .then((res) => res.json())
      .then((data) => {
        setChat(
          (data?.messages || []).map((m: { role: "user" | "ai"; text: string; metadata?: { source_model?: string } }) => ({
            role: m.role,
            text: m.text,
            model: m.metadata?.source_model,
          }))
        );
      })
      .catch(() => setChat([]));
  }, [activeSession]);

  /* ── Auto-scroll ─────────────────────────── */
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  /* ── Auto-resize textarea ────────────────── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [message]);

  /* ── Stop streaming ──────────────────────── */
  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  /* ── Stream message ──────────────────────── */
  const streamMessage = async (msg: string, truncateAfterIndex?: number) => {
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    setChat((prev) => [...prev, { role: "user", text: msg }, { role: "ai", text: "" }]);

    try {
      const res = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/api/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ message: msg, sessionId: sessionIdRef.current, mode, truncateAfterIndex }),
      });

      if (!res.body) { setLoading(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let aiText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.replace("data: ", "").trim();
          if (raw === "[DONE]") continue;

          let parsedText = raw;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === "meta") {
              setActiveModel(parsed.model);
              continue;
            }
            if (parsed.text) parsedText = parsed.text;
          } catch {
            // Fallback to raw
          }

          aiText += parsedText;
          setChat((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "ai", text: aiText, model: activeModel || undefined };
            return updated;
          });
        }
      }

      // Tag the final AI message with the model used
      setChat((prev) => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === "ai") {
          updated[updated.length - 1] = { ...updated[updated.length - 1], model: activeModel || undefined };
        }
        return updated;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Stream Error:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Message queue processor ─────────────── */
  useEffect(() => {
    if (!loading && messageQueue.length > 0) {
      const nextMsg = messageQueue[0];
      setMessageQueue((prev) => prev.slice(1));
      streamMessage(nextMsg);
    }
  }, [loading, messageQueue]);

  /* ── Send message ────────────────────────── */
  const sendMessage = async () => {
    if (!message.trim() && attachments.length === 0) return;
    const msg = message;
    const isFirstMessage = chat.length === 0;
    const currentAttachments = attachments;
    setMessage("");
    setAttachments([]);

    let fileUrls: string[] = [];
    if (currentAttachments.length > 0) {
      setLoading(true);
      try {
        const formData = new FormData();
        currentAttachments.forEach((f) => formData.append("files", f));
        if (activeSession) formData.append("sessionId", activeSession);
        const res = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, { method: "POST", body: formData });
        const data = await res.json();
        fileUrls = data.urls || [];
      } catch (e) {
        console.error("Upload failed", e);
      }
    }

    const finalMsg = fileUrls.length > 0
      ? `[Attached Files: ${fileUrls.map((u) => `${process.env.NEXT_PUBLIC_API_URL}${u}`).join(", ")}]\n${msg}`
      : msg;

    if (loading) {
      setChat((prev) => [...prev, { role: "user", text: msg }]);
      setMessageQueue((prev) => [...prev, finalMsg]);
      return;
    }

    await streamMessage(finalMsg);
    if (isFirstMessage) {
      window.dispatchEvent(new CustomEvent("chat-created"));
    }
  };

  const sendMessageFromEdit = async (msg: string, index: number) => {
    if (!msg.trim() || loading) return;
    setChat((prev) => prev.slice(0, index));
    await streamMessage(msg, index);
  };

  /* ── Quick action handler ────────────────── */
  const handleQuickAction = (prompt: string) => {
    setMessage(prompt);
    setTimeout(() => {
      const fakeEvent = { key: "Enter" } as React.KeyboardEvent;
      // Directly call send
      streamMessage(prompt);
    }, 50);
  };

  /* ── Voice ───────────────────────────────── */
  const handleVoice = () => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      setMessage((prev: string) => prev + (prev ? " " : "") + event.results[0][0].transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  /* ── File change ─────────────────────────── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  /* ── New chat ────────────────────────────── */
  const handleNewChat = () => {
    const id = crypto.randomUUID();
    sessionIdRef.current = id;
    sessionStorage.setItem("chatflow_session", id);
    setActiveSession(id);
    setChat([]);
    setActiveModel("");
  };

  /* ── Copy AI response ───────────────────── */
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  /* ── Loading / Auth check ────────────────── */
  if (authLoading || !user) {
    return (
      <div className="flex h-screen bg-[#0a0a0a] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm">Loading ChatFlow...</span>
        </div>
      </div>
    );
  }

  /* ── Markdown components ─────────────────── */
  const markdownComponents = {
    code({ className, children, ...props }: { className?: string; children?: React.ReactNode; [key: string]: unknown }) {
      const isInline = !className;
      if (isInline) {
        return <code className="bg-gray-700/60 text-pink-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
      }
      return <CodeBlock className={className}>{children}</CodeBlock>;
    },
    table({ children }: { children?: React.ReactNode }) {
      return (
        <div className="overflow-x-auto my-4 rounded-lg border border-gray-700/50">
          <table className="w-full text-sm">{children}</table>
        </div>
      );
    },
    th({ children }: { children?: React.ReactNode }) {
      return <th className="bg-gray-800/80 px-4 py-2 text-left text-gray-300 font-semibold border-b border-gray-700/50">{children}</th>;
    },
    td({ children }: { children?: React.ReactNode }) {
      return <td className="px-4 py-2 border-b border-gray-800/50">{children}</td>;
    },
    a({ href, children }: { href?: string; children?: React.ReactNode }) {
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">{children}</a>;
    },
    blockquote({ children }: { children?: React.ReactNode }) {
      return <blockquote className="border-l-4 border-blue-500/50 pl-4 my-3 text-gray-300 italic">{children}</blockquote>;
    },
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* ── Sidebar ──────────────────────────── */}
      {sidebarOpen && (
        <ChatSidebar
          activeSession={activeSession}
          onSelect={(id: string) => {
            sessionIdRef.current = id;
            sessionStorage.setItem("chatflow_session", id);
            setActiveSession(id);
            setChat([]);
            setActiveModel("");
          }}
        />
      )}

      {/* ── Main Content ─────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* ── Header ───────────────────────────── */}
        <div className="h-14 border-b border-gray-800/80 flex items-center justify-between px-4 bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              ChatFlow AI
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition border border-gray-700/50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              New Chat
            </button>

            {user && (
              <div className="flex items-center gap-2 ml-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-300 transition">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Chat Area ────────────────────────── */}
        <div ref={chatRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6">
            {chat.length === 0 ? (
              /* ── Empty State ──────────────────── */
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="mb-2">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg shadow-blue-500/20">
                    ⚡
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-2 mt-4">
                  What can I help you with?
                </h2>
                <p className="text-gray-500 mb-8 text-center max-w-md">
                  ChatFlow intelligently routes your queries to the best AI model for each task.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-xl">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.prompt)}
                      className="flex flex-col items-start gap-1 p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 transition-all text-left group"
                    >
                      <span className="text-lg">{action.emoji}</span>
                      <span className="text-xs text-gray-400 group-hover:text-gray-300">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Messages ────────────────────── */
              <div className="space-y-6">
                {chat.map((c, i) => (
                  <div key={i} className={`flex gap-3 ${c.role === "user" ? "justify-end" : "justify-start"}`}>
                    {/* AI Avatar */}
                    {c.role === "ai" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1">
                        AI
                      </div>
                    )}

                    <div className={`flex flex-col ${c.role === "user" ? "items-end" : "items-start"} max-w-[85%] group`}>
                      {/* Edit mode */}
                      {c.role === "user" && editingIndex === i ? (
                        <div className="w-full bg-gray-800/80 p-3 rounded-2xl border border-gray-600">
                          <textarea
                            className="w-full bg-transparent text-white focus:outline-none resize-none text-sm"
                            rows={3}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setEditingIndex(null)} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition">Cancel</button>
                            <button onClick={() => { setEditingIndex(null); sendMessageFromEdit(editText, i); }} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition">Send</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Message bubble */}
                          <div className={
                            c.role === "user"
                              ? "bg-blue-600/90 text-white px-4 py-3 rounded-2xl rounded-br-md text-sm"
                              : "text-gray-100 prose prose-invert prose-sm max-w-none"
                          }>
                            {c.role === "ai" ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as Record<string, React.ComponentType>}>
                                {c.text || (loading && i === chat.length - 1 ? "" : " ")}
                              </ReactMarkdown>
                            ) : (
                              <span className="whitespace-pre-wrap">{c.text}</span>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1.5">
                            {c.role === "ai" && c.text && (
                              <button
                                onClick={() => copyText(c.text)}
                                className="p-1.5 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition"
                                title="Copy response"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                              </button>
                            )}
                            {c.role === "user" && (
                              <>
                                <button onClick={() => copyText(c.text)} className="p-1.5 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition" title="Copy">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                                <button onClick={() => { setEditingIndex(i); setEditText(c.text); }} className="p-1.5 rounded-md hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition" title="Edit">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                </button>
                              </>
                            )}
                          </div>

                          {/* Model badge */}
                          {c.role === "ai" && (c.model || activeModel) && c.text && (
                            <div className="mt-1.5">
                              <ModelBadge model={c.model || activeModel} />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* User Avatar */}
                    {c.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1">
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                      AI
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Input Area ───────────────────────── */}
        <div className="p-4 pb-6">
          <div className="max-w-3xl mx-auto">
            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-2">
                {attachments.map((f, i) => (
                  <div key={i} className="bg-gray-800 text-xs px-2.5 py-1.5 rounded-lg text-gray-300 flex items-center gap-2 border border-gray-700/50">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                    {f.name}
                    <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400 transition">×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 focus-within:border-gray-600 transition-colors shadow-lg">
              {/* Top row: mode selector */}
              <div className="flex items-center gap-2 px-3 pt-2">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="appearance-none bg-gray-800/80 text-gray-300 text-xs font-medium focus:outline-none cursor-pointer hover:bg-gray-700 px-2.5 py-1 rounded-lg border border-gray-700/50 transition"
                >
                  <option value="auto">⚡ Auto (Smart Routing)</option>
                  <option value="gemini">💎 Gemini 2.5 Flash</option>
                  <option value="groq">🚀 Groq Llama 3.1 (Fast)</option>
                  <option value="openrouter">🌐 OpenRouter GPT-4o</option>
                </select>
              </div>

              {/* Input row */}
              <div className="flex items-end gap-2 p-3">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition flex-shrink-0 mb-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask anything..."
                  rows={1}
                  className="flex-1 bg-transparent text-white resize-none focus:outline-none text-sm placeholder-gray-600 max-h-[200px] py-2 leading-relaxed"
                />

                <button onClick={handleVoice} className={`p-2 rounded-lg transition flex-shrink-0 mb-0.5 ${isListening ? "text-red-400 bg-red-500/10" : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                </button>

                {loading ? (
                  <button onClick={stop} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition flex-shrink-0 mb-0.5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim() && attachments.length === 0}
                    className={`p-2 rounded-lg transition flex-shrink-0 mb-0.5 ${message.trim() || attachments.length > 0 ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 14-7-4 7 4 7L5 12Z"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <p className="text-center text-[10px] text-gray-600 mt-2">
              ChatFlow routes to the best AI model. Responses may contain errors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}