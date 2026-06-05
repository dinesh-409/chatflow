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
  const [mode, setMode] = useState("auto");
  const [activeSession, setActiveSession] = useState("");

  const chatRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef("");

  useEffect(() => {
    const savedSession =
      sessionStorage.getItem("chatflow_session");

    if (savedSession) {
      sessionIdRef.current = savedSession;
      setActiveSession(savedSession);
    } else {
      const id = crypto.randomUUID();

      sessionIdRef.current = id;
      setActiveSession(id);

      sessionStorage.setItem(
        "chatflow_session",
        id
      );
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
            (m: {
              role: "user" | "ai";
              text: string;
            }) => ({
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
            "Content-Type":
              "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            message: msg,
            sessionId:
              sessionIdRef.current,
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
        const { done, value } =
          await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
          stream: true,
        });

        const lines =
          buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (
            !line.startsWith("data: ")
          )
            continue;

          const raw = line
            .replace("data: ", "")
            .trim();

          if (raw === "[DONE]")
            continue;

          let parsedText = raw;
          try {
             const parsed = JSON.parse(raw);
             if (parsed.text) {
                 parsedText = parsed.text;
             }
          } catch (e) {
             // Fallback to raw
          }

          aiText += parsedText;

          setChat((prev) => {
            const updated = [...prev];

            updated[
              updated.length - 1
            ] = {
              role: "ai",
              text: aiText,
            };

            return updated;
          });
        }
      }
    } catch (err) {
      console.error(
        "Stream Error:",
        err
      );
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const msg = message;
    const isFirstMessage = chat.length === 0;

    setMessage("");

    await streamMessage(msg);
    
    if (isFirstMessage) {
        window.dispatchEvent(new CustomEvent("chat-created"));
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white">
      <ChatSidebar
        activeSession={activeSession}
        onSelect={(id: string) => {
          sessionIdRef.current = id;

          sessionStorage.setItem(
            "chatflow_session",
            id
          );

          setActiveSession(id);
          setChat([]);
        }}
      />

      <div className="flex flex-col flex-1">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            🚀 ChatFlow AI
          </h1>
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

        <div className="p-4 mx-auto w-full max-w-4xl">
          <div className="bg-[#1e1f20] rounded-3xl p-3 flex flex-col gap-2 border border-gray-800">
            
            <div className="flex items-center gap-2 px-2">
               <button className="p-1.5 rounded-full hover:bg-gray-700 text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
               </button>
               
               <select 
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="appearance-none bg-transparent text-gray-300 font-medium text-sm focus:outline-none cursor-pointer hover:bg-gray-700 px-3 py-1.5 rounded-full"
               >
                  <option value="auto" className="bg-gray-800 text-white">Auto (Smart)</option>
                  <option value="gemini" className="bg-gray-800 text-white">Gemini 3.1 Pro (High)</option>
                  <option value="groq" className="bg-gray-800 text-white">Groq Llama 3.1 (Fast)</option>
                  <option value="openrouter" className="bg-gray-800 text-white">OpenRouter GPT-4o</option>
               </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything, @ to mention, / for actions"
                className="flex-1 bg-transparent text-white px-4 py-3 focus:outline-none text-[15px] placeholder-gray-500"
              />
              
              <button className="p-2 rounded-full hover:bg-gray-700 text-gray-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </button>

              {loading ? (
                <button
                  onClick={stop}
                  className="bg-gray-700 p-2.5 rounded-full text-white hover:bg-gray-600 transition-colors flex items-center justify-center mr-1"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  className={`p-2.5 rounded-full transition-colors flex items-center justify-center mr-1 ${message.trim() ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-gray-800 text-gray-600"}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}