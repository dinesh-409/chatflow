"use client";

import { useEffect, useRef, useState } from "react";
import ChatSidebar from "../components/ChatSidebar";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

export default function Page() {
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode] = useState("auto");
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
      .catch(() => {
        setChat([]);
      });
  }, [activeSession]);

  // AUTO SCROLL
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
    setChat((p) => [...p, { role: "ai", text: "" }]);

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

      let aiText = "";
      let buffer = "";

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
      console.log("Stream stopped or error");
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
    <div className="flex h-screen">

      {/* SIDEBAR */}
      <ChatSidebar
        activeSession={activeSession}
        onSelect={(id: string) => {
          setActiveSession(id);
          setChat([]);
        }}
      />

      {/* CHAT AREA */}
      <div className="flex flex-col flex-1 p-4">

        <h1 className="text-xl font-bold text-center mb-2">
          🔥 ChatFlow AI
        </h1>

        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto border p-3 bg-gray-50"
        >
          {chat.map((c, i) => (
            <div
              key={i}
              className={`mb-2 p-2 rounded ${c.role === "user"
                  ? "bg-green-100 ml-auto w-fit"
                  : "bg-gray-200"
                }`}
            >
              <b>{c.role === "user" ? "You" : "AI"}:</b> {c.text}
            </div>
          ))}
        </div>

        {/* INPUT */}
        <div className="flex gap-2 mt-2">
          <input
            className="border p-2 flex-1 rounded"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type message..."
          />

          <button
            className="bg-green-500 text-white px-4 py-2 rounded"
            onClick={sendMessage}
          >
            Send 🚀
          </button>

          <button
            className="bg-red-500 text-white px-4 py-2 rounded"
            onClick={stop}
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}