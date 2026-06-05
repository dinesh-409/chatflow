"use client";

import { useEffect, useRef, useState } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ModeSelector from "../components/ModeSelector";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export default function Page() {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("auto");
  const [activeSession, setActiveSession] = useState<string>("");

  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>("");

  // INIT SESSION
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID();
      setActiveSession(sessionIdRef.current);
    }
  }, []);

  // LOAD HISTORY
  useEffect(() => {
    if (!activeSession) return;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${activeSession}`)
      .then((res) => res.json())
      .then((data) => {
        setChat(
          (data?.messages || []).map((m: any) => ({
            role: m.role,
            text: m.text,
          }))
        );
      })
      .catch(() => setChat([]));
  }, [activeSession]);

  // SCROLL
  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat]);

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const streamMessage = async (msg: string) => {
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    setChat((p) => [...p, { role: "user", text: msg }]);
    setChat((p) => [...p, { role: "ai", text: "..." }]);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat-stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            message: msg,
            sessionId: sessionIdRef.current,
            mode,
          }),
        }
      );

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let aiText = "";

      if (!reader) return;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const text = line.replace("data: ", "").trim();
          if (text === "[DONE]") continue;

          aiText += text;

          setChat((p) => {
            const copy = [...p];
            copy[copy.length - 1].text = aiText;
            return copy;
          });
        }
      }
    } catch (err) {
      console.log("Stream error");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const msg = message;
    setMessage("");
    await streamMessage(msg);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">

      {/* SIDEBAR */}
      <ChatSidebar
        activeSession={activeSession}
        onSelect={(id: string) => {
          setActiveSession(id);
          setChat([]);
        }}
      />

      {/* MAIN */}
      <div className="flex flex-col flex-1">

        {/* TOP BAR */}
        <div className="p-3 border-b border-gray-800 flex justify-between items-center">
          <h1 className="text-lg font-bold">🔥 ChatFlow AI</h1>

          <ModeSelector mode={mode} setMode={setMode} />
        </div>

        {/* CHAT AREA */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">

          {chat.map((c, i) => (
            <div
              key={i}
              className={`max-w-[75%] p-3 rounded-xl text-sm ${c.role === "user"
                  ? "ml-auto bg-green-500 text-black"
                  : "bg-gray-800"
                }`}
            >
              {c.text}
            </div>
          ))}

          {loading && (
            <div className="text-gray-400 text-sm">AI is thinking...</div>
          )}
        </div>

        {/* INPUT */}
        <div className="p-3 border-t border-gray-800 flex gap-2">
          <input
            className="flex-1 p-3 rounded-lg bg-gray-900 border border-gray-700"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Message ChatFlow AI..."
          />

          <button
            onClick={sendMessage}
            className="bg-green-500 px-4 rounded-lg text-black font-semibold"
          >
            Send
          </button>

          <button
            onClick={stop}
            className="bg-red-500 px-4 rounded-lg text-white"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}