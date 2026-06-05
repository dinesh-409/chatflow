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
  const [activeSession, setActiveSession] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef("");

  useEffect(() => {
    if (!sessionIdRef.current) {
      const id = crypto.randomUUID();
      sessionIdRef.current = id;
      setActiveSession(id);
    }
  }, []);

  useEffect(() => {
    if (!activeSession) return;

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${activeSession}`
    )
      .then((res) => res.json())
      .then((data) => {
        setChat(
          (data?.messages || []).map(
            (m: { role: "user" | "ai"; text: string }) => ({
              role: m.role,
              text: m.text,
            })
          )
        );
      })
      .catch(() => setChat([]));
  }, [activeSession]);

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

    setChat((prev) => [
      ...prev,
      { role: "user", text: msg },
      { role: "ai", text: "" },
    ]);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat-stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: msg,
            sessionId: sessionIdRef.current,
            mode,
          }),
        }
      );

      if (!res.body) {
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let aiText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const raw = line.replace("data: ", "").trim();

          if (raw === "[DONE]") continue;

          try {
            const parsed = JSON.parse(raw);

            if (parsed.text) {
              aiText += parsed.text;

              setChat((prev) => {
                const updated = [...prev];

                if (updated.length > 0) {
                  updated[updated.length - 1] = {
                    role: "ai",
                    text: aiText,
                  };
                }

                return updated;
              });
            }
          } catch (err) {
            console.error("Stream Parse Error:", err);
          }
        }
      }
    } catch (err) {
      console.error("Stream Error:", err);
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
      <ChatSidebar
        activeSession={activeSession}
        onSelect={(id: string) => {
          setActiveSession(id);
          setChat([]);
        }}
      />

      <div className="flex flex-col flex-1">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            🚀 ChatFlow AI
          </h1>

          <ModeSelector
            mode={mode}
            setMode={setMode}
          />
        </div>

        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {chat.map((c, i) => (
            <div
              key={i}
              className={`max-w-[80%] p-4 rounded-2xl ${c.role === "user"
                  ? "ml-auto bg-green-500 text-black"
                  : "bg-gray-800 text-white"
                }`}
            >
              {c.text}
            </div>
          ))}

          {loading && (
            <div className="text-gray-400">
              AI is thinking...
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-2">
          <input
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) =>
              e.key === "Enter" && sendMessage()
            }
            placeholder="Message ChatFlow AI..."
            className="flex-1 p-3 rounded-xl bg-gray-900 border border-gray-700"
          />

          <button
            onClick={sendMessage}
            className="bg-green-500 px-5 rounded-xl text-black font-semibold"
          >
            Send
          </button>

          <button
            onClick={stop}
            className="bg-red-500 px-5 rounded-xl"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}